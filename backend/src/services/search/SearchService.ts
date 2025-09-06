/**
 * Search Service
 * Main service for handling comprehensive search functionality
 */

import { 
  SearchQuery, 
  SearchResult, 
  ResourceType, 
  AutoCompleteQuery,
  AutoCompleteResult,
  SearchMetrics,
  SearchError,
  SearchErrorCode,
  DEFAULT_SEARCH_CONFIG
} from '../../types/search';
import { ServiceResponse, BaseService } from '../BaseService';
import { SearchRepository } from '../../repositories/search/SearchRepository';
import { SavedQueryRepository } from '../../repositories/search/SavedQueryRepository';
import { 
  Vpc, 
  TransitGateway, 
  CustomerGateway, 
  VpcEndpoint,
  SavedQuery
} from '../../models';

export class SearchService extends BaseService<any, any> {
  private searchRepository: SearchRepository;
  private savedQueryRepository: SavedQueryRepository;
  private config = DEFAULT_SEARCH_CONFIG;

  constructor(
    vpcModel: typeof Vpc,
    transitGatewayModel: typeof TransitGateway,
    customerGatewayModel: typeof CustomerGateway,
    vpcEndpointModel: typeof VpcEndpoint
  ) {
    // BaseService requires a repository, but we use our own repositories
    super({} as any);
    
    this.searchRepository = new SearchRepository(
      vpcModel,
      transitGatewayModel,
      customerGatewayModel,
      vpcEndpointModel
    );
    this.savedQueryRepository = new SavedQueryRepository();
  }

  /**
   * Execute a comprehensive search across network resources
   */
  async search<T>(
    resourceType: ResourceType,
    searchQuery: SearchQuery,
    userId?: string
  ): Promise<ServiceResponse<SearchResult<T>>> {
    const startTime = Date.now();

    try {
      // Validate search query
      const validationErrors = this.validateSearchQuery(resourceType, searchQuery);
      if (validationErrors.length > 0) {
        return this.createErrorResponse(
          validationErrors.map(error => ({
            code: 'INVALID_SEARCH_QUERY' as SearchErrorCode,
            message: error
          }))
        );
      }

      // Apply default pagination if not provided
      if (!searchQuery.pagination) {
        searchQuery.pagination = {
          page: 1,
          limit: this.config.defaultPageSize
        };
      }

      // Execute search
      const searchResult = await this.searchRepository.search<T>(resourceType, searchQuery);

      // Log the operation for analytics
      this.logOperation('SEARCH', resourceType, undefined, userId, {
        query: searchQuery,
        resultCount: searchResult.totalCount,
        searchTime: searchResult.searchTime
      });

      return this.createSuccessResponse(searchResult);

    } catch (error) {
      console.error('Search service error:', error);
      return this.createSingleErrorResponse(
        'SEARCH_TIMEOUT',
        `Search failed: ${error.message}`
      );
    }
  }

  /**
   * Get auto-complete suggestions
   */
  async getAutoComplete(
    query: AutoCompleteQuery,
    userId?: string
  ): Promise<ServiceResponse<AutoCompleteResult>> {
    try {
      if (!this.config.autoCompleteEnabled) {
        return this.createSingleErrorResponse(
          'UNSUPPORTED_FIELD',
          'Auto-complete is disabled'
        );
      }

      if (!query.term || query.term.trim().length === 0) {
        return this.createSuccessResponse({
          suggestions: [],
          searchTime: 0
        });
      }

      // Limit term length for performance
      if (query.term.length > 100) {
        query.term = query.term.substring(0, 100);
      }

      const result = await this.searchRepository.getAutoCompleteSuggestions(query);

      this.logOperation('AUTOCOMPLETE', query.resourceType || 'all', undefined, userId, {
        term: query.term,
        field: query.field,
        suggestionCount: result.suggestions.length
      });

      return this.createSuccessResponse(result);

    } catch (error) {
      console.error('Auto-complete error:', error);
      return this.createSingleErrorResponse(
        'SEARCH_TIMEOUT',
        `Auto-complete failed: ${error.message}`
      );
    }
  }

  /**
   * Get popular search terms
   */
  async getPopularTerms(
    resourceType?: ResourceType,
    limit: number = 10
  ): Promise<ServiceResponse<string[]>> {
    try {
      const terms = await this.searchRepository.getPopularSearchTerms(resourceType, limit);
      return this.createSuccessResponse(terms);
    } catch (error) {
      console.error('Error getting popular terms:', error);
      return this.createSingleErrorResponse(
        'SEARCH_TIMEOUT',
        `Failed to get popular terms: ${error.message}`
      );
    }
  }

