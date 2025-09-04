/**
 * Advanced Search Query Builder
 * Builds complex SQL queries with filtering, sorting, and full-text search for MySQL/Sequelize
 */

import { Op, WhereOptions, OrderItem, FindOptions, literal } from 'sequelize';
import { 
  SearchQuery, 
  SearchFilter, 
  FilterOperator, 
  LogicalOperator, 
  ResourceType,
  SortOptions,
  SEARCHABLE_RESOURCES,
  SearchableField,
  QueryExecutionPlan
} from '../../types/search';

export class SearchQueryBuilder {
  private resourceType: ResourceType;
  private searchableFields: SearchableField[];

  constructor(resourceType: ResourceType) {
    this.resourceType = resourceType;
    this.searchableFields = SEARCHABLE_RESOURCES[resourceType]?.searchableFields || [];
  }

  /**
   * Build complete Sequelize FindOptions from SearchQuery
   */
  public buildQuery(searchQuery: SearchQuery): FindOptions {
    const options: FindOptions = {};

    // Build WHERE clause from filters and text search
    options.where = this.buildWhereClause(searchQuery);

    // Add sorting
    if (searchQuery.sorting && searchQuery.sorting.length > 0) {
      options.order = this.buildOrderClause(searchQuery.sorting);
    }

    // Add pagination
    if (searchQuery.pagination) {
      const { page = 1, limit = 20 } = searchQuery.pagination;
      options.limit = Math.min(1000, Math.max(1, limit));
      options.offset = (Math.max(1, page) - 1) * options.limit;
    }

    return options;
  }

  /**
   * Build WHERE clause combining text search and filters
   */
  private buildWhereClause(searchQuery: SearchQuery): WhereOptions {
    const conditions: WhereOptions[] = [];

    // Add full-text search conditions
    if (searchQuery.text && searchQuery.text.trim()) {
      const textConditions = this.buildTextSearchConditions(searchQuery.text);
      if (textConditions) {
        conditions.push(textConditions);
      }
    }

    // Add filter conditions
    if (searchQuery.filters && searchQuery.filters.length > 0) {
      const filterConditions = this.buildFilterConditions(searchQuery.filters);
      if (filterConditions) {
        conditions.push(filterConditions);
      }
    }

    // Combine all conditions with AND
    if (conditions.length === 0) {
      return {};
    } else if (conditions.length === 1) {
      return conditions[0];
    } else {
      return { [Op.and]: conditions };
    }
  }

  /**
   * Build full-text search conditions across searchable fields
   */
  private buildTextSearchConditions(searchText: string): WhereOptions | null {
    if (!searchText || !searchText.trim()) {
      return null;
    }

    const textFields = this.searchableFields.filter(field => 
      field.type === 'text' && field.name !== 'tags'
    );

    if (textFields.length === 0) {
      return null;
    }

    // For MySQL, we'll use LIKE with wildcards for full-text search
    // This could be optimized with MySQL FULLTEXT indexes later
    const searchTerm = searchText.trim();
    const searchConditions = textFields.map(field => ({
      [field.name]: {
        [Op.like]: `%${searchTerm}%`
      }
    }));

    // Also search in JSON tags field if it exists
    const tagsField = this.searchableFields.find(field => field.name === 'tags');
    if (tagsField) {
      // For JSON search in MySQL, we use JSON functions
      searchConditions.push(
        literal(`JSON_SEARCH(tags, 'all', '%${searchTerm}%') IS NOT NULL`)
      );
    }

    return { [Op.or]: searchConditions };
  }

