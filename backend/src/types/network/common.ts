/**
 * Common types and interfaces for network resources
 */

/**
 * Base interface for all AWS network resources
 */
export interface BaseNetworkResource {
  id: string;
  awsAccountId: string;
  region: string;
  state: string;
  statusId: string;
  regionId: string;
  tags?: Record<string, any>;
  name?: string;
  description?: string;
  sourceSystem: string;
  lastSyncAt?: Date;
  syncVersion: number;
  environment?: string;
  project?: string;
  costCenter?: string;
  owner?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Base creation input for network resources
 */
export interface BaseNetworkResourceCreateInput {
  awsAccountId: string;
  region: string;
  state: string;
  statusId: string;
  regionId: string;
  tags?: Record<string, any>;
  name?: string;
  description?: string;
  sourceSystem?: string;
  lastSyncAt?: Date;
  syncVersion?: number;
  environment?: string;
  project?: string;
  costCenter?: string;
  owner?: string;
}

/**
 * Base update input for network resources
 */
export interface BaseNetworkResourceUpdateInput {
  state?: string;
  statusId?: string;
  tags?: Record<string, any>;
  name?: string;
  description?: string;
  lastSyncAt?: Date;
  syncVersion?: number;
  environment?: string;
  project?: string;
  costCenter?: string;
  owner?: string;
}

/**
 * Common AWS resource states
 */
export enum ResourceState {
  PENDING = 'pending',
  AVAILABLE = 'available',
  CREATING = 'creating',
  MODIFYING = 'modifying',
  DELETING = 'deleting',
  DELETED = 'deleted',
  FAILED = 'failed',
  TERMINATED = 'terminated'
}

/**
 * Common tenancy options
 */
export enum InstanceTenancy {
  DEFAULT = 'default',
  DEDICATED = 'dedicated',
  HOST = 'host'
}

/**
 * Common enable/disable enum
 */
export enum EnableDisable {
  ENABLE = 'enable',
  DISABLE = 'disable'
}

/**
 * Filter criteria for searching network resources
 */
export interface NetworkResourceFilters {
  awsAccountId?: string;
  region?: string;
  state?: string | string[];
  environment?: string;
  project?: string;
  owner?: string;
  tags?: Record<string, string>;
  createdAfter?: Date;
  createdBefore?: Date;
  lastSyncBefore?: Date;
}

/**
 * Search criteria for complex queries
 */
export interface NetworkResourceSearchCriteria {
  search?: string;
  filters?: NetworkResourceFilters;
  includeDeleted?: boolean;
}

/**
 * Sync information for AWS resources
 */
export interface SyncInfo {
  lastSyncAt: Date;
  syncVersion?: number;
  sourceSystem?: string;
}