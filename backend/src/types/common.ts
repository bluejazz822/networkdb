/**
 * Common types and interfaces for Network CMDB
 */

// Base entity interface - matches the common migration fields
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

// AWS Resource Common Fields
export interface AwsResource extends BaseEntity {
  awsAccountId: string;
  region: string;
  regionId: string;
  statusId: string;
  sourceSystem: string;
  lastSyncAt?: Date | null;
  syncVersion: number;
  tags?: Record<string, string> | null;
  name?: string | null;
  description?: string | null;
}

// Business Context Fields
export interface BusinessContext {
  environment?: string | null;
  project?: string | null;
  costCenter?: string | null;
  owner?: string | null;
}

// Network Resource States
export type NetworkResourceState = 
  | 'pending'
  | 'available'
  | 'active'
  | 'inactive'
  | 'deleting'
  | 'deleted'
  | 'failed';

// AWS Regions
export type AwsRegion = 
  | 'us-east-1'
  | 'us-east-2'
  | 'us-west-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'eu-west-2'
  | 'eu-central-1'
  | 'ap-southeast-1'
  | 'ap-southeast-2'
  | 'ap-northeast-1';

// Instance Tenancy Options
export type InstanceTenancy = 'default' | 'dedicated' | 'host';

// Common pagination interface
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

// Common search interface
export interface SearchParams {
  query?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Combined query parameters
export interface QueryParams extends PaginationParams, SearchParams {
  [key: string]: any;
}

// Common filter interface for network resources
export interface NetworkResourceFilter {
  awsAccountId?: string;
  region?: string;
  state?: NetworkResourceState;
  environment?: string;
  project?: string;
  owner?: string;
  lastSyncAfter?: Date;
  lastSyncBefore?: Date;
  createdAfter?: Date;
  createdBefore?: Date;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: Date;
}

// Paginated response
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error response
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    field?: string;
  };
  timestamp: Date;
  requestId?: string;
}

// Validation error detail
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code: string;
}

// Detailed validation error response
export interface ValidationErrorResponse extends ErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: {
      errors: ValidationError[];
    };
  };
}

// Create operation base DTO
export interface CreateDto {
  // Excludes id, createdAt, updatedAt, deletedAt as they're set by the system
}

// Update operation base DTO
export interface UpdateDto {
  // Excludes id, createdAt, updatedAt, deletedAt as they're managed by the system
}

// AWS resource sync metadata
export interface SyncMetadata {
  lastSyncAt?: Date;
  syncVersion: number;
  sourceSystem: string;
}

// Audit information for network operations
export interface AuditInfo {
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  resourceType: string;
  resourceId: string;
  changes?: Record<string, { from: any; to: any }>;
}