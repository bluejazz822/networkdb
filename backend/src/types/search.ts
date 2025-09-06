/**
 * Search and Filtering Types
 * Comprehensive type definitions for advanced search functionality
 */

export interface SearchQuery {
  text?: string;
  filters?: SearchFilter[];
  pagination?: PaginationOptions;
  sorting?: SortOptions[];
  includeHighlight?: boolean;
}

export interface SearchFilter {
  field: string;
  operator: FilterOperator;
  value: any;
  values?: any[];
  logicalOperator?: LogicalOperator;
  nested?: SearchFilter[];
}

export interface SearchResult<T = any> {
  data: T[];
  totalCount: number;
  searchTime: number;
  facets?: SearchFacet[];
  highlights?: SearchHighlight[];
  suggestions?: string[];
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface SearchHighlight {
  field: string;
  fragments: string[];
}

export interface SearchFacet {
  field: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortOptions {
  field: string;
  direction: 'ASC' | 'DESC';
  nullsFirst?: boolean;
}

export interface AutoCompleteQuery {
  term: string;
  field?: string;
  resourceType?: ResourceType;
  limit?: number;
}

export interface AutoCompleteResult {
  suggestions: AutoCompleteSuggestion[];
  searchTime: number;
}

export interface AutoCompleteSuggestion {
  text: string;
  value: string;
  type: 'field' | 'value' | 'resource';
  score: number;
  metadata?: Record<string, any>;
}

export interface SavedQuery {
  id?: number;
  name: string;
  description?: string;
  query: SearchQuery;
  userId: string;
  isPublic?: boolean;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  lastUsedAt?: Date;
  useCount?: number;
}

export interface SearchStats {
  popularQueries: PopularQuery[];
  recentQueries: SavedQuery[];
  totalSearches: number;
  averageResponseTime: number;
}

export interface PopularQuery {
  query: string;
  count: number;
  lastUsed: Date;
}

export type FilterOperator = 
  | 'eq'           // equals
  | 'ne'           // not equals  
  | 'gt'           // greater than
  | 'gte'          // greater than or equal
  | 'lt'           // less than
  | 'lte'          // less than or equal
  | 'in'           // in array
  | 'nin'          // not in array
  | 'like'         // contains (case insensitive)
  | 'ilike'        // contains (case sensitive)
  | 'startsWith'   // starts with
  | 'endsWith'     // ends with
  | 'regex'        // regular expression
  | 'exists'       // field exists (not null)
  | 'notExists'    // field does not exist (is null)
  | 'between'      // between two values
  | 'overlap'      // array overlap
  | 'fullText';    // full-text search

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export type ResourceType = 
  | 'vpc' 
  | 'transitGateway' 
  | 'customerGateway' 
  | 'vpcEndpoint' 
  | 'all';

export interface SearchableResource {
  resourceType: ResourceType;
  tableName: string;
  searchableFields: SearchableField[];
  relationships?: ResourceRelationship[];
}

export interface SearchableField {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'array' | 'object';
  weight?: number;           // For relevance scoring
  indexed?: boolean;         // Whether field is indexed for fast search
  facetable?: boolean;       // Whether field can be used for faceted search
  sortable?: boolean;        // Whether field can be used for sorting
  autoComplete?: boolean;    // Whether field supports auto-complete
  description?: string;      // Human-readable description
}

export interface ResourceRelationship {
  type: 'oneToOne' | 'oneToMany' | 'manyToMany';
  target: ResourceType;
  foreignKey: string;
  searchable?: boolean;      // Whether to include related data in search
}

export interface SearchIndex {
  resourceType: ResourceType;
  fields: string[];
  type: 'fulltext' | 'btree' | 'hash';
  name: string;
}

export interface QueryExecutionPlan {
  query: string;
  parameters: any[];
  estimatedCost: number;
  useIndex?: string[];
  executionTime?: number;
}

export interface SearchMetrics {
  queryCount: number;
  averageResponseTime: number;
  slowQueries: SlowQuery[];
  popularFields: FieldUsage[];
  cacheHitRate: number;
}

export interface SlowQuery {
  query: SearchQuery;
  executionTime: number;
  timestamp: Date;
  userId?: string;
}

export interface FieldUsage {
  field: string;
  count: number;
  averageResponseTime: number;
}

// Configuration interfaces
export interface SearchConfig {
  maxResultsPerPage: number;
  defaultPageSize: number;
  maxSearchTermLength: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  indexingEnabled: boolean;
  highlightEnabled: boolean;
  autoCompleteEnabled: boolean;
  facetsEnabled: boolean;
}

// Error types specific to search
export interface SearchError {
  code: SearchErrorCode;
  message: string;
  field?: string;
  details?: any;
}

export type SearchErrorCode =
  | 'INVALID_SEARCH_QUERY'
  | 'INVALID_FILTER_OPERATOR'
  | 'UNSUPPORTED_FIELD'
  | 'SEARCH_TIMEOUT'
  | 'INDEX_ERROR'
  | 'CACHE_ERROR'
  | 'SAVED_QUERY_NOT_FOUND'
  | 'QUERY_TOO_COMPLEX'
  | 'PERMISSION_DENIED';

// Export search field mapping for different resource types
export const SEARCHABLE_RESOURCES: Record<ResourceType, SearchableResource> = {
  vpc: {
    resourceType: 'vpc',
    tableName: 'Vpcs',
    searchableFields: [
      { name: 'vpcId', type: 'text', weight: 2, indexed: true, autoComplete: true },
      { name: 'name', type: 'text', weight: 3, indexed: true, autoComplete: true },
      { name: 'region', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'cidrBlock', type: 'text', weight: 2, indexed: true },
      { name: 'state', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'environment', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'owner', type: 'text', weight: 1, facetable: true, autoComplete: true },
      { name: 'awsAccountId', type: 'text', weight: 1, indexed: true },
      { name: 'tags', type: 'object', weight: 1, facetable: true },
      { name: 'createdAt', type: 'date', sortable: true },
      { name: 'updatedAt', type: 'date', sortable: true }
    ]
  },
  transitGateway: {
    resourceType: 'transitGateway',
    tableName: 'TransitGateways',
    searchableFields: [
      { name: 'transitGatewayId', type: 'text', weight: 2, indexed: true, autoComplete: true },
      { name: 'name', type: 'text', weight: 3, indexed: true, autoComplete: true },
      { name: 'region', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'state', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'environment', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'owner', type: 'text', weight: 1, facetable: true, autoComplete: true },
      { name: 'awsAccountId', type: 'text', weight: 1, indexed: true },
      { name: 'tags', type: 'object', weight: 1, facetable: true },
      { name: 'createdAt', type: 'date', sortable: true },
      { name: 'updatedAt', type: 'date', sortable: true }
    ]
  },
  customerGateway: {
    resourceType: 'customerGateway',
    tableName: 'CustomerGateways',
    searchableFields: [
      { name: 'customerGatewayId', type: 'text', weight: 2, indexed: true, autoComplete: true },
      { name: 'name', type: 'text', weight: 3, indexed: true, autoComplete: true },
      { name: 'region', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'ipAddress', type: 'text', weight: 2, indexed: true },
      { name: 'type', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'state', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'environment', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'owner', type: 'text', weight: 1, facetable: true, autoComplete: true },
      { name: 'awsAccountId', type: 'text', weight: 1, indexed: true },
      { name: 'tags', type: 'object', weight: 1, facetable: true },
      { name: 'createdAt', type: 'date', sortable: true },
      { name: 'updatedAt', type: 'date', sortable: true }
    ]
  },
  vpcEndpoint: {
    resourceType: 'vpcEndpoint',
    tableName: 'VpcEndpoints',
    searchableFields: [
      { name: 'vpcEndpointId', type: 'text', weight: 2, indexed: true, autoComplete: true },
      { name: 'serviceName', type: 'text', weight: 3, indexed: true, autoComplete: true },
      { name: 'vpcId', type: 'text', weight: 2, indexed: true },
      { name: 'region', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'state', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'vpcEndpointType', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'environment', type: 'text', weight: 1, facetable: true, sortable: true },
      { name: 'owner', type: 'text', weight: 1, facetable: true, autoComplete: true },
      { name: 'awsAccountId', type: 'text', weight: 1, indexed: true },
      { name: 'tags', type: 'object', weight: 1, facetable: true },
      { name: 'createdAt', type: 'date', sortable: true },
      { name: 'updatedAt', type: 'date', sortable: true }
    ]
  },
  all: {
    resourceType: 'all',
    tableName: '',
    searchableFields: []
  }
};

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  maxResultsPerPage: 1000,
  defaultPageSize: 20,
  maxSearchTermLength: 1000,
  cacheEnabled: true,
  cacheTTL: 300, // 5 minutes
  indexingEnabled: true,
  highlightEnabled: true,
  autoCompleteEnabled: true,
  facetsEnabled: true
};