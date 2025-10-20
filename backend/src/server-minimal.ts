const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { Sequelize, DataTypes, QueryTypes } = require('sequelize')
require('dotenv').config()

// Import types
import type { Request, Response, NextFunction } from 'express'

// Import workflow services and controllers
import { WorkflowController } from './controllers/WorkflowController';

const app = express()
const PORT = process.env.PORT || 3302

// Database connection
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'mydatabase',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  logging: false,
  dialectOptions: {
    connectTimeout: 10000,
  },
  pool: {
    max: 5,
    min: 1,
    acquire: 30000,
    idle: 10000
  }
})

// Dynamic VPC model
let VpcInfo: any = null
let dbConnected = false

// Initialize database connection
async function initializeDatabase() {
  try {
    await sequelize.authenticate()
    console.log('✅ Database connection established successfully.')

    // Create dynamic VPC model
    VpcInfo = sequelize.define('vpc_info', {}, {
      tableName: 'vpc_info',
      timestamps: false
    })

    dbConnected = true
  } catch (err: any) {
    console.error('❌ Unable to connect to database:', err.message)
    console.log('🔄 Continuing with fallback data...')
    dbConnected = false
  }
}


// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}))

app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:80', 'http://localhost:3001'],
  credentials: true
}))

// Trust proxy for rate limiting
app.set('trust proxy', 1)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
app.use('/api/', limiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Initialize services
const workflowController = new WorkflowController();

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        workflow: 'healthy',
        polling: 'healthy',
        alerts: 'healthy'
      }
    }
    res.json(health)
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Basic route
app.get('/', (req, res) => {
  res.json({
    name: 'Network CMDB - Data Synchronization API',
    version: '1.0.0',
    status: 'running',
    features: ['workflow-monitoring', 'n8n-integration', 'email-alerts'],
    endpoints: {
      workflows: '/api/workflows',
      status: '/api/workflows/status',
      health: '/health'
    }
  })
})

// Workflow API routes
app.get('/api/workflows', workflowController.listWorkflows);
app.get('/api/workflows/status', workflowController.getStatus);

app.get('/api/workflows/health', (req, res) => {
  res.json({
    success: true,
    data: {
      n8n_connection: 'healthy',
      database_connection: dbConnected ? 'healthy' : 'disconnected',
      email_service: 'healthy',
      polling_service: 'running',
      last_check: new Date().toISOString()
    }
  })
})