  /**
   * Build filter conditions from SearchFilter array
   */
  private buildFilterConditions(filters: SearchFilter[]): WhereOptions | null {
    if (!filters || filters.length === 0) {
      return null;
    }

    // Group filters by logical operator
    const andFilters: SearchFilter[] = [];
    const orFilters: SearchFilter[] = [];
    const notFilters: SearchFilter[] = [];

    for (const filter of filters) {
      switch (filter.logicalOperator) {
        case 'OR':
          orFilters.push(filter);
          break;
        case 'NOT':
          notFilters.push(filter);
          break;
        default:
          andFilters.push(filter);
      }
    }

    const conditions: WhereOptions[] = [];

    // Process AND filters
    if (andFilters.length > 0) {
      const andConditions = andFilters.map(filter => this.buildSingleFilter(filter));
      conditions.push(...andConditions.filter(c => c !== null) as WhereOptions[]);
    }

    // Process OR filters
    if (orFilters.length > 0) {
      const orConditions = orFilters.map(filter => this.buildSingleFilter(filter));
      const validOrConditions = orConditions.filter(c => c !== null) as WhereOptions[];
      if (validOrConditions.length > 0) {
        conditions.push({ [Op.or]: validOrConditions });
      }
    }

    // Process NOT filters
    if (notFilters.length > 0) {
      const notConditions = notFilters.map(filter => this.buildSingleFilter(filter));
      const validNotConditions = notConditions.filter(c => c !== null) as WhereOptions[];
      for (const notCondition of validNotConditions) {
        conditions.push({ [Op.not]: notCondition });
      }
    }

    if (conditions.length === 0) {
      return null;
    } else if (conditions.length === 1) {
      return conditions[0];
    } else {
      return { [Op.and]: conditions };
    }
  }

  /**
   * Build a single filter condition
   */
  private buildSingleFilter(filter: SearchFilter): WhereOptions | null {
    if (!this.isValidField(filter.field)) {
      console.warn(`Invalid field for search: ${filter.field}`);
      return null;
    }

    // Handle nested filters
    if (filter.nested && filter.nested.length > 0) {
      return this.buildFilterConditions(filter.nested);
    }

    const field = filter.field;
    const operator = filter.operator;
    const value = filter.value;
    const values = filter.values;

    switch (operator) {
      case 'eq':
        return { [field]: { [Op.eq]: value } };

      case 'ne':
        return { [field]: { [Op.ne]: value } };

      case 'gt':
        return { [field]: { [Op.gt]: value } };

      case 'gte':
        return { [field]: { [Op.gte]: value } };

      case 'lt':
        return { [field]: { [Op.lt]: value } };

      case 'lte':
        return { [field]: { [Op.lte]: value } };

      case 'in':
        return values ? { [field]: { [Op.in]: values } } : null;

      case 'nin':
        return values ? { [field]: { [Op.notIn]: values } } : null;

      case 'like':
      case 'ilike':
        return { [field]: { [Op.like]: `%${value}%` } };

      case 'startsWith':
        return { [field]: { [Op.like]: `${value}%` } };

      case 'endsWith':
        return { [field]: { [Op.like]: `%${value}` } };

      case 'regex':
        return { [field]: { [Op.regexp]: value } };

      case 'exists':
        return { [field]: { [Op.ne]: null } };

      case 'notExists':
        return { [field]: { [Op.is]: null } };

      case 'between':
        if (values && values.length >= 2) {
          return { [field]: { [Op.between]: [values[0], values[1]] } };
        }
        return null;

      case 'overlap':
        // For JSON array overlap in MySQL
        if (this.isJsonField(field)) {
          return literal(`JSON_OVERLAPS(${field}, '${JSON.stringify(values || [value])}')`);
        }
        return null;

      case 'fullText':
        // Full-text search on specific field
        return { [field]: { [Op.like]: `%${value}%` } };

      default:
        console.warn(`Unsupported filter operator: ${operator}`);
        return null;
    }
  }

  /**
   * Build ORDER BY clause from sort options
   */
  private buildOrderClause(sortOptions: SortOptions[]): OrderItem[] {
    return sortOptions
      .filter(sort => this.isValidField(sort.field) && this.isSortableField(sort.field))
      .map(sort => {
        const direction = sort.direction || 'ASC';
        if (sort.nullsFirst !== undefined) {
          // Handle NULLS FIRST/LAST for MySQL
          return literal(`${sort.field} ${direction} ${sort.nullsFirst ? 'NULLS FIRST' : 'NULLS LAST'}`);
        }
        return [sort.field, direction] as OrderItem;
      });
  }

  /**
   * Generate auto-complete query for a specific field
   */
  public buildAutoCompleteQuery(field: string, term: string, limit: number = 10): FindOptions {
    if (!this.isValidField(field) || !this.isAutoCompleteField(field)) {
      throw new Error(`Field ${field} does not support auto-complete`);
    }

    return {
      attributes: [[field, 'value'], [literal('COUNT(*)'), 'count']],
      where: {
        [field]: {
          [Op.like]: `${term}%`
        }
      },
      group: [field],
      order: [[literal('count'), 'DESC'], [field, 'ASC']],
      limit,
      raw: true
    };
  }