  /**
   * Get search metrics and analytics
   */
  async getSearchMetrics(): Promise<ServiceResponse<SearchMetrics>> {
    try {
      const metrics = await this.searchRepository.getSearchMetrics();
      return this.createSuccessResponse(metrics);
    } catch (error) {
      console.error('Error getting search metrics:', error);
      return this.createSingleErrorResponse(
        'SEARCH_TIMEOUT',
        `Failed to get search metrics: ${error.message}`
      );
    }
  }

  /**
   * Save a search query
   */
  async saveQuery(
    data: {
      name: string;
      description?: string;
      query: SearchQuery;
      resourceType: ResourceType;
      isPublic?: boolean;
      tags?: string[];
    },
    userId: string
  ): Promise<ServiceResponse<SavedQuery>> {
    try {
      // Check if name already exists for user
      const nameExists = await this.savedQueryRepository.nameExistsForUser(data.name, userId);
      if (nameExists) {
        return this.createSingleErrorResponse(
          'DUPLICATE_RECORD',
          `A saved query with the name '${data.name}' already exists`
        );
      }

      // Validate the search query
      const validationErrors = this.validateSearchQuery(data.resourceType, data.query);
      if (validationErrors.length > 0) {
        return this.createErrorResponse(
          validationErrors.map(error => ({
            code: 'INVALID_SEARCH_QUERY' as SearchErrorCode,
            message: error
          }))
        );
      }

      const savedQuery = await this.savedQueryRepository.create({
        name: data.name,
        description: data.description,
        query: data.query,
        userId,
        isPublic: data.isPublic || false,
        tags: data.tags || [],
        resourceType: data.resourceType
      });

      this.logOperation('SAVE_QUERY', data.resourceType, savedQuery.id, userId, {
        queryName: data.name,
        isPublic: data.isPublic
      });

      return this.createSuccessResponse(savedQuery);

    } catch (error) {
      console.error('Save query error:', error);
      return this.handleDatabaseError(error)[0] ? 
        this.createErrorResponse(this.handleDatabaseError(error)) :
        this.createSingleErrorResponse(
          'DATABASE_ERROR',
          `Failed to save query: ${error.message}`
        );
    }
  }

  /**
   * Update a saved query
   */
  async updateSavedQuery(
    queryId: number,
    data: {
      name?: string;
      description?: string;
      query?: SearchQuery;
      isPublic?: boolean;
      tags?: string[];
    },
    userId: string
  ): Promise<ServiceResponse<SavedQuery>> {
    try {
      // Check if user can access the query
      const canAccess = await this.savedQueryRepository.canUserAccess(queryId, userId);
      if (!canAccess) {
        return this.createSingleErrorResponse(
          'PERMISSION_DENIED',
          'You do not have permission to update this query'
        );
      }

      // Get the existing query to check ownership
      const existingQuery = await this.savedQueryRepository.findById(queryId.toString());
      if (!existingQuery) {
        return this.createSingleErrorResponse(
          'SAVED_QUERY_NOT_FOUND',
          'Saved query not found'
        );
      }

      // Only the owner can update
      if (existingQuery.userId !== userId) {
        return this.createSingleErrorResponse(
          'PERMISSION_DENIED',
          'Only the query owner can update it'
        );
      }

      // Check name uniqueness if name is being changed
      if (data.name && data.name !== existingQuery.name) {
        const nameExists = await this.savedQueryRepository.nameExistsForUser(
          data.name, 
          userId, 
          queryId
        );
        if (nameExists) {
          return this.createSingleErrorResponse(
            'DUPLICATE_RECORD',
            `A saved query with the name '${data.name}' already exists`
          );
        }
      }

      // Validate query if it's being updated
      if (data.query) {
        const validationErrors = this.validateSearchQuery(existingQuery.resourceType, data.query);
        if (validationErrors.length > 0) {
          return this.createErrorResponse(
            validationErrors.map(error => ({
              code: 'INVALID_SEARCH_QUERY' as SearchErrorCode,
              message: error
            }))
          );
        }
      }

      const updatedQuery = await this.savedQueryRepository.updateById(queryId.toString(), data);
      if (!updatedQuery) {
        return this.createSingleErrorResponse(
          'SAVED_QUERY_NOT_FOUND',
          'Failed to update query'
        );
      }

      this.logOperation('UPDATE_QUERY', existingQuery.resourceType, queryId, userId, {
        changes: Object.keys(data)
      });

      return this.createSuccessResponse(updatedQuery);

    } catch (error) {
      console.error('Update saved query error:', error);
      return this.createSingleErrorResponse(
        'DATABASE_ERROR',
        `Failed to update query: ${error.message}`
      );
    }
  }

