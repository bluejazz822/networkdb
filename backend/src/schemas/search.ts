/**
 * Search Validation Schemas
 * Joi schemas for validating search API requests
 */

import Joi from 'joi';

// Resource type validation
const resourceTypeSchema = Joi.string().valid(
  'vpc', 
  'transitGateway', 
  'customerGateway', 
  'vpcEndpoint', 
  'all'
).required();

// Filter operator validation
const filterOperatorSchema = Joi.string().valid(
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
  'in', 'nin', 'like', 'ilike', 'startsWith', 'endsWith',
  'regex', 'exists', 'notExists', 'between', 'overlap', 'fullText'
);

// Logical operator validation
const logicalOperatorSchema = Joi.string().valid('AND', 'OR', 'NOT');

// Sort direction validation
const sortDirectionSchema = Joi.string().valid('ASC', 'DESC');

// Search filter schema
const searchFilterSchema = Joi.object({
  field: Joi.string().required(),
  operator: filterOperatorSchema.required(),
  value: Joi.any().when('operator', {
    is: Joi.string().valid('exists', 'notExists'),
    then: Joi.forbidden(),
    otherwise: Joi.required()
  }),
  values: Joi.array().items(Joi.any()).when('operator', {
    is: Joi.string().valid('in', 'nin', 'between', 'overlap'),
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  logicalOperator: logicalOperatorSchema.optional(),
  nested: Joi.array().items(Joi.link('#searchFilter')).optional()
}).id('searchFilter');

// Pagination schema
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(20),
  offset: Joi.number().integer().min(0).optional()
});

// Sort options schema
const sortOptionsSchema = Joi.object({
  field: Joi.string().required(),
  direction: sortDirectionSchema.default('ASC'),
  nullsFirst: Joi.boolean().optional()
});

// Main search query schema
const searchQuerySchema = Joi.object({
  text: Joi.string().max(1000).optional(),
  filters: Joi.array().items(searchFilterSchema).max(50).optional(),
  pagination: paginationSchema.optional(),
  sorting: Joi.array().items(sortOptionsSchema).max(10).optional(),
  includeHighlight: Joi.boolean().default(false)
});

// Auto-complete query schema
const autoCompleteQuerySchema = Joi.object({
  term: Joi.string().min(1).max(100).required(),
  field: Joi.string().optional(),
  resourceType: Joi.string().valid(
    'vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all'
  ).default('all'),
  limit: Joi.number().integer().min(1).max(50).default(10)
});

// Saved query schemas
const savedQueryCreateSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  query: searchQuerySchema.required(),
  resourceType: resourceTypeSchema,
  isPublic: Joi.boolean().default(false),
  tags: Joi.array().items(Joi.string().max(50)).max(20).default([])
});

const savedQueryUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).allow(null).optional(),
  query: searchQuerySchema.optional(),
  isPublic: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional()
});

// Search API endpoint schemas
export const SearchValidationSchemas = {
  // Main search endpoint
  search: {
    params: Joi.object({
      resourceType: resourceTypeSchema
    }),
    body: searchQuerySchema
  },

  // Auto-complete endpoint
  autoComplete: {
    query: autoCompleteQuerySchema
  },

  // Popular terms endpoint
  popularTerms: {
    params: Joi.object({
      resourceType: Joi.string().valid(
        'vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all'
      ).optional()
    }),
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(10)
    })
  },

  // Saved queries
  savedQuery: {
    create: savedQueryCreateSchema,
    update: savedQueryUpdateSchema,
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    }),
    query: Joi.object({
      resourceType: Joi.string().valid(
        'vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all'
      ).optional(),
      includePublic: Joi.boolean().default(true)
    })
  },

  // Execute saved query
  executeSavedQuery: {
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    }),
    body: Joi.object({
      overrides: Joi.object({
        pagination: paginationSchema.optional(),
        sorting: Joi.array().items(sortOptionsSchema).max(10).optional(),
        includeHighlight: Joi.boolean().optional()
      }).optional()
    })
  },

  // Search by tags
  searchByTags: {
    body: Joi.object({
      tags: Joi.array().items(Joi.string().max(50)).min(1).max(10).required(),
      resourceType: Joi.string().valid(
        'vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all'
      ).optional(),
      includePublic: Joi.boolean().default(true)
    })
  },

  // Advanced search with facets
  advancedSearch: {
    params: Joi.object({
      resourceType: resourceTypeSchema
    }),
    body: Joi.object({
      query: searchQuerySchema.required(),
      facets: Joi.array().items(Joi.string()).max(10).optional(),
      highlight: Joi.object({
        enabled: Joi.boolean().default(false),
        fields: Joi.array().items(Joi.string()).max(10).optional(),
        fragmentSize: Joi.number().integer().min(50).max(500).default(150),
        maxFragments: Joi.number().integer().min(1).max(10).default(3)
      }).optional()
    })
  }
};

// Field validation for specific resource types
export const ResourceFieldSchemas = {
  vpc: Joi.string().valid(
    'id', 'vpcId', 'name', 'region', 'cidrBlock', 'state', 
    'environment', 'owner', 'awsAccountId', 'tags', 
    'createdAt', 'updatedAt'
  ),
  
  transitGateway: Joi.string().valid(
    'id', 'transitGatewayId', 'name', 'region', 'state',
    'environment', 'owner', 'awsAccountId', 'tags',
    'createdAt', 'updatedAt'
  ),
  
  customerGateway: Joi.string().valid(
    'id', 'customerGatewayId', 'name', 'region', 'ipAddress',
    'type', 'state', 'environment', 'owner', 'awsAccountId', 
    'tags', 'createdAt', 'updatedAt'
  ),
  
  vpcEndpoint: Joi.string().valid(
    'id', 'vpcEndpointId', 'serviceName', 'vpcId', 'region',
    'state', 'vpcEndpointType', 'environment', 'owner', 
    'awsAccountId', 'tags', 'createdAt', 'updatedAt'
  )
};

// Validation helper functions
export const validateSearchField = (field: string, resourceType: string): boolean => {
  const schema = ResourceFieldSchemas[resourceType as keyof typeof ResourceFieldSchemas];
  if (!schema) return resourceType === 'all';
  
  const validation = schema.validate(field);
  return !validation.error;
};

export const validateFilterValue = (
  operator: string, 
  value: any, 
  values?: any[]
): { valid: boolean; message?: string } => {
  switch (operator) {
    case 'in':
    case 'nin':
    case 'overlap':
      if (!values || !Array.isArray(values) || values.length === 0) {
        return { 
          valid: false, 
          message: `Operator '${operator}' requires a non-empty 'values' array` 
        };
      }
      break;
      
    case 'between':
      if (!values || !Array.isArray(values) || values.length < 2) {
        return { 
          valid: false, 
          message: `Operator 'between' requires at least 2 values` 
        };
      }
      break;
      
    case 'exists':
    case 'notExists':
      if (value !== undefined) {
        return { 
          valid: false, 
          message: `Operator '${operator}' should not have a value` 
        };
      }
      break;
      
    default:
      if (value === undefined || value === null) {
        return { 
          valid: false, 
          message: `Operator '${operator}' requires a value` 
        };
      }
  }
  
  return { valid: true };
};

// Export individual schemas for direct use
export {
  resourceTypeSchema,
  searchQuerySchema,
  autoCompleteQuerySchema,
  savedQueryCreateSchema,
  savedQueryUpdateSchema,
  paginationSchema,
  sortOptionsSchema,
  searchFilterSchema
};