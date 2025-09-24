/**
 * Database Schema Definitions for Reports System
 *
 * Type-safe TypeScript interfaces and schema definitions for the reports and report_executions
 * database tables, matching the exact structure created by migration 010-create-reports-tables.js
 *
 * This file provides:
 * - Database table interfaces that match the exact schema
 * - Enum types for all database ENUM columns
 * - JSON schema types for configuration objects
 * - Type-safe database operations support
 */

// ===================== DATABASE ENUM TYPES =====================

/**
 * Report type enumeration - matches database ENUM
 */
export enum ReportType {
  VPC_INVENTORY = 'vpc_inventory',
  SUBNET_UTILIZATION = 'subnet_utilization',
  SECURITY_GROUP_ANALYSIS = 'security_group_analysis',
  COST_OPTIMIZATION = 'cost_optimization',
  COMPLIANCE_AUDIT = 'compliance_audit',
  NETWORK_TOPOLOGY = 'network_topology',
  RESOURCE_USAGE = 'resource_usage',
  PERFORMANCE_METRICS = 'performance_metrics',
  CUSTOM = 'custom'
}

/**
 * Report category enumeration - matches database ENUM
 */
export enum ReportCategory {
  INFRASTRUCTURE = 'infrastructure',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
  COST = 'cost',
  PERFORMANCE = 'performance',
  OPERATIONAL = 'operational'
}

/**
 * Cloud provider enumeration - matches database ENUM
 */
export enum CloudProvider {
  AWS = 'aws',
  AZURE = 'azure',
  GCP = 'gcp',
  ALI = 'ali',
  OCI = 'oci',
  HUAWEI = 'huawei',
  OTHERS = 'others',
  MULTI_CLOUD = 'multi_cloud'
}

/**
 * Output format enumeration - matches database ENUM
 */
export enum OutputFormat {
  JSON = 'json',
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf',
  HTML = 'html'
}

/**
 * Execution status enumeration - matches database ENUM
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

/**
 * Trigger type enumeration - matches database ENUM
 */
export enum TriggerType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  API = 'api',
  WEBHOOK = 'webhook'
}

// ===================== JSON CONFIGURATION TYPES =====================

/**
 * Query configuration schema for reports
 */
export interface QueryConfiguration {
  /** SQL query template or configuration */
  query?: string;
  /** Resource types to include in the report */
  resourceTypes?: string[];
  /** Field selection configuration */
  fields?: string[];
  /** Filter configuration */
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
    logicalOperator?: 'AND' | 'OR' | 'NOT';
  }>;
  /** Grouping configuration */
  groupBy?: string[];
  /** Sorting configuration */
  orderBy?: Array<{
    field: string;
    direction: 'ASC' | 'DESC';
  }>;
  /** Query limits */
  limit?: number;
  /** Date range parameters */
  dateRange?: {
    start?: string;
    end?: string;
    preset?: string;
  };
  /** Include deleted resources */
  includeDeleted?: boolean;
  /** Custom parameters */
  parameters?: Record<string, any>;
}

/**
 * Scheduling configuration schema
 */
export interface SchedulingConfiguration {
  /** Whether scheduling is enabled */
  enabled: boolean;
  /** Schedule frequency */
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  /** Cron expression for custom frequency */
  cronExpression?: string;
  /** Schedule start date */
  startDate?: string;
  /** Schedule end date */
  endDate?: string;
  /** Timezone for scheduling */
  timezone?: string;
  /** Schedule-specific parameters */
  parameters?: Record<string, any>;
  /** Delivery configuration */
  delivery?: {
    method: string[];
    email?: {
      recipients: string[];
      subject?: string;
      body?: string;
      formats: string[];
      includeCharts?: boolean;
    };
    webhook?: {
      url: string;
      headers?: Record<string, string>;
      format: string;
    };
    storage?: {
      path: string;
      format: string;
      retention?: number;
    };
  };
}

/**
 * Notification configuration schema
 */
export interface NotificationConfiguration {
  /** Enabled notification methods */
  methods: string[];
  /** Email notifications */
  email?: {
    enabled: boolean;
    recipients: string[];
    onSuccess?: boolean;
    onFailure?: boolean;
    template?: string;
  };
  /** Slack notifications */
  slack?: {
    enabled: boolean;
    webhook?: string;
    channel?: string;
    onSuccess?: boolean;
    onFailure?: boolean;
  };
  /** Webhook notifications */
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
    onSuccess?: boolean;
    onFailure?: boolean;
  };
  /** SMS notifications */
  sms?: {
    enabled: boolean;
    numbers: string[];
    onFailure?: boolean;
  };
}

