/**
 * Base repository interface defining common CRUD operations
 * All network resource repositories should implement this interface
 */

import { FindOptions, WhereOptions } from 'sequelize';

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}

export interface SortOptions {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryOptions extends PaginationOptions {
  sort?: SortOptions[];
  include?: any[];
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Base repository interface with common CRUD operations
 */
export interface IBaseRepository<T, TCreateInput, TUpdateInput> {
  /**
   * Find a single record by ID
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find a single record by criteria
   */
  findOne(where: WhereOptions, options?: Omit<FindOptions, 'where'>): Promise<T | null>;

  /**
   * Find all records matching criteria
   */
  findAll(options?: QueryOptions): Promise<T[]>;

  /**
   * Find records with pagination
   */
  findWithPagination(options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Find records by specific criteria with pagination
   */
  findBy(where: WhereOptions, options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Count records matching criteria
   */
  count(where?: WhereOptions): Promise<number>;

  /**
   * Check if a record exists
   */
  exists(where: WhereOptions): Promise<boolean>;

  /**
   * Create a new record
   */
  create(data: TCreateInput): Promise<T>;

  /**
   * Create multiple records
   */
  bulkCreate(data: TCreateInput[]): Promise<T[]>;

  /**
   * Update a record by ID
   */
  updateById(id: string, data: TUpdateInput): Promise<T | null>;

  /**
   * Update records by criteria
   */
  updateBy(where: WhereOptions, data: TUpdateInput): Promise<[number, T[]]>;

  /**
   * Delete a record by ID
   */
  deleteById(id: string): Promise<boolean>;

  /**
   * Delete records by criteria
   */
  deleteBy(where: WhereOptions): Promise<number>;

  /**
   * Soft delete a record by ID (if supported)
   */
  softDeleteById?(id: string): Promise<boolean>;

  /**
   * Restore a soft deleted record by ID (if supported)
   */
  restoreById?(id: string): Promise<boolean>;

  /**
   * Search records with complex queries
   */
  search(query: {
    search?: string;
    filters?: Record<string, any>;
    options?: QueryOptions;
  }): Promise<PaginatedResult<T>>;
}

/**
 * Base repository interface for network resources with AWS-specific fields
 */
export interface INetworkResourceRepository<T, TCreateInput, TUpdateInput> 
  extends IBaseRepository<T, TCreateInput, TUpdateInput> {
  
  /**
   * Find by AWS resource ID
   */
  findByAwsId(awsId: string): Promise<T | null>;

  /**
   * Find all resources in a specific AWS account
   */
  findByAccount(awsAccountId: string, options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Find all resources in a specific AWS region
   */
  findByRegion(region: string, options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Find resources by account and region
   */
  findByAccountAndRegion(
    awsAccountId: string, 
    region: string, 
    options?: QueryOptions
  ): Promise<PaginatedResult<T>>;

  /**
   * Find resources by environment
   */
  findByEnvironment(environment: string, options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Find resources by project
   */
  findByProject(project: string, options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Find resources that need synchronization (older than specified date)
   */
  findStale(olderThan: Date, options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Update sync information for a resource
   */
  updateSyncInfo(awsId: string, syncData: { lastSyncAt: Date; syncVersion?: number }): Promise<boolean>;
}