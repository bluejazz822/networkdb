/**
 * Abstract base repository class implementing common CRUD operations
 * Provides a foundation for all network resource repositories
 */

import { 
  Model, 
  ModelStatic, 
  FindOptions, 
  WhereOptions, 
  Order,
  CreateOptions,
  UpdateOptions,
  DestroyOptions
} from 'sequelize';
import { 
  IBaseRepository, 
  QueryOptions, 
  PaginatedResult, 
  SortOptions,
  PaginationOptions
} from './interfaces/IBaseRepository';

/**
 * Abstract base repository class
 */
export abstract class BaseRepository<
  TModel extends Model,
  TCreateInput,
  TUpdateInput
> implements IBaseRepository<TModel, TCreateInput, TUpdateInput> {
  
  protected model: ModelStatic<TModel>;

  constructor(model: ModelStatic<TModel>) {
    this.model = model;
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string): Promise<TModel | null> {
    try {
      return await this.model.findByPk(id);
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name} by ID ${id}: ${error.message}`);
    }
  }

  /**
   * Find a single record by criteria
   */
  async findOne(where: WhereOptions, options?: Omit<FindOptions, 'where'>): Promise<TModel | null> {
    try {
      return await this.model.findOne({
        where,
        ...options
      });
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name}: ${error.message}`);
    }
  }

  /**
   * Find all records matching criteria
   */
  async findAll(options?: QueryOptions): Promise<TModel[]> {
    try {
      const findOptions = this.buildFindOptions(options);
      return await this.model.findAll(findOptions);
    } catch (error) {
      throw new Error(`Failed to find all ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Find records with pagination
   */
  async findWithPagination(options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      const { page, pageSize, pagination } = this.buildPaginationOptions(options);
      const findOptions = this.buildFindOptions({ ...options, ...pagination });
      
      const { count, rows } = await this.model.findAndCountAll(findOptions);
      
      return this.buildPaginatedResult(rows, count, page, pageSize);
    } catch (error) {
      throw new Error(`Failed to find paginated ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Find records by specific criteria with pagination
   */
  async findBy(where: WhereOptions, options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      const { page, pageSize, pagination } = this.buildPaginationOptions(options);
      const findOptions = this.buildFindOptions({ 
        ...options, 
        ...pagination 
      });
      findOptions.where = where;
      
      const { count, rows } = await this.model.findAndCountAll(findOptions);
      
      return this.buildPaginatedResult(rows, count, page, pageSize);
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name}s by criteria: ${error.message}`);
    }
  }

  /**
   * Count records matching criteria
   */
  async count(where?: WhereOptions): Promise<number> {
    try {
      return await this.model.count(where ? { where } : {});
    } catch (error) {
      throw new Error(`Failed to count ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Check if a record exists
   */
  async exists(where: WhereOptions): Promise<boolean> {
    try {
      const count = await this.model.count({ where });
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check if ${this.model.name} exists: ${error.message}`);
    }
  }

  /**
   * Create a new record
   */
  async create(data: TCreateInput): Promise<TModel> {
    try {
      return await this.model.create(data as any);
    } catch (error) {
      throw new Error(`Failed to create ${this.model.name}: ${error.message}`);
    }
  }

  /**
   * Create multiple records
   */
  async bulkCreate(data: TCreateInput[]): Promise<TModel[]> {
    try {
      return await this.model.bulkCreate(data as any[], { returning: true });
    } catch (error) {
      throw new Error(`Failed to bulk create ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Update a record by ID
   */
  async updateById(id: string, data: TUpdateInput): Promise<TModel | null> {
    try {
      const [updatedRowsCount] = await this.model.update(
        data as any,
        { 
          where: { id }, 
          returning: true 
        }
      );
      
      if (updatedRowsCount === 0) {
        return null;
      }
      
      return await this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update ${this.model.name} with ID ${id}: ${error.message}`);
    }
  }

  /**
   * Update records by criteria
   */
  async updateBy(where: WhereOptions, data: TUpdateInput): Promise<[number, TModel[]]> {
    try {
      const result = await this.model.update(
        data as any,
        { 
          where, 
          returning: true 
        }
      );
      
      return result;
    } catch (error) {
      throw new Error(`Failed to update ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Delete a record by ID
   */
  async deleteById(id: string): Promise<boolean> {
    try {
      const deletedCount = await this.model.destroy({ where: { id } });
      return deletedCount > 0;
    } catch (error) {
      throw new Error(`Failed to delete ${this.model.name} with ID ${id}: ${error.message}`);
    }
  }

  /**
   * Delete records by criteria
   */
  async deleteBy(where: WhereOptions): Promise<number> {
    try {
      return await this.model.destroy({ where });
    } catch (error) {
      throw new Error(`Failed to delete ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Soft delete a record by ID (if the model supports it)
   */
  async softDeleteById(id: string): Promise<boolean> {
    try {
      const [updatedCount] = await this.model.update(
        { deletedAt: new Date() } as any,
        { where: { id } }
      );
      return updatedCount > 0;
    } catch (error) {
      throw new Error(`Failed to soft delete ${this.model.name} with ID ${id}: ${error.message}`);
    }
  }

  /**
   * Restore a soft deleted record by ID
   */
  async restoreById(id: string): Promise<boolean> {
    try {
      const [updatedCount] = await this.model.update(
        { deletedAt: null } as any,
        { where: { id } }
      );
      return updatedCount > 0;
    } catch (error) {
      throw new Error(`Failed to restore ${this.model.name} with ID ${id}: ${error.message}`);
    }
  }

  /**
   * Search records with complex queries
   */
  async search(query: {
    search?: string;
    filters?: Record<string, any>;
    options?: QueryOptions;
  }): Promise<PaginatedResult<TModel>> {
    try {
      const { search, filters = {}, options = {} } = query;
      
      let where: WhereOptions = { ...filters };
      
      // Implement search logic in subclasses
      if (search) {
        where = this.buildSearchWhere(search, where);
      }
      
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to search ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Build search where clause - to be implemented by subclasses
   */
  protected abstract buildSearchWhere(search: string, existingWhere: WhereOptions): WhereOptions;

  /**
   * Build find options from query options
   */
  protected buildFindOptions(options?: QueryOptions): FindOptions {
    const findOptions: FindOptions = {};
    
    if (options) {
      // Handle pagination
      if (options.limit !== undefined) {
        findOptions.limit = options.limit;
      }
      if (options.offset !== undefined) {
        findOptions.offset = options.offset;
      }
      
      // Handle sorting
      if (options.sort && options.sort.length > 0) {
        findOptions.order = this.buildOrderClause(options.sort);
      }
      
      // Handle includes
      if (options.include) {
        findOptions.include = options.include;
      }
    }
    
    return findOptions;
  }

  /**
   * Build order clause from sort options
   */
  protected buildOrderClause(sort: SortOptions[]): Order {
    return sort.map(s => [s.field, s.direction]);
  }

  /**
   * Build pagination options
   */
  protected buildPaginationOptions(options?: QueryOptions) {
    const defaultPageSize = 20;
    
    let page: number;
    let pageSize: number;
    
    if (options?.page && options?.pageSize) {
      page = Math.max(1, options.page);
      pageSize = Math.min(Math.max(1, options.pageSize), 100); // Max 100 items per page
    } else {
      page = 1;
      pageSize = options?.limit || defaultPageSize;
    }
    
    const offset = (page - 1) * pageSize;
    
    return {
      page,
      pageSize,
      pagination: {
        limit: pageSize,
        offset
      }
    };
  }

  /**
   * Build paginated result
   */
  protected buildPaginatedResult<T>(
    data: T[], 
    total: number, 
    page: number, 
    pageSize: number
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / pageSize);
    
    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }
}