/**
 * Parameters schema definition
 */
export interface ParametersSchema {
  /** Schema version */
  version: string;
  /** Parameter definitions */
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    required?: boolean;
    defaultValue?: any;
    description?: string;
    validation?: {
      min?: number;
      max?: number;
      pattern?: string;
      options?: any[];
    };
  }>;
  /** Parameter groups for UI organization */
  groups?: Array<{
    name: string;
    label: string;
    parameters: string[];
    collapsible?: boolean;
  }>;
}

/**
 * Execution parameters for specific report runs
 */
export interface ExecutionParameters {
  /** Runtime parameter values */
  values?: Record<string, any>;
  /** Execution context */
  context?: {
    userId?: number;
    userRole?: string;
    source?: string;
    correlationId?: string;
  };
  /** Override configurations */
  overrides?: {
    outputFormat?: OutputFormat;
    filters?: any[];
    limit?: number;
  };
}

/**
 * Result summary for completed executions
 */
export interface ResultSummary {
  /** Total records processed */
  totalRecords: number;
  /** Records returned in output */
  outputRecords: number;
  /** Execution performance metrics */
  performance: {
    queryTime: number;
    processingTime: number;
    renderTime?: number;
    memoryUsage?: number;
  };
  /** Data quality indicators */
  quality?: {
    completeness: number;
    accuracy: number;
    warnings?: string[];
  };
  /** Output file information */
  output?: {
    format: OutputFormat;
    size: number;
    location: string;
    checksum?: string;
  };
}

/**
 * Error details for failed executions
 */
export interface ErrorDetails {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error category */
  category: 'validation' | 'query' | 'processing' | 'rendering' | 'system';
  /** Stack trace */
  stackTrace?: string;
  /** Context information */
  context?: {
    step: string;
    query?: string;
    parameters?: any;
  };
  /** Retry information */
  retry?: {
    attempts: number;
    nextRetryAt?: string;
    maxRetries: number;
  };
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  /** Execution environment */
  environment: {
    version: string;
    nodeVersion: string;
    hostname: string;
    region?: string;
  };
  /** Resource usage */
  resources?: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage?: number;
  };
  /** Cache information */
  cache?: {
    hit: boolean;
    key?: string;
    ttl?: number;
  };
  /** Dependencies used */
  dependencies?: {
    database: string;
    libraries: string[];
  };
}

// ===================== DATABASE TABLE INTERFACES =====================

/**
 * Reports table interface - matches exact database schema
 *
 * Represents the structure of the 'reports' table as defined in
 * migration 010-create-reports-tables.js
 */
export interface ReportsTable {
  /** Primary key - auto increment integer */
  id: number;

  /** Unique report identifier - VARCHAR(255) */
  report_id: string;

  /** Human-readable report name - VARCHAR(255) */
  name: string;

  /** Detailed description - TEXT, nullable */
  description?: string;

  /** Report type enum */
  report_type: ReportType;

  /** Report category enum */
  category: ReportCategory;

  /** Cloud provider enum */
  provider: CloudProvider;

  /** JSON configuration for queries and parameters */
  query_config: QueryConfiguration;

  /** Default output format enum */
  output_format: OutputFormat;

  /** JSON configuration for scheduling - nullable */
  scheduling_config?: SchedulingConfiguration;

  /** JSON configuration for notifications - nullable */
  notification_config?: NotificationConfiguration;

  /** JSON schema defining available parameters - nullable */
  parameters_schema?: ParametersSchema;

  /** Whether the report is active - BOOLEAN, default true */
  is_active: boolean;

  /** Whether the report is public - BOOLEAN, default false */
  is_public: boolean;

  /** Foreign key to users table - nullable */
  created_by?: number;

  /** Foreign key to users table - nullable */
  last_modified_by?: number;

  /** Version number for tracking changes - INTEGER, default 1 */
  version: number;

  /** Creation timestamp - DATE */
  created_at: Date;

  /** Last update timestamp - DATE */
  updated_at: Date;
}

/**
 * Report executions table interface - matches exact database schema
 *
 * Represents the structure of the 'report_executions' table as defined in
 * migration 010-create-reports-tables.js
 */
export interface ReportExecutionsTable {
  /** Primary key - auto increment integer */
  id: number;

  /** Unique execution identifier - VARCHAR(255) */
  execution_id: string;

  /** Foreign key to reports table - VARCHAR(255) */
  report_id: string;

  /** Execution status enum */
  status: ExecutionStatus;