// Database tables listing endpoint
app.get('/api/database/tables', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      })
    }

    // Get all tables
    const tables = await sequelize.query(
      "SHOW TABLES",
      { type: QueryTypes.SELECT }
    ) as any[]

    // Filter VPC tables
    const vpcTables = tables.filter((table: any) => {
      const tableName = Object.values(table)[0] as string
      return tableName.includes('vpc_info')
    }).map((table: any) => Object.values(table)[0] as string)

    res.json({
      success: true,
      data: {
        all_tables: tables.map((table: any) => Object.values(table)[0]),
        vpc_tables: vpcTables
      }
    })
  } catch (error) {
    console.error('Error listing tables:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to list tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Database inspection endpoint
app.get('/api/database/inspect', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      })
    }

    // Get table info
    const tableInfo = await sequelize.query(
      "DESCRIBE vpc_info",
      { type: QueryTypes.SELECT }
    )

    // Get row count
    const [countResult] = await sequelize.query(
      "SELECT COUNT(*) as total FROM vpc_info",
      { type: QueryTypes.SELECT }
    ) as any[]

    // Get sample data
    const sampleData = await sequelize.query(
      "SELECT * FROM vpc_info LIMIT 5",
      { type: QueryTypes.SELECT }
    )

    // Check if table is empty
    const isEmpty = countResult.total === 0

    res.json({
      success: true,
      data: {
        table_structure: tableInfo,
        row_count: countResult.total,
        is_empty: isEmpty,
        sample_records: sampleData
      }
    })
  } catch (error) {
    console.error('Error inspecting database:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to inspect database',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Helper functions for schema transformation
function getDisplayType(fieldName: string, fieldType: string): string {
  const field = fieldName.toLowerCase()
  const type = fieldType.toLowerCase()

  // ID fields and codes
  if (field.includes('id') || field.includes('arn') || field.includes('key')) {
    return 'code'
  }

  // Status and state fields
  if (field.includes('status') || field.includes('state') || field.includes('isdefault')) {
    return 'badge'
  }

  // Environment, type, region fields
  if (field.includes('env') || field.includes('type') || field.includes('region') ||
      field.includes('site') || field.includes('tenant') || field.includes('name')) {
    return 'tag'
  }

  // Date/time fields
  if (field.includes('time') || field.includes('date') || type.includes('timestamp') || type.includes('datetime')) {
    return 'date'
  }

  return 'text'
}

function getColumnWidth(fieldName: string, fieldType: string): number {
  const field = fieldName.toLowerCase()
  const type = fieldType.toLowerCase()

  // ID and ARN fields are typically long
  if (field.includes('id') || field.includes('arn')) {
    return 180
  }

  // Environment names can be long
  if (field.includes('env') && field.includes('name')) {
    return 200
  }

  // Date fields
  if (field.includes('time') || field.includes('date') || type.includes('timestamp')) {
    return 180
  }

  // Status and type fields
  if (field.includes('status') || field.includes('type') || field.includes('state')) {
    return 120
  }

  // Text fields with length constraints
  if (type.includes('varchar')) {
    const match = type.match(/varchar\((\d+)\)/)
    if (match) {
      const length = parseInt(match[1])
      return Math.min(Math.max(length * 8, 100), 300)
    }
  }

  return 150
}

// Generic VPC data endpoint with provider support
app.get('/api/vpcs/:provider?', async (req, res) => {
  const provider = req.params.provider || 'aws' // Default to AWS

  // Map provider to table name
  const providerTableMap: Record<string, string> = {
    'aws': 'vpc_info',
    'ali': 'ali_vpc_info',
    'aliyun': 'ali_vpc_info',
    'azure': 'azure_vpc_info',
    'hwc': 'hwc_vpc_info',
    'huawei': 'hwc_vpc_info',
    'oci': 'oci_vpc_info',
    'oracle': 'oci_vpc_info',
    'other': 'other_vpc_info',
    'others': 'other_vpc_info'
  }

  const tableName = providerTableMap[provider.toLowerCase()]

  if (!tableName) {
    return res.status(400).json({
      success: false,
      error: 'Unsupported provider',
      message: `Provider '${provider}' is not supported. Available providers: ${Object.keys(providerTableMap).join(', ')}`
    })
  }
  try {
    if (!dbConnected) {
      // Return mock data for the new providers when database is not available
      if (provider.toLowerCase() === 'oci' || provider.toLowerCase() === 'oracle') {
        const mockOciData = [
          {
            VcnId: 'ocid1.vcn.oc1.ap-singapore-1.aaaaaaaaa1',
            VcnName: 'Development-VCN',
            Region: 'ap-singapore-1',
            CompartmentName: 'Development',
            CompartmentId: 'ocid1.compartment.oc1..aaaaaaaaa1',
            CidrBlock: '10.0.0.0/16',
            LifecycleState: 'AVAILABLE',
            provider: 'oci'
          },
          {
            VcnId: 'ocid1.vcn.oc1.ap-singapore-1.aaaaaaaaa2',
            VcnName: 'Production-VCN',
            Region: 'ap-singapore-1',
            CompartmentName: 'Production',
            CompartmentId: 'ocid1.compartment.oc1..aaaaaaaaa2',
            CidrBlock: '10.1.0.0/16',
            LifecycleState: 'AVAILABLE',
            provider: 'oci'
          },
          {
            VcnId: 'ocid1.vcn.oc1.us-phoenix-1.aaaaaaaaa3',
            VcnName: 'Test-VCN',
            Region: 'us-phoenix-1',
            CompartmentName: 'Testing',
            CompartmentId: 'ocid1.compartment.oc1..aaaaaaaaa3',
            CidrBlock: '10.2.0.0/16',
            LifecycleState: 'AVAILABLE',
            provider: 'oci'
          },
          {
            VcnId: 'ocid1.vcn.oc1.eu-frankfurt-1.aaaaaaaaa4',
            VcnName: 'Backup-VCN',
            Region: 'eu-frankfurt-1',
            CompartmentName: 'Backup',
            CompartmentId: 'ocid1.compartment.oc1..aaaaaaaaa4',
            CidrBlock: '10.3.0.0/16',
            LifecycleState: 'AVAILABLE',
            provider: 'oci'
          }
        ]
        return res.json({ success: true, data: mockOciData })
      }

      if (provider.toLowerCase() === 'others' || provider.toLowerCase() === 'other') {
        const mockOthersData = [
          {
            VpcId: 'onprem-vpc-001',
            Name: 'Corporate-HQ-Network',
            Region: 'On-Premises',
            CidrBlock: '192.168.0.0/16',
            AccountId: 'Corporate-IT',
            Site: 'New York HQ',
            provider: 'others'
          },
          {
            VpcId: 'onprem-vpc-002',
            Name: 'Branch-Office-Network',
            Region: 'On-Premises',
            CidrBlock: '172.16.0.0/16',
            AccountId: 'Branch-IT',
            Site: 'San Francisco Office',
            provider: 'others'
          },
          {
            VpcId: 'vmware-vpc-001',
            Name: 'VMware-Datacenter-01',
            Region: 'Private-Cloud',
            CidrBlock: '10.100.0.0/16',
            AccountId: 'VMware-Admin',
            Site: 'Primary Datacenter',
            provider: 'others'
          },
          {
            VpcId: 'edge-vpc-001',
            Name: 'Edge-Computing-Network',
            Region: 'Edge-Location',
            CidrBlock: '10.200.0.0/24',
            AccountId: 'Edge-Team',
            Site: 'Edge Location 1',
            provider: 'others'
          },
          {
            VpcId: 'hybrid-vpc-001',
            Name: 'Hybrid-Cloud-Bridge',
            Region: 'Hybrid',
            CidrBlock: '10.50.0.0/16',
            AccountId: 'Cloud-Ops',
            Site: 'Multi-Cloud',
            provider: 'others'
          },
          {
            VpcId: 'legacy-vpc-001',
            Name: 'Legacy-System-Network',
            Region: 'Legacy-DC',
            CidrBlock: '172.20.0.0/16',
            AccountId: 'Legacy-Team',
            Site: 'Legacy Datacenter',
            provider: 'others'
          },
          {
            VpcId: 'iot-vpc-001',
            Name: 'IoT-Device-Network',
            Region: 'IoT-Gateway',
            CidrBlock: '10.150.0.0/20',
            AccountId: 'IoT-Team',
            Site: 'IoT Gateway',
            provider: 'others'
          },
          {
            VpcId: 'backup-vpc-001',
            Name: 'Disaster-Recovery-Network',
            Region: 'DR-Site',
            CidrBlock: '10.250.0.0/16',
            AccountId: 'DR-Team',
            Site: 'DR Facility',
            provider: 'others'
          }
        ]
        return res.json({ success: true, data: mockOthersData })
      }

      if (provider.toLowerCase() === 'aws') {
        const mockAwsData = [
          {
            VpcId: 'vpc-0123456789abcdef0',
            Name: 'Production-VPC',
            Region: 'us-east-1',
            CidrBlock: '10.0.0.0/16',
            AccountId: '123456789012',
            State: 'available',
            provider: 'aws'
          },
          {
            VpcId: 'vpc-0987654321fedcba0',
            Name: 'Development-VPC',
            Region: 'us-west-2',
            CidrBlock: '10.1.0.0/16',
            AccountId: '123456789012',
            State: 'available',
            provider: 'aws'
          },
          {
            VpcId: 'vpc-0abcdef123456789',
            Name: 'Testing-VPC',
            Region: 'eu-west-1',
            CidrBlock: '10.2.0.0/16',
            AccountId: '123456789012',
            State: 'available',
            provider: 'aws'
          }
        ]
        return res.json({ success: true, data: mockAwsData })
      }

      if (provider.toLowerCase() === 'ali' || provider.toLowerCase() === 'alibaba') {
        const mockAliData = [
          {
            VpcId: 'vpc-bp1234567890abcde',
            Name: 'Production-VPC-Ali',
            Region: 'cn-hangzhou',
            CidrBlock: '172.16.0.0/16',
            AccountId: 'ali-account-001',
            Status: 'Available',
            provider: 'ali'
          },
          {
            VpcId: 'vpc-bp0987654321fedcb',
            Name: 'Development-VPC-Ali',
            Region: 'cn-beijing',
            CidrBlock: '172.17.0.0/16',
            AccountId: 'ali-account-001',
            Status: 'Available',
            provider: 'ali'
          }
        ]
        return res.json({ success: true, data: mockAliData })
      }

      if (provider.toLowerCase() === 'azure') {
        const mockAzureData = [
          {
            VnetId: '/subscriptions/12345678-1234-1234-1234-123456789012/resourceGroups/rg-prod/providers/Microsoft.Network/virtualNetworks/vnet-prod',
            Name: 'Production-VNet',
            Region: 'East US',
            CidrBlock: '10.10.0.0/16',
            ResourceGroup: 'rg-prod',
            SubscriptionId: '12345678-1234-1234-1234-123456789012',
            Status: 'Succeeded',
            provider: 'azure'
          },
          {
            VnetId: '/subscriptions/12345678-1234-1234-1234-123456789012/resourceGroups/rg-dev/providers/Microsoft.Network/virtualNetworks/vnet-dev',
            Name: 'Development-VNet',
            Region: 'West US 2',
            CidrBlock: '10.11.0.0/16',
            ResourceGroup: 'rg-dev',
            SubscriptionId: '12345678-1234-1234-1234-123456789012',
            Status: 'Succeeded',
            provider: 'azure'
          }
        ]
        return res.json({ success: true, data: mockAzureData })
      }

      if (provider.toLowerCase() === 'huawei') {
        const mockHuaweiData = [
          {
            VpcId: 'vpc-hw1234567890abcde',
            Name: 'Production-VPC-Huawei',
            Region: 'cn-north-1',
            CidrBlock: '192.168.0.0/16',
            ProjectId: 'hw-project-001',
            Status: 'ACTIVE',
            provider: 'huawei'
          },
          {
            VpcId: 'vpc-hw0987654321fedcb',
            Name: 'Development-VPC-Huawei',
            Region: 'ap-southeast-1',
            CidrBlock: '192.168.1.0/24',
            ProjectId: 'hw-project-001',
            Status: 'ACTIVE',
            provider: 'huawei'
          }
        ]
        return res.json({ success: true, data: mockHuaweiData })
      }

      return res.status(503).json({
        success: false,
        error: 'Database not connected',
        message: 'VPC data unavailable - database connection failed'
      })
    }

    // First, check if table exists
    const tableExists = await sequelize.query(
      `SHOW TABLES LIKE '${tableName}'`,
      { type: QueryTypes.SELECT }
    )

    if (tableExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Table not found',
        message: `Table '${tableName}' does not exist for provider '${provider}'`
      })
    }

    // Get the table schema to understand available columns
    const tableInfo = await sequelize.query(
      `DESCRIBE ${tableName}`,
      { type: QueryTypes.SELECT }
    ) as any[]

    console.log(`Table schema for ${tableName}:`, tableInfo.map(col => (col as any).Field))

    // Then fetch data without assuming column names
    const orderColumn = tableInfo.find(col => (col as any).Field === 'created_time') ? 'created_time' :
                       tableInfo.find(col => (col as any).Field === 'updated_time') ? 'updated_time' :
                       tableInfo[0] ? (tableInfo[0] as any).Field : 'NULL'

    const vpcs = await sequelize.query(
      `SELECT * FROM ${tableName} ORDER BY ${orderColumn} DESC`,
      { type: QueryTypes.SELECT }
    )

    console.log(`Found ${vpcs.length} VPC records for ${provider} (table: ${tableName})`)
    if (vpcs.length > 0) {
      console.log('Sample VPC record:', Object.keys(vpcs[0]))
    }

    // Transform data to match frontend expectations based on provider
    const transformedVpcs = vpcs.map((vpc: any, index: number) => {
      const baseData = { ...vpc }

      // Provider-specific field mapping
      if (provider.toLowerCase() === 'oci' || provider.toLowerCase() === 'oracle') {
        // OCI uses VcnId and VcnName instead of VpcId and Name
        baseData.id = vpc.VcnId || `oci-vcn-${index}`
        baseData.VpcId = vpc.VcnId // Add VpcId for compatibility
        baseData.Name = vpc.VcnName || vpc.Name
        baseData.Site = vpc.Region || 'Unknown'
        baseData.AccountId = vpc.CompartmentName || vpc.CompartmentId
      } else if (provider.toLowerCase() === 'other' || provider.toLowerCase() === 'others') {
        // Other providers might have empty VpcId, use Name as identifier
        baseData.id = vpc.VpcId || vpc.Name || `other-vpc-${index}`
        baseData.Site = vpc.Region || 'On-Premises'
        // Keep existing Name and other fields as-is
      } else {
        // Standard AWS-like providers
        baseData.id = vpc.VpcId || vpc.vpc_id || vpc.ID || vpc.vpcId || `${provider}-vpc-${index}`
        baseData.Site = vpc.Region || vpc.region || vpc.RegionId || vpc.Location || vpc.location || 'Unknown'
      }

      return baseData
    })

    // Transform database schema to frontend format
    const transformedSchema = tableInfo.map((column: any) => ({
      name: column.Field,
      type: column.Type.split('(')[0], // Extract base type (varchar, int, etc.)
      nullable: column.Null === 'YES',
      isPrimaryKey: column.Key === 'PRI',
      filterable: ['varchar', 'char', 'text', 'enum'].some(t => column.Type.includes(t)),
      sortable: true,
      editable: !column.Key && column.Field !== 'created_time' && column.Field !== 'updated_time',
      displayType: getDisplayType(column.Field, column.Type),
      width: getColumnWidth(column.Field, column.Type)
    }))

    res.json({
      success: true,
      data: transformedVpcs,
      total: transformedVpcs.length,
      provider,
      tableName,
      message: `${provider.toUpperCase()} VPC data retrieved successfully from ${tableName}`,
      schema: transformedSchema
    })
  } catch (error) {
    console.error('Error fetching VPC data:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VPC data',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// VPC data endpoint by provider and ID
app.get('/api/vpcs/:provider/:id', async (req, res) => {
  try {
    const { provider, id } = req.params

    // Map provider to table name (same as above)
    const providerTableMap: Record<string, string> = {
      'aws': 'vpc_info',
      'ali': 'ali_vpc_info',
      'aliyun': 'ali_vpc_info',
      'azure': 'azure_vpc_info',
      'hwc': 'hwc_vpc_info',
      'huawei': 'hwc_vpc_info',
      'oci': 'oci_vpc_info',
      'oracle': 'oci_vpc_info',
      'other': 'other_vpc_info',
      'others': 'other_vpc_info'
    }

    const tableName = providerTableMap[provider.toLowerCase()]

    if (!tableName) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported provider',
        message: `Provider '${provider}' is not supported`
      })
    }

    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      })
    }

    // Search for VPC by various ID fields based on provider
    let searchQuery = ''
    if (provider.toLowerCase() === 'oci' || provider.toLowerCase() === 'oracle') {
      searchQuery = `SELECT * FROM ${tableName} WHERE VcnId = :id OR VcnName = :id LIMIT 1`
    } else if (provider.toLowerCase() === 'other' || provider.toLowerCase() === 'others') {
      searchQuery = `SELECT * FROM ${tableName} WHERE Name = :id OR VpcId = :id LIMIT 1`
    } else {
      searchQuery = `SELECT * FROM ${tableName} WHERE VpcId = :id OR vpc_id = :id OR ID = :id OR id = :id LIMIT 1`
    }

    const vpc = await sequelize.query(searchQuery, {
      replacements: { id },
      type: QueryTypes.SELECT
    })

    if (!vpc || vpc.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'VPC not found',
        message: `VPC with ID '${id}' not found in ${provider} provider`
      })
    }

    res.json({
      success: true,
      data: vpc[0],
      provider,
      message: `${provider.toUpperCase()} VPC retrieved successfully`
    })
  } catch (error) {
    console.error('Error fetching VPC:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VPC',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Load Balancer routes - by provider
app.get('/api/loadbalancers/:provider?', async (req, res) => {
  try {
    const { provider } = req.params
    const { limit = 1000 } = req.query

    if (!dbConnected) {
      return res.status(503).json({ success: false, error: 'Database not connected' })
    }

    // Map provider to table name
    const providerTableMap: Record<string, string> = {
      'aws': 'lb_info',
      'ali': 'ali_lb_info',
      'aliyun': 'ali_lb_info',
      'azure': 'azure_lb_info',
      'hwc': 'hwc_lb_info',
      'huawei': 'hwc_lb_info',
      'oci': 'oci_lb_info',
      'oracle': 'oci_lb_info'
    }

    // If provider specified, return data for that provider only
    if (provider) {
      const tableName = providerTableMap[provider.toLowerCase()]
      if (!tableName) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported provider'
        })
      }

      try {
        // Get table schema
        const tableInfo = await sequelize.query(
          `DESCRIBE ${tableName}`,
          { type: QueryTypes.SELECT }
        ) as any[]

        // Get data
        const data = await sequelize.query(`SELECT * FROM ${tableName} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })

        // Transform schema to frontend format
        const transformedSchema = tableInfo.map((column: any) => ({
          name: column.Field,
          type: column.Type.split('(')[0],
          nullable: column.Null === 'YES',
          isPrimaryKey: column.Key === 'PRI',
          filterable: ['varchar', 'char', 'text', 'enum'].some(t => column.Type.includes(t)),
          sortable: true,
          editable: !column.Key && column.Field !== 'created_time' && column.Field !== 'updated_time',
          displayType: getDisplayType(column.Field, column.Type),
          width: getColumnWidth(column.Field, column.Type)
        }))

        return res.json({
          success: true,
          data,
          total: data.length,
          provider,
          tableName,
          schema: transformedSchema
        })
      } catch (err) {
        return res.json({ success: true, data: [], total: 0, schema: [] })
      }
    }

    // If no provider, return all
    const tables = ['lb_info', 'ali_lb_info', 'azure_lb_info', 'hwc_lb_info', 'oci_lb_info']
    const providers = ['AWS', 'Alibaba Cloud', 'Azure', 'Huawei Cloud', 'Oracle Cloud']
    let allData: any[] = []

    for (let i = 0; i < tables.length; i++) {
      try {
        const data = await sequelize.query(`SELECT * FROM ${tables[i]} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })
        allData.push(...data.map((item: any) => ({ ...item, provider: providers[i] })))
      } catch (err) {
        console.log(`Table ${tables[i]} not found or error`)
      }
    }

    res.json({ success: true, data: allData, total: allData.length })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// NAT Gateway routes - by provider
app.get('/api/natgateways/:provider?', async (req, res) => {
  try {
    const { provider } = req.params
    const { limit = 1000 } = req.query

    if (!dbConnected) {
      return res.status(503).json({ success: false, error: 'Database not connected' })
    }

    // Map provider to table name
    const providerTableMap: Record<string, string> = {
      'aws': 'ngw_info',
      'ali': 'ali_ngw_info',
      'aliyun': 'ali_ngw_info',
      'azure': 'azure_ngw_info',
      'hwc': 'hwc_ngw_info',
      'huawei': 'hwc_ngw_info',
      'oci': 'oci_ngw_info',
      'oracle': 'oci_ngw_info'
    }

    // If provider specified, return data for that provider only
    if (provider) {
      const tableName = providerTableMap[provider.toLowerCase()]
      if (!tableName) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported provider'
        })
      }

      try {
        // Get table schema
        const tableInfo = await sequelize.query(
          `DESCRIBE ${tableName}`,
          { type: QueryTypes.SELECT }
        ) as any[]

        // Get data
        const data = await sequelize.query(`SELECT * FROM ${tableName} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })

        // Transform schema to frontend format
        const transformedSchema = tableInfo.map((column: any) => ({
          name: column.Field,
          type: column.Type.split('(')[0],
          nullable: column.Null === 'YES',
          isPrimaryKey: column.Key === 'PRI',
          filterable: ['varchar', 'char', 'text', 'enum'].some(t => column.Type.includes(t)),
          sortable: true,
          editable: !column.Key && column.Field !== 'created_time' && column.Field !== 'updated_time',
          displayType: getDisplayType(column.Field, column.Type),
          width: getColumnWidth(column.Field, column.Type)
        }))

        return res.json({
          success: true,
          data,
          total: data.length,
          provider,
          tableName,
          schema: transformedSchema
        })
      } catch (err) {
        return res.json({ success: true, data: [], total: 0, schema: [] })
      }
    }

    // If no provider, return all
    const tables = ['ngw_info', 'ali_ngw_info', 'azure_ngw_info', 'hwc_ngw_info', 'oci_ngw_info']
    const providers = ['AWS', 'Alibaba Cloud', 'Azure', 'Huawei Cloud', 'Oracle Cloud']
    let allData: any[] = []

    for (let i = 0; i < tables.length; i++) {
      try {
        const data = await sequelize.query(`SELECT * FROM ${tables[i]} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })
        allData.push(...data.map((item: any) => ({ ...item, provider: providers[i] })))
      } catch (err) {
        console.log(`Table ${tables[i]} not found or error`)
      }
    }

    res.json({ success: true, data: allData, total: allData.length })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// VPN Connection routes - by provider
