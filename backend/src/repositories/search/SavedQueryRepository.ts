/**
 * Saved Query Repository
 * Handles CRUD operations for saved search queries
 */

import { WhereOptions, Op, FindOptions } from 'sequelize';
import { SavedQuery } from '../../models/SavedQuery';
import { BaseRepository } from '../BaseRepository';
import { 
  SavedQuery as SavedQueryType, 
  SearchStats, 
  PopularQuery,
  ResourceType 
} from '../../types/search';

interface SavedQueryCreateInput {
  name: string;
  description?: string;
  query: object;
  userId: string;
  isPublic?: boolean;
  tags?: string[];
  resourceType: ResourceType;
}

interface SavedQueryUpdateInput {
  name?: string;
  description?: string;
  query?: object;
  isPublic?: boolean;
  tags?: string[];
  resourceType?: ResourceType;
}

export class SavedQueryRepository extends BaseRepository<
  SavedQuery,
  SavedQueryCreateInput,
  SavedQueryUpdateInput
> {
  constructor() {
    super(SavedQuery);
  }

  /**
   * Find saved queries by user ID
   */
  async findByUserId(
    userId: string, 
    resourceType?: ResourceType,
    options?: { limit?: number; offset?: number }
  ): Promise<SavedQuery[]> {
    try {
      const where: WhereOptions = { userId };
      
      if (resourceType && resourceType !== 'all') {
        where.resourceType = resourceType;
      }

      return await this.model.findAll({
        where,
        order: [
          ['lastUsedAt', 'DESC'],
          ['useCount', 'DESC'],
          ['createdAt', 'DESC']
        ],
        limit: options?.limit || 50,
        offset: options?.offset || 0
      });
    } catch (error) {
      throw new Error(`Failed to find saved queries by user ID: ${error.message}`);
    }
  }

  /**
   * Find public saved queries
   */
  async findPublicQueries(
    resourceType?: ResourceType,
    options?: { limit?: number; offset?: number }
  ): Promise<SavedQuery[]> {
    try {
      const where: WhereOptions = { isPublic: true };
      
      if (resourceType && resourceType !== 'all') {
        where.resourceType = resourceType;
      }

      return await this.model.findAll({
        where,
        order: [
          ['useCount', 'DESC'],
          ['lastUsedAt', 'DESC'],
          ['createdAt', 'DESC']
        ],
        limit: options?.limit || 20,
        offset: options?.offset || 0
      });
    } catch (error) {
      throw new Error(`Failed to find public queries: ${error.message}`);
    }
  }

  /**
   * Find popular queries across all users
   */
  async findPopularQueries(
    resourceType?: ResourceType,
    limit: number = 10
  ): Promise<PopularQuery[]> {
    try {
      const where: WhereOptions = {
        useCount: { [Op.gt]: 0 },
        isPublic: true
      };
      
      if (resourceType && resourceType !== 'all') {
        where.resourceType = resourceType;
      }

      const queries = await this.model.findAll({
        where,
        attributes: ['name', 'query', 'useCount', 'lastUsedAt'],
        order: [
          ['useCount', 'DESC'],
          ['lastUsedAt', 'DESC']
        ],
        limit
      });

      return queries.map(query => ({
        query: query.name,
        count: query.useCount,
        lastUsed: query.lastUsedAt || query.createdAt
      }));
    } catch (error) {
      throw new Error(`Failed to find popular queries: ${error.message}`);
    }
  }

  /**
   * Find queries by tags
   */
  async findByTags(
    tags: string[],
    userId?: string,
    includePublic: boolean = true
  ): Promise<SavedQuery[]> {
    try {
      let where: WhereOptions = {};

      // Handle access control
      if (userId && includePublic) {
        where = {
          [Op.or]: [
            { userId },
            { isPublic: true }
          ]
        };
      } else if (userId) {
        where.userId = userId;
      } else if (includePublic) {
        where.isPublic = true;
      }

      // For MySQL JSON array overlap, we need to use a raw query or JSON functions
      // This is a simplified approach - in production you'd use proper JSON queries
      const queries = await this.model.findAll({
        where,
        order: [['useCount', 'DESC'], ['name', 'ASC']]
      });

      // Filter by tags in application code (not ideal for large datasets)
      return queries.filter(query => {
        const queryTags = query.tags || [];
        return tags.some(tag => queryTags.includes(tag));
      });
    } catch (error) {
      throw new Error(`Failed to find queries by tags: ${error.message}`);
    }
  }

  /**
   * Search queries by name or description
   */
  async searchByName(
    searchTerm: string,
    userId?: string,
    includePublic: boolean = true
  ): Promise<SavedQuery[]> {
    try {
      let where: WhereOptions = {
        [Op.or]: [
          { name: { [Op.like]: `%${searchTerm}%` } },
          { description: { [Op.like]: `%${searchTerm}%` } }
        ]
      };

      // Handle access control
      if (userId && includePublic) {
        where = {
          [Op.and]: [
            where,
            {
              [Op.or]: [
                { userId },
                { isPublic: true }
              ]
            }
          ]
        };
      } else if (userId) {
        where = {
          [Op.and]: [where, { userId }]
        };
      } else if (includePublic) {
        where = {
          [Op.and]: [where, { isPublic: true }]
        };
      }

      return await this.model.findAll({
        where,
        order: [['useCount', 'DESC'], ['name', 'ASC']]
      });
    } catch (error) {
      throw new Error(`Failed to search queries by name: ${error.message}`);
    }
  }

  /**
   * Get recent queries by user
   */
  async getRecentQueries(userId: string, limit: number = 10): Promise<SavedQuery[]> {
    try {
      return await this.model.findAll({
        where: { 
          userId,
          lastUsedAt: { [Op.ne]: null }
        },
        order: [['lastUsedAt', 'DESC']],
        limit
      });
    } catch (error) {
      throw new Error(`Failed to get recent queries: ${error.message}`);
    }
  }

  /**
   * Increment use count for a query
   */
  async incrementUseCount(queryId: number): Promise<SavedQuery | null> {
    try {
      const query = await this.findById(queryId.toString());
      if (!query) {
        return null;
      }

      await query.update({
        useCount: query.useCount + 1,
        lastUsedAt: new Date()
      });

      return query;
    } catch (error) {
      throw new Error(`Failed to increment use count: ${error.message}`);
    }
  }

  /**
   * Check if user can access a query
   */
  async canUserAccess(queryId: number, userId: string): Promise<boolean> {
    try {
      const query = await this.findById(queryId.toString());
      if (!query) {
        return false;
      }

      return query.userId === userId || query.isPublic;
    } catch (error) {
      console.error(`Error checking query access: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if query name exists for user
   */
  async nameExistsForUser(name: string, userId: string, excludeId?: number): Promise<boolean> {
    try {
      const where: WhereOptions = {
        name,
        userId
      };

      if (excludeId) {
        where.id = { [Op.ne]: excludeId };
      }

      const count = await this.model.count({ where });
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check if name exists: ${error.message}`);
    }
  }

  /**
   * Get query statistics
   */
  async getQueryStats(userId?: string): Promise<SearchStats> {
    try {
      const where: WhereOptions = {};
      if (userId) {
        where.userId = userId;
      }

      // Get total query count
      const totalSearches = await this.model.count({ where });

      // Get popular queries
      const popularQueries = await this.findPopularQueries('all', 10);

      // Get recent queries (if user specified)
      let recentQueries: SavedQuery[] = [];
      if (userId) {
        recentQueries = await this.getRecentQueries(userId, 10);
      }

      // Calculate average response time (mock data - in real implementation this would come from metrics)
      const averageResponseTime = 150;

      return {
        popularQueries,
        recentQueries: recentQueries.map(q => ({
          id: q.id,
          name: q.name,
          description: q.description,
          query: q.query,
          userId: q.userId,
          isPublic: q.isPublic,
          tags: q.tags,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
          lastUsedAt: q.lastUsedAt,
          useCount: q.useCount
        })),
        totalSearches,
        averageResponseTime
      };
    } catch (error) {
      throw new Error(`Failed to get query stats: ${error.message}`);
    }
  }

  /**
   * Clone a public query for a user
   */
  async cloneQuery(
    queryId: number, 
    userId: string, 
    newName?: string
  ): Promise<SavedQuery | null> {
    try {
      const originalQuery = await this.findById(queryId.toString());
      if (!originalQuery || !originalQuery.isPublic) {
        return null;
      }

      const clonedData: SavedQueryCreateInput = {
        name: newName || `${originalQuery.name} (Copy)`,
        description: originalQuery.description || undefined,
        query: originalQuery.query,
        userId,
        isPublic: false,
        tags: [...(originalQuery.tags || [])],
        resourceType: originalQuery.resourceType
      };

      return await this.create(clonedData);
    } catch (error) {
      throw new Error(`Failed to clone query: ${error.message}`);
    }
  }

  /**
   * Build search where clause for repository search functionality
   */
  protected buildSearchWhere(search: string, existingWhere: WhereOptions): WhereOptions {
    const searchConditions = {
      [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ]
    };

    if (Object.keys(existingWhere).length > 0) {
      return {
        [Op.and]: [existingWhere, searchConditions]
      };
    }

    return searchConditions;
  }

  /**
   * Get all unique tags used in saved queries
   */
  async getAllTags(userId?: string): Promise<string[]> {
    try {
      const where: WhereOptions = {};
      
      if (userId) {
        where[Op.or] = [
          { userId },
          { isPublic: true }
        ];
      } else {
        where.isPublic = true;
      }

      const queries = await this.model.findAll({
        where,
        attributes: ['tags']
      });

      const allTags = new Set<string>();
      queries.forEach(query => {
        if (query.tags && Array.isArray(query.tags)) {
          query.tags.forEach(tag => allTags.add(tag));
        }
      });

      return Array.from(allTags).sort();
    } catch (error) {
      throw new Error(`Failed to get all tags: ${error.message}`);
    }
  }
}