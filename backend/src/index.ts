/**
 * Network CMDB Backend Entry Point
 * 
 * Dynamic schema-driven API server that adapts to database changes
 * without requiring code modifications.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { sequelize, connectToDatabase } from './database';
import { getTableSchema, createDynamicModel, getColumnUniqueValues } from './utils/schemaUtils';
import './models/workflow-associations'; // Initialize workflow model associations
import apiRoutes from './api/routes';
import { pollingService } from './services/PollingService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3301;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic model cache
let VpcInfo: any = null;

// Initialize dynamic model
async function initializeDynamicModel() {
  try {
    VpcInfo = await createDynamicModel('vpc_info');
    console.log('✅ Dynamic VPC model created successfully');
  } catch (error) {
    console.error('❌ Failed to create dynamic VPC model:', error);
  }
}

// Initialize database and dynamic models
async function initializeDatabase() {
  const isConnected = await connectToDatabase();
  if (isConnected) {
    await initializeDynamicModel();
  }
}

// Initialize services
async function initializeServices() {
  try {
    console.log('🚀 Starting automated polling service...');
    await pollingService.start();
    console.log('✅ Polling service started successfully');
  } catch (error) {
    console.error('❌ Failed to start polling service:', error);
    // Don't exit process - polling service is optional
  }
}

initializeDatabase();

// Mount API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Get polling service health
    const pollingHealth = await pollingService.getHealth();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'network-cmdb-backend',
      version: '1.0.0',
      services: {
        database: 'connected',
        pollingService: {
          healthy: pollingHealth.healthy,
          running: pollingService.isRunning(),
          scheduled: pollingService.getStatus().scheduled,
          lastExecution: pollingHealth.lastExecution,
          nextExecution: pollingHealth.nextExecution
        }
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'network-cmdb-backend',
      version: '1.0.0',
      services: {
        database: 'connected',
        pollingService: {
          healthy: false,
          error: 'Health check failed'
        }
      }
    });
  }
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Network CMDB Backend API - Dynamic Schema',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      vpcs: '/api/vpcs',
      workflows: '/api/workflows',
      schema: '/api/schema/:table',
      filters: '/api/filters/:table/:column',
      api: '/api'
    }
  });
});

// Schema introspection endpoint
app.get('/api/schema/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const schema = await getTableSchema(table);
    
    res.json({
      success: true,
      table,
      schema,
      count: schema.length
    });
  } catch (error: any) {
    console.error('Error fetching schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table schema',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Filter options endpoint
app.get('/api/filters/:table/:column', async (req, res) => {
  try {
    const { table, column } = req.params;
    const values = await getColumnUniqueValues(table, column);
    
    res.json({
      success: true,
      table,
      column,
      values,
      count: values.length
    });
  } catch (error: any) {
    console.error('Error fetching filter values:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch filter values',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Dynamic VPCs endpoint with schema discovery
app.get('/api/vpcs', async (req, res) => {
  try {
    if (!VpcInfo) {
      throw new Error('VPC model not initialized');
    }

    // Get schema for response metadata
    const schema = await getTableSchema('vpc_info');
    
    // Fetch all VPC data (no hardcoded field selection)
    const vpcs = await VpcInfo.findAll({
      order: [['created_time', 'DESC']]
    });

    // Transform data with clean carriage returns
    const vpcList = vpcs.map((vpc: any) => {
      const vpcData = vpc.toJSON();
      const cleanedData: any = {};
      
      // Clean all string fields of carriage returns
      Object.keys(vpcData).forEach(key => {
        const value = vpcData[key];
        cleanedData[key] = typeof value === 'string' ? value.replace(/\r/g, '') : value;
      });
      
      return {
        // Legacy format for compatibility
        id: cleanedData.VpcId,
        vpc_id: cleanedData.VpcId,
        cidr_block: cleanedData.CidrBlock,
        state: cleanedData.status || 'available',
        region: cleanedData.Region,
        owner_id: cleanedData.AccountId,
        tags: {
          Name: cleanedData.Name,
          Environment: cleanedData['ENV Name'],
          Tenant: cleanedData.Tenant
        },
        is_default: cleanedData.IsDefault === 'True',
        created_at: cleanedData.created_time,
        
        // All database fields (dynamic)
        ...cleanedData
      };
    });

    res.json({
      success: true,
      schema, // Include schema for frontend
      data: vpcList,
      total: vpcList.length,
      message: `Found ${vpcList.length} VPCs from database`,
      source: 'database'
    });
  } catch (error: any) {
    console.error('Database error, falling back to mock data:', error.message);
    
    // Fallback to mock data
    const mockVpcs = [
      {
        id: 1,
        vpc_id: 'vpc-12345678',
        cidr_block: '10.0.0.0/16',
        state: 'available',
        region: 'us-east-1',
        owner_id: '123456789012',
        tags: { Name: 'Production VPC', Environment: 'prod' },
        is_default: false,
        instance_tenancy: 'default',
        dhcp_options_id: 'dopt-12345678',
        created_at: new Date('2024-01-15T10:00:00Z'),
        updated_at: new Date('2024-01-15T10:00:00Z')
      },
      {
        id: 2,
        vpc_id: 'vpc-87654321',
        cidr_block: '10.1.0.0/16',
        state: 'available',
        region: 'us-west-2',
        owner_id: '123456789012',
        tags: { Name: 'Development VPC', Environment: 'dev' },
        is_default: false,
        instance_tenancy: 'default',
        dhcp_options_id: 'dopt-87654321',
        created_at: new Date('2024-01-10T09:00:00Z'),
        updated_at: new Date('2024-01-10T09:00:00Z')
      }
    ];
    
    res.json({
      success: true,
      data: mockVpcs,
      total: mockVpcs.length,
      message: `Found ${mockVpcs.length} VPCs from mock data (database unavailable)`,
      source: 'mock'
    });
  }
});

// VPC by ID endpoint
app.get('/api/vpcs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vpc = await VpcInfo.findByPk(id);

    if (!vpc) {
      return res.status(404).json({
        success: false,
        message: 'VPC not found'
      });
    }

    const vpcData = vpc.toJSON();
    try {
      if (vpcData.tags) {
        vpcData.tags = JSON.parse(vpcData.tags);
      }
    } catch (e) {
      // If tags aren't JSON, leave as string
    }

    res.json({
      success: true,
      data: vpcData
    });
  } catch (error) {
    console.error('Error fetching VPC:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching VPC',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Dynamic VPC update endpoint
app.put('/api/vpcs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log(`Updating VPC ${id} with data:`, updateData);

    if (!VpcInfo) {
      throw new Error('VPC model not initialized');
    }

    // Get schema to validate editable fields
    const schema = await getTableSchema('vpc_info');
    const editableFields = schema.filter(col => col.editable).map(col => col.name);

    // Find the VPC record
    const vpc = await VpcInfo.findByPk(id);
    if (!vpc) {
      return res.status(404).json({
        success: false,
        message: 'VPC not found'
      });
    }

    // Filter to only editable fields
    const filteredUpdateData: any = {};
    Object.keys(updateData).forEach(key => {
      if (editableFields.includes(key)) {
        filteredUpdateData[key] = updateData[key];
      }
    });

    if (Object.keys(filteredUpdateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No editable fields provided',
        editableFields
      });
    }

    console.log(`Executing update for VPC ${id}:`, filteredUpdateData);

    // Perform the update
    await vpc.update(filteredUpdateData);

    // Fetch the updated record
    const updatedVpc = await VpcInfo.findByPk(id);
    const vpcData = updatedVpc?.toJSON();

    // Clean carriage returns from string fields
    const cleanedData: any = {};
    Object.keys(vpcData).forEach(key => {
      const value = vpcData[key];
      cleanedData[key] = typeof value === 'string' ? value.replace(/\r/g, '') : value;
    });

    const responseData = {
      // Legacy format for compatibility
      id: cleanedData.VpcId,
      vpc_id: cleanedData.VpcId,
      cidr_block: cleanedData.CidrBlock,
      state: cleanedData.status || 'available',
      region: cleanedData.Region,
      owner_id: cleanedData.AccountId,
      tags: {
        Name: cleanedData.Name,
        Environment: cleanedData['ENV Name'],
        Tenant: cleanedData.Tenant
      },
      is_default: cleanedData.IsDefault === 'True',
      created_at: cleanedData.created_time,
      
      // All database fields (dynamic)
      ...cleanedData
    };

    console.log(`VPC ${id} updated successfully`);

    res.json({
      success: true,
      data: responseData,
      message: 'VPC updated successfully',
      updatedFields: Object.keys(filteredUpdateData)
    });

  } catch (error: any) {
    console.error('Error updating VPC:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating VPC',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    app.listen(PORT, async () => {
      console.log(`Network CMDB Backend server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);

      // Initialize services after server starts
      await initializeServices();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  await shutdown();
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  await shutdown();
});

async function shutdown() {
  try {
    console.log('🛑 Stopping polling service...');
    await pollingService.stop();
    console.log('✅ Polling service stopped successfully');

    console.log('🛑 Closing database connections...');
    await sequelize.close();
    console.log('✅ Database connections closed');

    console.log('🎯 Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

startServer(); 