app.get('/api/vpnconnections/:provider?', async (req, res) => {
  try {
    const { provider } = req.params
    const { limit = 1000 } = req.query

    if (!dbConnected) {
      return res.status(503).json({ success: false, error: 'Database not connected' })
    }

    // Map provider to table name
    const providerTableMap: Record<string, string> = {
      'aws': 'vpn_info',
      'ali': 'ali_vpn_info',
      'aliyun': 'ali_vpn_info',
      'azure': 'azure_vpn_info',
      'hwc': 'hwc_vpn_info',
      'huawei': 'hwc_vpn_info',
      'oci': 'oci_vpn_info',
      'oracle': 'oci_vpn_info'
    }

    // If provider specified, return data for that provider only
    if (provider) {
      const tableName = providerTableMap[provider.toLowerCase()]
      if (!tableName) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported provider'
        })
      }

      try {
        // Get table schema
        const tableInfo = await sequelize.query(
          `DESCRIBE ${tableName}`,
          { type: QueryTypes.SELECT }
        ) as any[]

        // Get data
        const data = await sequelize.query(`SELECT * FROM ${tableName} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })

        // Transform schema to frontend format
        const transformedSchema = tableInfo.map((column: any) => ({
          name: column.Field,
          type: column.Type.split('(')[0],
          nullable: column.Null === 'YES',
          isPrimaryKey: column.Key === 'PRI',
          filterable: ['varchar', 'char', 'text', 'enum'].some(t => column.Type.includes(t)),
          sortable: true,
          editable: !column.Key && column.Field !== 'created_time' && column.Field !== 'updated_time',
          displayType: getDisplayType(column.Field, column.Type),
          width: getColumnWidth(column.Field, column.Type)
        }))

        return res.json({
          success: true,
          data,
          total: data.length,
          provider,
          tableName,
          schema: transformedSchema
        })
      } catch (err) {
        return res.json({ success: true, data: [], total: 0, schema: [] })
      }
    }

    // If no provider, return all
    const tables = ['vpn_info', 'ali_vpn_info', 'azure_vpn_info', 'hwc_vpn_info', 'oci_vpn_info']
    const providers = ['AWS', 'Alibaba Cloud', 'Azure', 'Huawei Cloud', 'Oracle Cloud']
    let allData: any[] = []

    for (let i = 0; i < tables.length; i++) {
      try {
        const data = await sequelize.query(`SELECT * FROM ${tables[i]} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })
        allData.push(...data.map((item: any) => ({ ...item, provider: providers[i] })))
      } catch (err) {
        console.log(`Table ${tables[i]} not found or error`)
      }
    }

    res.json({ success: true, data: allData, total: allData.length })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Transit Gateway Attachment routes - by provider
