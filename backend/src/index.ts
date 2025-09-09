/**
 * Network CMDB Backend Entry Point
 * 
 * This is the main entry point for the Network CMDB backend API server.
 * It sets up Express.js server with basic middleware.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Sequelize, DataTypes } from 'sequelize';

// Load environment variables
dotenv.config();

// Database connection
console.log('🔍 Database connection config:');
console.log('- Host:', process.env.DB_HOST || 'localhost');
console.log('- Port:', parseInt(process.env.DB_PORT || '44060'));
console.log('- Database:', process.env.DB_NAME || 'mydatabase');
console.log('- Username:', process.env.DB_USER || 'root');
console.log('- Password:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET');

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'mydatabase',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: {
    connectTimeout: 10000,
  },
  pool: {
    max: 1,
    min: 1,
    acquire: 30000,
    idle: 10000
  }
});

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

// Define VPC model to match your actual vpc_info table structure
const VpcInfo = sequelize.define('vpc_info', {
  AccountId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Region: {
    type: DataTypes.STRING,
    allowNull: true
  },
  VpcId: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  CidrBlock: {
    type: DataTypes.STRING,
    allowNull: true
  },
  IsDefault: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  'ENV Name': {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'ENV Name'
  },
  Tenant: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true
  },
  created_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  termindated_time: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'vpc_info',
  timestamps: false
});

// Test database connection
async function connectToDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (err) {
    console.error('❌ Unable to connect to database:', err.message);
    console.log('🔄 Continuing with mock data fallback...');
  }
}
connectToDatabase();

// Health check endpoint
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'network-cmdb-backend',
    version: '1.0.0'
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Network CMDB Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      vpcs: '/api/vpcs',
      api: '/api'
    }
  });
});

// VPCs endpoint with database fallback
app.get('/api/vpcs', async (req, res) => {
  try {
    // Try database first
    const vpcs = await VpcInfo.findAll({
      attributes: [
        'VpcId',
        'CidrBlock', 
        'status',
        'Region',
        'AccountId',
        'Name',
        'ENV Name',
        'IsDefault',
        'Tenant',
        'created_time'
      ],
      order: [['created_time', 'DESC']]
    });

    // Transform database fields to frontend format with all original fields
    const vpcList = vpcs.map(vpc => {
      const vpcData = vpc.toJSON();
      return {
        // Standard format for compatibility
        id: vpcData.VpcId,
        vpc_id: vpcData.VpcId,
        cidr_block: vpcData.CidrBlock,
        state: vpcData.status || 'available',
        region: vpcData.Region,
        owner_id: vpcData.AccountId,
        tags: {
          Name: vpcData.Name,
          Environment: vpcData['ENV Name']?.replace('\r', ''),
          Tenant: vpcData.Tenant
        },
        is_default: vpcData.IsDefault === 'True',
        created_at: vpcData.created_time,
        
        // All original database fields for comprehensive display
        AccountId: vpcData.AccountId,
        Region: vpcData.Region,
        VpcId: vpcData.VpcId,
        CidrBlock: vpcData.CidrBlock,
        IsDefault: vpcData.IsDefault,
        Name: vpcData.Name,
        'ENV Name': vpcData['ENV Name']?.replace('\r', ''),
        Tenant: vpcData.Tenant,
        status: vpcData.status,
        created_time: vpcData.created_time,
        termindated_time: vpcData.termindated_time
      };
    });

    res.json({
      success: true,
      data: vpcList,
      total: vpcList.length,
      message: `Found ${vpcList.length} VPCs from database`,
      source: 'database'
    });
  } catch (error) {
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

// Update VPC endpoint - Admin only editable fields
app.put('/api/vpcs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { Name, 'ENV Name': envName, Tenant } = req.body;

    console.log(`Updating VPC ${id} with data:`, { Name, envName, Tenant });

    // Find the VPC record
    const vpc = await VpcInfo.findByPk(id);
    if (!vpc) {
      return res.status(404).json({
        success: false,
        message: 'VPC not found'
      });
    }

    // Update only the editable fields
    const updateData: any = {};
    if (Name !== undefined) updateData.Name = Name;
    if (envName !== undefined) updateData['ENV Name'] = envName;
    if (Tenant !== undefined) updateData.Tenant = Tenant;

    console.log(`Executing update for VPC ${id}:`, updateData);

    // Perform the update
    await vpc.update(updateData);

    // Fetch the updated record to return
    const updatedVpc = await VpcInfo.findByPk(id);
    const vpcData = updatedVpc?.toJSON();

    // Transform the data similar to the GET endpoint
    const responseData = {
      // Standard format for compatibility
      id: vpcData.VpcId,
      vpc_id: vpcData.VpcId,
      cidr_block: vpcData.CidrBlock,
      state: vpcData.status || 'available',
      region: vpcData.Region,
      owner_id: vpcData.AccountId,
      tags: {
        Name: vpcData.Name,
        Environment: vpcData['ENV Name']?.replace('\r', ''),
        Tenant: vpcData.Tenant
      },
      is_default: vpcData.IsDefault === 'True',
      created_at: vpcData.created_time,
      
      // All original database fields
      AccountId: vpcData.AccountId,
      Region: vpcData.Region,
      VpcId: vpcData.VpcId,
      CidrBlock: vpcData.CidrBlock,
      IsDefault: vpcData.IsDefault,
      Name: vpcData.Name,
      'ENV Name': vpcData['ENV Name']?.replace('\r', ''),
      Tenant: vpcData.Tenant,
      status: vpcData.status,
      created_time: vpcData.created_time,
      termindated_time: vpcData.termindated_time
    };

    console.log(`VPC ${id} updated successfully`);

    res.json({
      success: true,
      data: responseData,
      message: 'VPC updated successfully'
    });

  } catch (error) {
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
    app.listen(PORT, () => {
      console.log(`Network CMDB Backend server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 
