/**
 * API-specific types for Network CMDB
 * Query parameters, error responses, and HTTP-specific interfaces
 */

import { 
  ApiResponse, 
  PaginatedResponse, 
  ErrorResponse, 
  ValidationErrorResponse,
  ValidationError,
  QueryParams,
  NetworkResourceState,
  AwsRegion
} from './common';

// Extended API Response with request metadata
export interface ExtendedApiResponse<T> extends ApiResponse<T> {
  requestId: string;
  executionTime?: number; // milliseconds
  cached?: boolean;
}

// Extended Paginated Response
export interface ExtendedPaginatedResponse<T> extends PaginatedResponse<T> {
  requestId: string;
  executionTime?: number;
  cached?: boolean;
  filters?: Record<string, any>;
  sorting?: {
    field: string;
    order: 'ASC' | 'DESC';
  };
}

// HTTP Error Types
export type HttpErrorCode = 
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED' 
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL_SERVER_ERROR'
  | 'BAD_GATEWAY'
  | 'SERVICE_UNAVAILABLE';

// Business Logic Error Types
export type BusinessErrorCode = 
  | 'VALIDATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_ALREADY_EXISTS'
  | 'RESOURCE_IN_USE'
  | 'INVALID_STATE_TRANSITION'
  | 'AWS_SYNC_ERROR'
  | 'DATABASE_ERROR'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVICE_UNAVAILABLE';

// Enhanced Error Response with HTTP context
export interface HttpErrorResponse extends ErrorResponse {
  error: {
    code: HttpErrorCode | BusinessErrorCode;
    message: string;
    details?: Record<string, any>;
    field?: string;
    httpStatus: number;
  };
  requestId: string;
  path: string;
  method: string;
}

// Detailed Validation Error Response
export interface DetailedValidationErrorResponse extends ValidationErrorResponse {
  requestId: string;
  path: string;
  method: string;
  body?: Record<string, any>; // Sanitized request body for debugging
}

// Common query parameters for all network resources
export interface NetworkResourceQueryParams extends QueryParams {
  // AWS-specific filters
  awsAccountId?: string;
  awsAccountIds?: string[]; // Multiple account filter
  region?: AwsRegion;
  regions?: AwsRegion[]; // Multiple region filter
  
  // State and status filters
  state?: NetworkResourceState;
  states?: NetworkResourceState[]; // Multiple state filter
  statusId?: string;
  
  // Business context filters
  environment?: string;
  environments?: string[];
  project?: string;
  projects?: string[];
  owner?: string;
  owners?: string[];
  costCenter?: string;
  costCenters?: string[];
  
  // Date range filters (ISO strings)
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  lastSyncAfter?: string;
  lastSyncBefore?: string;
  
  // Tag filters
  tags?: Record<string, string>; // Exact tag matches
  tagKeys?: string[]; // Resources that have these tag keys
  tagValues?: string[]; // Resources that have these tag values
  
  // Sync and source filters
  sourceSystem?: string;
  syncVersionMin?: number;
  syncVersionMax?: number;
  notSyncedSince?: string; // ISO date - resources not synced since this date
  
  // Full-text search
  search?: string;
  searchFields?: string[]; // Limit search to specific fields
  
  // Inclusion/exclusion
  include?: string[]; // Related data to include (joins)
  exclude?: string[]; // Fields to exclude from response
  
  // Response formatting
  format?: 'json' | 'csv' | 'xlsx';
  fields?: string[]; // Specific fields to return
  
  // Pagination enhancements
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string; // Cursor-based pagination
  
  // Sorting
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  multiSort?: Array<{
    field: string;
    order: 'ASC' | 'DESC';
  }>;
}

// Bulk operation base interface
export interface BulkOperationRequest<T = any> {
  operation: 'create' | 'update' | 'delete' | 'sync';
  items: T[];
  options?: {
    continueOnError?: boolean;
    batchSize?: number;
    skipValidation?: boolean;
  };
}