app.get('/api/transitgatewayattachments/:provider?', async (req, res) => {
  try {
    const { provider } = req.params
    const { limit = 1000 } = req.query

    if (!dbConnected) {
      return res.status(503).json({ success: false, error: 'Database not connected' })
    }

    // Map provider to table name
    const providerTableMap: Record<string, string> = {
      'aws': 'tgw_attachment_info',
      'ali': 'ali_tgw_attachment_info',
      'aliyun': 'ali_tgw_attachment_info',
      'azure': 'azure_tgw_attachment_info',
      'hwc': 'hwc_tgw_attachment_info',
      'huawei': 'hwc_tgw_attachment_info',
      'oci': 'oci_tgw_attachment_info',
      'oracle': 'oci_tgw_attachment_info',
      'gcp': 'gcp_tgw_attachment_info',
      'others': 'other_tgw_attachment_info'
    }

    // If provider specified, return data for that provider only
    if (provider) {
      const tableName = providerTableMap[provider.toLowerCase()]
      if (!tableName) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported provider'
        })
      }

      try {
        // Get table schema
        const tableInfo = await sequelize.query(
          `DESCRIBE ${tableName}`,
          { type: QueryTypes.SELECT }
        ) as any[]

        // Get data
        const data = await sequelize.query(`SELECT * FROM ${tableName} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })

        // Transform schema to frontend format
        const transformedSchema = tableInfo.map((column: any) => ({
          name: column.Field,
          type: column.Type.split('(')[0],
          nullable: column.Null === 'YES',
          isPrimaryKey: column.Key === 'PRI',
          filterable: ['varchar', 'char', 'text', 'enum'].some(t => column.Type.includes(t)),
          sortable: true,
          editable: !column.Key && column.Field !== 'created_time' && column.Field !== 'updated_time',
          displayType: getDisplayType(column.Field, column.Type),
          width: getColumnWidth(column.Field, column.Type)
        }))

        return res.json({
          success: true,
          data,
          total: data.length,
          provider,
          tableName,
          schema: transformedSchema
        })
      } catch (err) {
        return res.json({ success: true, data: [], total: 0, schema: [] })
      }
    }

    // If no provider, return all
    const tables = ['tgw_attachment_info', 'ali_tgw_attachment_info', 'azure_tgw_attachment_info', 'hwc_tgw_attachment_info', 'oci_tgw_attachment_info', 'gcp_tgw_attachment_info', 'other_tgw_attachment_info']
    const providers = ['AWS', 'Alibaba Cloud', 'Azure', 'Huawei Cloud', 'Oracle Cloud', 'Google Cloud', 'Others']
    let allData: any[] = []

    for (let i = 0; i < tables.length; i++) {
      try {
        const data = await sequelize.query(`SELECT * FROM ${tables[i]} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })
        allData.push(...data.map((item: any) => ({ ...item, provider: providers[i] })))
      } catch (err) {
        console.log(`Table ${tables[i]} not found or error`)
      }
    }

    res.json({ success: true, data: allData, total: allData.length })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// VPC Endpoint routes (Private Link) - by provider