  /** How execution was triggered enum */
  trigger_type: TriggerType;

  /** Foreign key to users table - nullable */
  started_by?: number;

  /** Execution start timestamp - DATE */
  start_time: Date;

  /** Execution end timestamp - nullable */
  end_time?: Date;

  /** Execution duration in milliseconds - nullable */
  duration_ms?: number;

  /** Parameters used for this execution - nullable */
  execution_parameters?: ExecutionParameters;

  /** Summary of execution results - nullable */
  result_summary?: ResultSummary;

  /** Storage location of output - VARCHAR(500), nullable */
  output_location?: string;

  /** Output size in bytes - BIGINT, nullable */
  output_size_bytes?: number;

  /** Number of records processed - INTEGER, nullable, default 0 */
  records_processed?: number;

  /** Error message if failed - TEXT, nullable */
  error_message?: string;

  /** Detailed error information - nullable */
  error_details?: ErrorDetails;

  /** Additional execution metadata - nullable */
  execution_metadata?: ExecutionMetadata;

  /** When this record should be cleaned up - nullable */
  retention_until?: Date;

  /** Creation timestamp - DATE */
  created_at: Date;
}

// ===================== TYPE UTILITIES AND HELPERS =====================

/**
 * Type for creating new report records (without auto-generated fields)
 */
export type CreateReportInput = Omit<ReportsTable, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type for updating existing report records (all fields optional except id)
 */
export type UpdateReportInput = Partial<Omit<ReportsTable, 'id' | 'report_id' | 'created_at' | 'updated_at'>> & {
  id: number;
};

/**
 * Type for creating new execution records (without auto-generated fields)
 */
export type CreateExecutionInput = Omit<ReportExecutionsTable, 'id' | 'created_at'>;

/**
 * Type for updating existing execution records (all fields optional except id)
 */
export type UpdateExecutionInput = Partial<Omit<ReportExecutionsTable, 'id' | 'execution_id' | 'created_at'>> & {
  id: number;
};

/**
 * Type for report with execution history
 */
export interface ReportWithExecutions extends ReportsTable {
  executions: ReportExecutionsTable[];
}

/**
 * Type for execution with report details
 */
export interface ExecutionWithReport extends ReportExecutionsTable {
  report: ReportsTable;
}

/**
 * Filter options for querying reports
 */
export interface ReportFilters {
  report_type?: ReportType | ReportType[];
  category?: ReportCategory | ReportCategory[];
  provider?: CloudProvider | CloudProvider[];
  is_active?: boolean;
  is_public?: boolean;
  created_by?: number;
  search?: string; // Search in name/description
  created_after?: Date;
  created_before?: Date;
  updated_after?: Date;
  updated_before?: Date;
}

/**
 * Filter options for querying executions
 */
export interface ExecutionFilters {
  report_id?: string | string[];
  status?: ExecutionStatus | ExecutionStatus[];
  trigger_type?: TriggerType | TriggerType[];
  started_by?: number;
  started_after?: Date;
  started_before?: Date;
  ended_after?: Date;
  ended_before?: Date;
  min_duration?: number;
  max_duration?: number;
  has_errors?: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

/**
 * Query result with pagination
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ===================== VALIDATION SCHEMAS =====================

/**
 * Runtime validation helpers for ensuring data integrity
 */
export const ReportSchemaValidation = {
  /**
   * Validates if a value is a valid ReportType
   */
  isValidReportType: (value: any): value is ReportType => {
    return Object.values(ReportType).includes(value);
  },

  /**
   * Validates if a value is a valid ReportCategory
   */
  isValidReportCategory: (value: any): value is ReportCategory => {
    return Object.values(ReportCategory).includes(value);
  },

  /**
   * Validates if a value is a valid CloudProvider
   */
  isValidCloudProvider: (value: any): value is CloudProvider => {
    return Object.values(CloudProvider).includes(value);
  },

  /**
   * Validates if a value is a valid OutputFormat
   */
  isValidOutputFormat: (value: any): value is OutputFormat => {
    return Object.values(OutputFormat).includes(value);
  },

  /**
   * Validates if a value is a valid ExecutionStatus
   */
  isValidExecutionStatus: (value: any): value is ExecutionStatus => {
    return Object.values(ExecutionStatus).includes(value);
  },

  /**
   * Validates if a value is a valid TriggerType
   */
  isValidTriggerType: (value: any): value is TriggerType => {
    return Object.values(TriggerType).includes(value);
  }
};

// ===================== EXPORTS =====================
// All types and interfaces are already exported inline above