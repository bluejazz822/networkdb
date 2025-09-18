import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { Sequelize, DataTypes, QueryTypes } from 'sequelize'
import dotenv from 'dotenv'

dotenv.config()

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

// Mock workflow data for demonstration (fallback if needed)
const mockWorkflows = [
  {
    id: 'wf-001',
    workflow_id: 'vpc-sync-aws',
    workflow_name: 'AWS VPC Synchronization',
    workflow_type: 'vpc',
    provider: 'aws',
    is_active: true,
    status: 'success',
    last_execution: new Date().toISOString(),
    success_rate: 95.2,
    avg_duration: 45000,
    executions_today: 24
  },
  {
    id: 'wf-002',
    workflow_id: 'subnet-sync-azure',
    workflow_name: 'Azure Subnet Synchronization',
    workflow_type: 'subnet',
    provider: 'azure',
    is_active: true,
    status: 'running',
    last_execution: new Date(Date.now() - 300000).toISOString(),
    success_rate: 87.8,
    avg_duration: 32000,
    executions_today: 18
  },
  {
    id: 'wf-003',
    workflow_id: 'tgw-sync-aws',
    workflow_name: 'AWS Transit Gateway Sync',
    workflow_type: 'transit_gateway',
    provider: 'aws',
    is_active: false,
    status: 'failure',
    last_execution: new Date(Date.now() - 1800000).toISOString(),
    success_rate: 76.4,
    avg_duration: 67000,
    executions_today: 0
  }
]

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
app.get('/api/workflows', (req, res) => {
  res.json({
    success: true,
    data: mockWorkflows,
    total: mockWorkflows.length,
    message: 'Data Synchronization workflows retrieved successfully'
  })
})

app.get('/api/workflows/status', (req, res) => {
  const totalWorkflows = mockWorkflows.length
  const activeWorkflows = mockWorkflows.filter(w => w.is_active).length
  const successfulExecutions = mockWorkflows.reduce((sum, w) => sum + w.executions_today, 0)
  const avgSuccessRate = mockWorkflows.reduce((sum, w) => sum + w.success_rate, 0) / totalWorkflows

  res.json({
    success: true,
    data: {
      totalWorkflows,
      activeWorkflows,
      successfulExecutions,
      failedExecutions: Math.floor(successfulExecutions * (1 - avgSuccessRate / 100)),
      avgSuccessRate: Math.round(avgSuccessRate * 10) / 10,
      lastSyncTime: new Date().toISOString(),
      systemHealth: 'healthy'
    }
  })
})

app.get('/api/workflows/:id/executions', (req, res) => {
  const workflowId = req.params.id
  const workflow = mockWorkflows.find(w => w.id === workflowId)

  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: 'Workflow not found'
    })
  }

  // Generate mock execution history
  const executions = Array.from({ length: 10 }, (_, i) => ({
    id: `exec-${workflowId}-${i + 1}`,
    execution_id: `n8n-exec-${Date.now() - i * 3600000}`,
    status: i < 8 ? 'success' : (i === 8 ? 'failure' : 'running'),
    start_time: new Date(Date.now() - i * 3600000).toISOString(),
    end_time: i === 9 ? null : new Date(Date.now() - i * 3600000 + 30000).toISOString(),
    duration_ms: i === 9 ? null : 30000 + Math.floor(Math.random() * 60000),
    resources_created: Math.floor(Math.random() * 10),
    resources_updated: Math.floor(Math.random() * 5),
    resources_failed: i === 8 ? 2 : 0
  }))

  res.json({
    success: true,
    data: executions,
    total: executions.length
  })
})

app.post('/api/workflows/:id/trigger', (req, res) => {
  const workflowId = req.params.id
  const workflow = mockWorkflows.find(w => w.id === workflowId)

  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: 'Workflow not found'
    })
  }

  // Simulate manual trigger
  const executionId = `manual-${Date.now()}`

  res.json({
    success: true,
    data: {
      execution_id: executionId,
      workflow_id: workflow.workflow_id,
      status: 'triggered',
      message: `Workflow "${workflow.workflow_name}" triggered successfully`,
      estimated_duration: workflow.avg_duration
    }
  })
})

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
    'huawei': 'hwc_vpc_info'
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

      // Ensure all VPCs have an 'id' field - try different common ID fields
      if (!baseData.id) {
        baseData.id = vpc.VpcId || vpc.vpc_id || vpc.ID || vpc.vpcId || `${provider}-vpc-${index}`
      }

      // Ensure all VPCs have a 'Site' field - try different region fields
      if (!baseData.Site) {
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
      'huawei': 'hwc_vpc_info'
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

    // Search for VPC by various ID fields
    const vpc = await sequelize.query(
      `SELECT * FROM ${tableName} WHERE VpcId = :id OR vpc_id = :id OR ID = :id OR id = :id LIMIT 1`,
      {
        replacements: { id },
        type: QueryTypes.SELECT
      }
    )

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

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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