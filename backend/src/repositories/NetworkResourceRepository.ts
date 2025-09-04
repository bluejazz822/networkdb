/**
 * Abstract base repository class for AWS network resources
 * Extends BaseRepository with AWS-specific functionality
 */

import { Model, WhereOptions, Op } from 'sequelize';
import { BaseRepository } from './BaseRepository';
import { 
  INetworkResourceRepository, 
  QueryOptions, 
  PaginatedResult 
} from './interfaces/IBaseRepository';

/**
 * Interface for network resource models (common AWS fields)
 */
export interface INetworkResourceModel {
  id: string;
  awsAccountId: string;
  region: string;
  state: string;
  environment?: string;
  project?: string;
  owner?: string;
  name?: string;
  tags?: Record<string, any>;
  lastSyncAt?: Date;
  syncVersion: number;
  sourceSystem: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Abstract network resource repository with AWS-specific operations
 */
export abstract class NetworkResourceRepository<
  TModel extends Model & INetworkResourceModel,
  TCreateInput,
  TUpdateInput
> extends BaseRepository<TModel, TCreateInput, TUpdateInput>
  implements INetworkResourceRepository<TModel, TCreateInput, TUpdateInput> {

  /**
   * Get the AWS ID field name for this resource type
   */
  protected abstract getAwsIdField(): string;

  /**
   * Find by AWS resource ID
   */
  async findByAwsId(awsId: string): Promise<TModel | null> {
    try {
      const awsIdField = this.getAwsIdField();
      return await this.model.findOne({
        where: { [awsIdField]: awsId } as WhereOptions
      });
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name} by AWS ID ${awsId}: ${error.message}`);
    }
  }

  /**
   * Find all resources in a specific AWS account
   */
  async findByAccount(awsAccountId: string, options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      return await this.findBy({ awsAccountId }, options);
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name}s by account ${awsAccountId}: ${error.message}`);
    }
  }

  /**
   * Find all resources in a specific AWS region
   */
  async findByRegion(region: string, options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      return await this.findBy({ region }, options);
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name}s by region ${region}: ${error.message}`);
    }
  }

  /**
   * Find resources by account and region
   */
  async findByAccountAndRegion(
    awsAccountId: string, 
    region: string, 
    options?: QueryOptions
  ): Promise<PaginatedResult<TModel>> {
    try {
      return await this.findBy({ awsAccountId, region }, options);
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name}s by account ${awsAccountId} and region ${region}: ${error.message}`);
    }
  }

  /**
   * Find resources by environment
   */
  async findByEnvironment(environment: string, options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      return await this.findBy({ environment }, options);
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name}s by environment ${environment}: ${error.message}`);
    }
  }

  /**
   * Find resources by project
   */
  async findByProject(project: string, options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      return await this.findBy({ project }, options);
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name}s by project ${project}: ${error.message}`);
    }
  }

  /**
   * Find resources that need synchronization (older than specified date)
   */
  async findStale(olderThan: Date, options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      const where: WhereOptions = {
        [Op.or]: [
          { lastSyncAt: null },
          { lastSyncAt: { [Op.lt]: olderThan } }
        ]
      };
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find stale ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Update sync information for a resource
   */
  async updateSyncInfo(awsId: string, syncData: { lastSyncAt: Date; syncVersion?: number }): Promise<boolean> {
    try {
      const awsIdField = this.getAwsIdField();
      const updateData: any = { 
        lastSyncAt: syncData.lastSyncAt 
      };
      
      if (syncData.syncVersion !== undefined) {
        updateData.syncVersion = syncData.syncVersion;
      }
      
      const [updatedCount] = await this.model.update(
        updateData,
        { 
          where: { [awsIdField]: awsId } as WhereOptions
        }
      );
      
      return updatedCount > 0;
    } catch (error) {
      throw new Error(`Failed to update sync info for ${this.model.name} with AWS ID ${awsId}: ${error.message}`);
    }
  }

  /**
   * Find resources by tags
   */
  async findByTags(tags: Record<string, string>, options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      // Build where clause for JSON tag matching
      const where: WhereOptions = {};
      
      // For each tag, create a JSON query condition
      for (const [key, value] of Object.entries(tags)) {
        where[`tags.${key}`] = value;
      }
      
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name}s by tags: ${error.message}`);
    }
  }

  /**
   * Find resources by state
   */
  async findByState(state: string, options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      return await this.findBy({ state }, options);
    } catch (error) {
      throw new Error(`Failed to find ${this.model.name}s by state ${state}: ${error.message}`);
    }
  }

  /**
   * Find active resources (not in terminated/deleted states)
   */
  async findActive(options?: QueryOptions): Promise<PaginatedResult<TModel>> {
    try {
      const where: WhereOptions = {
        state: {
          [Op.notIn]: ['terminated', 'deleted', 'deleting']
        }
      };
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find active ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Get resource statistics by account and region
   */
  async getStatsByAccountAndRegion(): Promise<Array<{
    awsAccountId: string;
    region: string;
    count: number;
  }>> {
    try {
      const results = await this.model.findAll({
        attributes: [
          'awsAccountId',
          'region',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['awsAccountId', 'region'],
        raw: true
      }) as any[];
      
      return results.map(result => ({
        awsAccountId: result.awsAccountId,
        region: result.region,
        count: parseInt(result.count)
      }));
    } catch (error) {
      throw new Error(`Failed to get statistics for ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Get resource statistics by environment
   */
  async getStatsByEnvironment(): Promise<Array<{
    environment: string | null;
    count: number;
  }>> {
    try {
      const results = await this.model.findAll({
        attributes: [
          'environment',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['environment'],
        raw: true
      }) as any[];
      
      return results.map(result => ({
        environment: result.environment,
        count: parseInt(result.count)
      }));
    } catch (error) {
      throw new Error(`Failed to get environment statistics for ${this.model.name}s: ${error.message}`);
    }
  }

  /**
   * Default search implementation for network resources
   * Searches across name, description, AWS ID, and tags
   */
  protected buildSearchWhere(search: string, existingWhere: WhereOptions): WhereOptions {
    const awsIdField = this.getAwsIdField();
    const searchPattern = `%${search}%`;
    
    return {
      ...existingWhere,
      [Op.or]: [
        { name: { [Op.iLike]: searchPattern } },
        { description: { [Op.iLike]: searchPattern } },
        { [awsIdField]: { [Op.iLike]: searchPattern } },
        { project: { [Op.iLike]: searchPattern } },
        { owner: { [Op.iLike]: searchPattern } },
        { environment: { [Op.iLike]: searchPattern } }
        // Note: Tag searching would need special JSON query handling
        // This can be extended based on specific database capabilities
      ]
    };
  }
}