app.get('/api/vpcendpoints/:provider?', async (req, res) => {
  try {
    const { provider } = req.params
    const { limit = 1000 } = req.query

    if (!dbConnected) {
      return res.status(503).json({ success: false, error: 'Database not connected' })
    }

    // Map provider to table name
    const providerTableMap: Record<string, string> = {
      'aws': 'vpc_endpoint_info',
      'ali': 'ali_vpc_endpoint_info',
      'aliyun': 'ali_vpc_endpoint_info',
      'azure': 'azure_vpc_endpoint_info',
      'hwc': 'hwc_vpc_endpoint_info',
      'huawei': 'hwc_vpc_endpoint_info',
      'oci': 'oci_vpc_endpoint_info',
      'oracle': 'oci_vpc_endpoint_info',
      'gcp': 'gcp_vpc_endpoint_info'
    }

    // If provider specified, return data for that provider only
    if (provider) {
      const tableName = providerTableMap[provider.toLowerCase()]
      if (!tableName) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported provider'
        })
      }

      try {
        // Get table schema
        const tableInfo = await sequelize.query(
          `DESCRIBE ${tableName}`,
          { type: QueryTypes.SELECT }
        ) as any[]

        // Get data
        const data = await sequelize.query(`SELECT * FROM ${tableName} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })

        // Transform schema to frontend format
        const transformedSchema = tableInfo.map((column: any) => ({
          name: column.Field,
          type: column.Type.split('(')[0],
          nullable: column.Null === 'YES',
          isPrimaryKey: column.Key === 'PRI',
          filterable: ['varchar', 'char', 'text', 'enum'].some(t => column.Type.includes(t)),
          sortable: true,
          editable: !column.Key && column.Field !== 'created_time' && column.Field !== 'updated_time',
          displayType: getDisplayType(column.Field, column.Type),
          width: getColumnWidth(column.Field, column.Type)
        }))

        return res.json({
          success: true,
          data,
          total: data.length,
          provider,
          tableName,
          schema: transformedSchema
        })
      } catch (err) {
        return res.json({ success: true, data: [], total: 0, schema: [] })
      }
    }

    // If no provider, return all (currently only AWS has data)
    const tables = ['vpc_endpoint_info']
    const providers = ['AWS']
    let allData: any[] = []

    for (let i = 0; i < tables.length; i++) {
      try {
        const data = await sequelize.query(`SELECT * FROM ${tables[i]} LIMIT ${limit}`, {
          type: QueryTypes.SELECT
        })
        allData.push(...data.map((item: any) => ({ ...item, provider: providers[i] })))
      } catch (err) {
        console.log(`Table ${tables[i]} not found or error`)
      }
    }

    res.json({ success: true, data: allData, total: allData.length })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Error handling
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', error)
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message || 'Something went wrong'
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  })
})

// Start server
app.listen(PORT, async () => {
  console.log(`Data Synchronization API server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`API docs: http://localhost:${PORT}/api/workflows`)
  console.log(`VPC data: http://localhost:${PORT}/api/vpcs`)
  console.log(`Dashboard available at: http://localhost:3001`)

  // Initialize database connection
  await initializeDatabase()
})

export default app