  /**
   * Build facet aggregation query
   */
  public buildFacetQuery(field: string): FindOptions {
    if (!this.isValidField(field) || !this.isFacetableField(field)) {
      throw new Error(`Field ${field} does not support facets`);
    }

    return {
      attributes: [
        [field, 'value'],
        [literal('COUNT(*)'), 'count']
      ],
      where: {
        [field]: { [Op.ne]: null }
      },
      group: [field],
      order: [[literal('count'), 'DESC']],
      limit: 50,
      raw: true
    };
  }

  /**
   * Build count query for search results
   */
  public buildCountQuery(searchQuery: SearchQuery): FindOptions {
    return {
      where: this.buildWhereClause(searchQuery)
    };
  }

  /**
   * Validate if field exists in searchable fields
   */
  private isValidField(field: string): boolean {
    return this.searchableFields.some(f => f.name === field);
  }

  /**
   * Check if field is sortable
   */
  private isSortableField(field: string): boolean {
    const fieldDef = this.searchableFields.find(f => f.name === field);
    return fieldDef?.sortable === true;
  }

  /**
   * Check if field supports auto-complete
   */
  private isAutoCompleteField(field: string): boolean {
    const fieldDef = this.searchableFields.find(f => f.name === field);
    return fieldDef?.autoComplete === true;
  }

  /**
   * Check if field is facetable
   */
  private isFacetableField(field: string): boolean {
    const fieldDef = this.searchableFields.find(f => f.name === field);
    return fieldDef?.facetable === true;
  }

  /**
   * Check if field is JSON type
   */
  private isJsonField(field: string): boolean {
    const fieldDef = this.searchableFields.find(f => f.name === field);
    return fieldDef?.type === 'object' || fieldDef?.type === 'array';
  }

  /**
   * Get execution plan for query (for debugging and optimization)
   */
  public getExecutionPlan(searchQuery: SearchQuery): QueryExecutionPlan {
    const sequelizeOptions = this.buildQuery(searchQuery);
    
    // This is a simplified execution plan
    // In a real implementation, you'd analyze the actual SQL query
    const plan: QueryExecutionPlan = {
      query: 'SELECT * FROM table WHERE conditions',
      parameters: [],
      estimatedCost: this.estimateQueryCost(searchQuery),
      useIndex: this.suggestIndexes(searchQuery)
    };

    return plan;
  }

  /**
   * Estimate query cost based on complexity
   */
  private estimateQueryCost(searchQuery: SearchQuery): number {
    let cost = 1;

    // Text search adds significant cost
    if (searchQuery.text) {
      cost += 3;
    }

    // Each filter adds cost
    if (searchQuery.filters) {
      cost += searchQuery.filters.length * 0.5;
    }

    // Sorting adds cost
    if (searchQuery.sorting && searchQuery.sorting.length > 0) {
      cost += searchQuery.sorting.length * 0.3;
    }

    return cost;
  }

  /**
   * Suggest indexes that would optimize the query
   */
  private suggestIndexes(searchQuery: SearchQuery): string[] {
    const indexes: string[] = [];

    // Add indexes for filtered fields
    if (searchQuery.filters) {
      for (const filter of searchQuery.filters) {
        if (this.isValidField(filter.field)) {
          indexes.push(`idx_${this.resourceType}_${filter.field}`);
        }
      }
    }

    // Add indexes for sorted fields
    if (searchQuery.sorting) {
      for (const sort of searchQuery.sorting) {
        if (this.isValidField(sort.field)) {
          indexes.push(`idx_${this.resourceType}_${sort.field}`);
        }
      }
    }

    // Add full-text index for text search
    if (searchQuery.text) {
      const textFields = this.searchableFields
        .filter(field => field.type === 'text')
        .map(field => field.name)
        .join('_');
      indexes.push(`idx_${this.resourceType}_fulltext_${textFields}`);
    }

    return [...new Set(indexes)]; // Remove duplicates
  }
}