// Bulk operation response
export interface BulkOperationResponse<T = any> {
  success: number;
  failed: number;
  total: number;
  results: Array<{
    item: T;
    success: boolean;
    error?: string;
    data?: any;
  }>;
  executionTime: number;
  batchSize: number;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  uptime: number; // seconds
  checks: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
    aws: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
    cache?: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
  };
}

// API versioning
export interface ApiVersion {
  version: string;
  releaseDate: Date;
  deprecationDate?: Date;
  endOfLifeDate?: Date;
  supported: boolean;
  features: string[];
}

// Rate limiting information
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds
}

// Enhanced API Response with rate limiting
export interface RateLimitedApiResponse<T> extends ExtendedApiResponse<T> {
  rateLimit: RateLimitInfo;
}

// Sync operation status
export type SyncStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

// AWS Sync operation request
export interface AwsSyncRequest {
  resourceType: 'vpc' | 'transitGateway' | 'customerGateway' | 'vpcEndpoint' | 'all';
  awsAccountId?: string;
  region?: AwsRegion;
  resourceIds?: string[]; // Specific resources to sync
  forceSync?: boolean; // Override existing data
  options?: {
    skipValidation?: boolean;
    batchSize?: number;
    maxConcurrency?: number;
  };
}

// AWS Sync operation response
export interface AwsSyncResponse {
  syncId: string;
  status: SyncStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  resourceType: string;
  awsAccountId?: string;
  region?: AwsRegion;
  stats: {
    total: number;
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  };
  errors?: Array<{
    resourceId: string;
    error: string;
    timestamp: Date;
  }>;
}

// Export request for large datasets
export interface ExportRequest extends NetworkResourceQueryParams {
  format: 'csv' | 'xlsx' | 'json';
  includeDeleted?: boolean;
  includeAuditInfo?: boolean;
  email?: string; // Send export via email when ready
}

export interface ExportResponse {
  exportId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
  recordCount?: number;
  fileSizeBytes?: number;
  error?: string;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
  userAgent?: string;
  ipAddress?: string;
  method: string;
  path: string;
  resourceType: string;
  resourceId?: string;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'SYNC' | 'EXPORT';
  status: 'SUCCESS' | 'FAILURE';
  statusCode: number;
  executionTime: number;
  requestSize?: number;
  responseSize?: number;
  changes?: Record<string, { from: any; to: any }>;
  error?: string;
  metadata?: Record<string, any>;
}

// Audit log query parameters
export interface AuditLogQueryParams extends QueryParams {
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  operation?: string;
  status?: 'SUCCESS' | 'FAILURE';
  ipAddress?: string;
  startTime?: string; // ISO date
  endTime?: string; // ISO date
  minExecutionTime?: number;
  maxExecutionTime?: number;
}

// Statistics aggregation
export interface ResourceStatistics {
  resourceType: string;
  totalCount: number;
  byRegion: Record<string, number>;
  byState: Record<string, number>;
  byEnvironment: Record<string, number>;
  byProject: Record<string, number>;
  byOwner: Record<string, number>;
  createdThisMonth: number;
  updatedThisMonth: number;
  lastSyncTime?: Date;
  syncStatus: {
    upToDate: number;
    needsSync: number;
    syncFailed: number;
    neverSynced: number;
  };
}

// Dashboard summary
export interface DashboardSummary {
  overview: {
    totalResources: number;
    totalAccounts: number;
    totalRegions: number;
    lastSyncTime?: Date;
  };
  resources: ResourceStatistics[];
  recentActivity: AuditLogEntry[];
  alerts: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    resourceType?: string;
    resourceId?: string;
    timestamp: Date;
  }>;
  syncStatus: {
    lastFullSync?: Date;
    activeSyncs: number;
    failedSyncs: number;
    nextScheduledSync?: Date;
  };
}