  /**
   * Delete a saved query
   */
  async deleteSavedQuery(queryId: number, userId: string): Promise<ServiceResponse<boolean>> {
    try {
      const existingQuery = await this.savedQueryRepository.findById(queryId.toString());
      if (!existingQuery) {
        return this.createSingleErrorResponse(
          'SAVED_QUERY_NOT_FOUND',
          'Saved query not found'
        );
      }

      // Only the owner can delete
      if (existingQuery.userId !== userId) {
        return this.createSingleErrorResponse(
          'PERMISSION_DENIED',
          'Only the query owner can delete it'
        );
      }

      const deleted = await this.savedQueryRepository.deleteById(queryId.toString());
      
      if (deleted) {
        this.logOperation('DELETE_QUERY', existingQuery.resourceType, queryId, userId);
      }

      return this.createSuccessResponse(deleted);

    } catch (error) {
      console.error('Delete saved query error:', error);
      return this.createSingleErrorResponse(
        'DATABASE_ERROR',
        `Failed to delete query: ${error.message}`
      );
    }
  }

  /**
   * Get saved queries for a user
   */
  async getSavedQueries(
    userId: string,
    resourceType?: ResourceType,
    includePublic: boolean = true
  ): Promise<ServiceResponse<SavedQuery[]>> {
    try {
      let userQueries = await this.savedQueryRepository.findByUserId(userId, resourceType);
      
      if (includePublic) {
        const publicQueries = await this.savedQueryRepository.findPublicQueries(resourceType);
        // Filter out queries already owned by user
        const filteredPublicQueries = publicQueries.filter(pq => pq.userId !== userId);
        userQueries = [...userQueries, ...filteredPublicQueries];
      }

      return this.createSuccessResponse(userQueries);

    } catch (error) {
      console.error('Get saved queries error:', error);
      return this.createSingleErrorResponse(
        'DATABASE_ERROR',
        `Failed to get saved queries: ${error.message}`
      );
    }
  }

  /**
   * Execute a saved query
   */
  async executeSavedQuery<T>(
    queryId: number, 
    userId?: string,
    overrides?: Partial<SearchQuery>
  ): Promise<ServiceResponse<SearchResult<T>>> {
    try {
      const savedQuery = await this.savedQueryRepository.findById(queryId.toString());
      if (!savedQuery) {
        return this.createSingleErrorResponse(
          'SAVED_QUERY_NOT_FOUND',
          'Saved query not found'
        );
      }

      // Check access permissions
      if (!savedQuery.canBeAccessedBy(userId || '')) {
        return this.createSingleErrorResponse(
          'PERMISSION_DENIED',
          'You do not have permission to execute this query'
        );
      }

      // Increment use count
      await this.savedQueryRepository.incrementUseCount(queryId);

      // Merge saved query with any overrides
      const searchQuery: SearchQuery = {
        ...savedQuery.query as SearchQuery,
        ...overrides
      };

      // Execute the search
      const result = await this.search<T>(savedQuery.resourceType, searchQuery, userId);

      this.logOperation('EXECUTE_SAVED_QUERY', savedQuery.resourceType, queryId, userId, {
        queryName: savedQuery.name
      });

      return result;

    } catch (error) {
      console.error('Execute saved query error:', error);
      return this.createSingleErrorResponse(
        'DATABASE_ERROR',
        `Failed to execute saved query: ${error.message}`
      );
    }
  }

  /**
   * Validate search query
   */
  private validateSearchQuery(resourceType: ResourceType, searchQuery: SearchQuery): string[] {
    return this.searchRepository.validateSearchQuery(resourceType, searchQuery);
  }

  // Required by BaseService but not used
  async create(): Promise<ServiceResponse<any>> {
    throw new Error('Not implemented');
  }

  async findById(): Promise<ServiceResponse<any>> {
    throw new Error('Not implemented');
  }

  async update(): Promise<ServiceResponse<any>> {
    throw new Error('Not implemented');
  }

  async delete(): Promise<ServiceResponse<boolean>> {
    throw new Error('Not implemented');
  }

  async findAll(): Promise<ServiceResponse<any>> {
    throw new Error('Not implemented');
  }
}