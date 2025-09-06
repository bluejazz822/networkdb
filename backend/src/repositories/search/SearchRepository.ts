/**
 * Search Repository
 * Handles complex search operations across all network resources
 */

import { Model, ModelStatic, FindOptions, literal, QueryTypes } from 'sequelize';
import { 
  SearchQuery, 
  SearchResult, 
  ResourceType, 
  AutoCompleteQuery,
  AutoCompleteResult,
  SearchFacet,
  FacetValue,
  SEARCHABLE_RESOURCES,
  SearchMetrics
} from '../../types/search';
import { SearchQueryBuilder } from '../../utils/query-builder';
import { sequelize } from '../../database/operations';

export class SearchRepository {
  private models: Map<ResourceType, ModelStatic<Model>> = new Map();

  constructor(
    vpcModel: ModelStatic<Model>,
    transitGatewayModel: ModelStatic<Model>,
    customerGatewayModel: ModelStatic<Model>,
    vpcEndpointModel: ModelStatic<Model>
  ) {
    this.models.set('vpc', vpcModel);
    this.models.set('transitGateway', transitGatewayModel);
    this.models.set('customerGateway', customerGatewayModel);
    this.models.set('vpcEndpoint', vpcEndpointModel);
  }

  /**
   * Execute comprehensive search across specified resource types
   */
  async search<T extends Model>(
    resourceType: ResourceType, 
    searchQuery: SearchQuery
  ): Promise<SearchResult<T>> {
    const startTime = Date.now();

    try {
      if (resourceType === 'all') {
        return await this.searchAllResources<T>(searchQuery);
      }

      const model = this.models.get(resourceType);
      if (!model) {
        throw new Error(`Unsupported resource type: ${resourceType}`);
      }

      const queryBuilder = new SearchQueryBuilder(resourceType);
      
      // Build count query for total results
      const countQuery = queryBuilder.buildCountQuery(searchQuery);
      const totalCount = await model.count(countQuery);

      // Build main search query
      const searchOptions = queryBuilder.buildQuery(searchQuery);
      const results = await model.findAll(searchOptions) as T[];

      // Build facets if requested
      const facets = searchQuery.includeHighlight ? 
        await this.buildFacets(resourceType, searchQuery) : [];

      // Calculate pagination info
      const { page = 1, limit = 20 } = searchQuery.pagination || {};
      const searchTime = Date.now() - startTime;

      return {
        data: results,
        totalCount,
        searchTime,
        facets,
        highlights: [], // TODO: Implement highlighting
        suggestions: [], // TODO: Implement suggestions
        page,
        limit,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1
      };

    } catch (error) {
      console.error(`Search error for ${resourceType}:`, error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Search across all resource types
   */
  private async searchAllResources<T extends Model>(searchQuery: SearchQuery): Promise<SearchResult<T>> {
    const startTime = Date.now();
    const resourceTypes: ResourceType[] = ['vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint'];
    
    // Execute search on all resource types in parallel
    const searchPromises = resourceTypes.map(resourceType => 
      this.search<T>(resourceType, { 
        ...searchQuery, 
        pagination: { ...searchQuery.pagination, limit: 25 } // Limit per resource type
      })
    );

    const results = await Promise.all(searchPromises);

    // Combine results
    const combinedData: T[] = [];
    let totalCount = 0;
    const facets: SearchFacet[] = [];

    for (const result of results) {
      combinedData.push(...result.data);
      totalCount += result.totalCount;
      facets.push(...result.facets || []);
    }

    // Sort combined results by relevance (simplified)
    // In a real implementation, you'd implement proper scoring
    const sortedData = combinedData.slice(0, searchQuery.pagination?.limit || 20);

    const searchTime = Date.now() - startTime;
    const { page = 1, limit = 20 } = searchQuery.pagination || {};

    return {
      data: sortedData,
      totalCount,
      searchTime,
      facets,
      highlights: [],
      suggestions: [],
      page,
      limit,
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1
    };
  }

  /**
   * Build facets for search results
   */
  private async buildFacets(resourceType: ResourceType, searchQuery: SearchQuery): Promise<SearchFacet[]> {
    const searchableResource = SEARCHABLE_RESOURCES[resourceType];
    if (!searchableResource) return [];

    const facetFields = searchableResource.searchableFields
      .filter(field => field.facetable)
      .slice(0, 5); // Limit to 5 facets for performance

    const queryBuilder = new SearchQueryBuilder(resourceType);
    const model = this.models.get(resourceType)!;
    
    const facetPromises = facetFields.map(async field => {
      try {
        const facetQuery = queryBuilder.buildFacetQuery(field.name);
        const results = await model.findAll(facetQuery) as any[];
        
        const values: FacetValue[] = results.map(row => ({
          value: row.value?.toString() || '',
          count: parseInt(row.count) || 0
        }));

        return {
          field: field.name,
          values
        };
      } catch (error) {
        console.error(`Error building facet for field ${field.name}:`, error);
        return {
          field: field.name,
          values: []
        };
      }
    });

    return await Promise.all(facetPromises);
  }

  /**
   * Get auto-complete suggestions for a field
   */
  async getAutoCompleteSuggestions(query: AutoCompleteQuery): Promise<AutoCompleteResult> {
    const startTime = Date.now();
    
    try {
      const { field, resourceType = 'all', term, limit = 10 } = query;

      if (resourceType === 'all') {
        // Get suggestions from all resource types
        const resourceTypes: ResourceType[] = ['vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint'];
        const suggestionPromises = resourceTypes.map(rt => 
          this.getAutoCompleteSuggestions({ ...query, resourceType: rt, limit: 3 })
        );

        const results = await Promise.all(suggestionPromises);
        const allSuggestions = results.flatMap(result => result.suggestions);

        // Deduplicate and sort by score
        const uniqueSuggestions = Array.from(
          new Map(allSuggestions.map(s => [s.value, s])).values()
        ).sort((a, b) => b.score - a.score).slice(0, limit);

        return {
          suggestions: uniqueSuggestions,
          searchTime: Date.now() - startTime
        };
      }

      if (!field) {
        // Get general suggestions for the resource type
        return await this.getGeneralSuggestions(resourceType, term, limit);
      }

      // Get field-specific suggestions
      const model = this.models.get(resourceType);
      if (!model) {
        throw new Error(`Unsupported resource type: ${resourceType}`);
      }

      const queryBuilder = new SearchQueryBuilder(resourceType);
      const autoCompleteQuery = queryBuilder.buildAutoCompleteQuery(field, term, limit);
      const results = await model.findAll(autoCompleteQuery) as any[];

      const suggestions = results.map((row, index) => ({
        text: row.value?.toString() || '',
        value: row.value?.toString() || '',
        type: 'value' as const,
        score: Math.max(0, 1 - (index * 0.1)), // Simple scoring
        metadata: {
          count: parseInt(row.count) || 0,
          field,
          resourceType
        }
      }));

      return {
        suggestions,
        searchTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Auto-complete error:', error);
      return {
        suggestions: [],
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get general search suggestions for a resource type
   */
  private async getGeneralSuggestions(
    resourceType: ResourceType, 
    term: string, 
    limit: number
  ): Promise<AutoCompleteResult> {
    const searchableResource = SEARCHABLE_RESOURCES[resourceType];
    if (!searchableResource) {
      return { suggestions: [], searchTime: 0 };
    }

    const autoCompleteFields = searchableResource.searchableFields
      .filter(field => field.autoComplete)
      .slice(0, 3); // Limit to 3 fields for performance

    const suggestionPromises = autoCompleteFields.map(field => 
      this.getAutoCompleteSuggestions({
        term,
        field: field.name,
        resourceType,
        limit: Math.ceil(limit / autoCompleteFields.length)
      })
    );

    const results = await Promise.all(suggestionPromises);
    const allSuggestions = results.flatMap(result => result.suggestions);

    // Deduplicate and sort
    const uniqueSuggestions = Array.from(
      new Map(allSuggestions.map(s => [s.value, s])).values()
    ).sort((a, b) => b.score - a.score).slice(0, limit);

    return {
      suggestions: uniqueSuggestions,
      searchTime: results.reduce((sum, result) => sum + result.searchTime, 0)
    };
  }

  /**
   * Get popular search terms
   */
  async getPopularSearchTerms(resourceType?: ResourceType, limit: number = 10): Promise<string[]> {
    try {
      // This would typically come from search analytics/logs
      // For now, return some common terms based on resource type
      const popularTerms: Record<ResourceType, string[]> = {
        vpc: ['prod', 'dev', 'staging', 'us-east-1', 'us-west-2', 'available'],
        transitGateway: ['prod', 'dev', 'available', 'us-east-1', 'shared'],
        customerGateway: ['vpn', 'prod', 'available', 'bgp', 'static'],
        vpcEndpoint: ['s3', 'ec2', 'lambda', 'available', 'interface'],
        all: ['prod', 'dev', 'available', 'us-east-1', 'staging']
      };

      return popularTerms[resourceType || 'all'].slice(0, limit);
    } catch (error) {
      console.error('Error getting popular search terms:', error);
      return [];
    }
  }

  /**
   * Get search analytics and metrics
   */
  async getSearchMetrics(): Promise<SearchMetrics> {
    try {
      // This would typically aggregate from search logs/analytics
      // For now, return mock data
      return {
        queryCount: 1250,
        averageResponseTime: 142,
        slowQueries: [],
        popularFields: [
          { field: 'name', count: 450, averageResponseTime: 89 },
          { field: 'region', count: 380, averageResponseTime: 67 },
          { field: 'state', count: 290, averageResponseTime: 45 },
          { field: 'environment', count: 220, averageResponseTime: 78 },
          { field: 'owner', count: 180, averageResponseTime: 92 }
        ],
        cacheHitRate: 0.73
      };
    } catch (error) {
      console.error('Error getting search metrics:', error);
      return {
        queryCount: 0,
        averageResponseTime: 0,
        slowQueries: [],
        popularFields: [],
        cacheHitRate: 0
      };
    }
  }

  /**
   * Validate search query
   */
  validateSearchQuery(resourceType: ResourceType, searchQuery: SearchQuery): string[] {
    const errors: string[] = [];
    const searchableResource = SEARCHABLE_RESOURCES[resourceType];

    if (!searchableResource && resourceType !== 'all') {
      errors.push(`Unsupported resource type: ${resourceType}`);
      return errors;
    }

    // Validate filters
    if (searchQuery.filters) {
      for (const filter of searchQuery.filters) {
        if (resourceType !== 'all') {
          const field = searchableResource.searchableFields.find(f => f.name === filter.field);
          if (!field) {
            errors.push(`Field '${filter.field}' is not searchable for ${resourceType}`);
          }
        }

        // Validate filter values
        if (filter.operator === 'in' || filter.operator === 'nin') {
          if (!filter.values || !Array.isArray(filter.values)) {
            errors.push(`Filter operator '${filter.operator}' requires 'values' array`);
          }
        } else if (filter.operator === 'between') {
          if (!filter.values || filter.values.length < 2) {
            errors.push(`Filter operator 'between' requires at least 2 values`);
          }
        }
      }
    }

    // Validate sorting
    if (searchQuery.sorting) {
      for (const sort of searchQuery.sorting) {
        if (resourceType !== 'all') {
          const field = searchableResource.searchableFields.find(f => f.name === sort.field);
          if (!field) {
            errors.push(`Field '${sort.field}' is not sortable for ${resourceType}`);
          } else if (!field.sortable) {
            errors.push(`Field '${sort.field}' is not configured as sortable`);
          }
        }
      }
    }

    // Validate pagination
    if (searchQuery.pagination) {
      const { page, limit } = searchQuery.pagination;
      if (page && page < 1) {
        errors.push('Page number must be greater than 0');
      }
      if (limit && (limit < 1 || limit > 1000)) {
        errors.push('Limit must be between 1 and 1000');
      }
    }

    return errors;
  }

  /**
   * Get suggested indexes for optimization
   */
  getSuggestedIndexes(resourceType: ResourceType): string[] {
    const searchableResource = SEARCHABLE_RESOURCES[resourceType];
    if (!searchableResource) return [];

    const indexes: string[] = [];

    // Suggest indexes for indexed fields
    const indexedFields = searchableResource.searchableFields.filter(field => field.indexed);
    for (const field of indexedFields) {
      indexes.push(`CREATE INDEX idx_${searchableResource.tableName.toLowerCase()}_${field.name} ON ${searchableResource.tableName} (${field.name});`);
    }

    // Suggest composite indexes for common field combinations
    if (indexedFields.length > 1) {
      const compositeFields = indexedFields.slice(0, 3).map(f => f.name).join(', ');
      indexes.push(`CREATE INDEX idx_${searchableResource.tableName.toLowerCase()}_composite ON ${searchableResource.tableName} (${compositeFields});`);
    }

    // Suggest full-text index for text fields
    const textFields = searchableResource.searchableFields
      .filter(field => field.type === 'text')
      .slice(0, 5); // MySQL has a limit on FULLTEXT index fields

    if (textFields.length > 0) {
      const fulltextFields = textFields.map(f => f.name).join(', ');
      indexes.push(`CREATE FULLTEXT INDEX idx_${searchableResource.tableName.toLowerCase()}_fulltext ON ${searchableResource.tableName} (${fulltextFields});`);
    }

    return indexes;
  }
}