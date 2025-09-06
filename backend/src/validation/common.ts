/**
 * Common validation schemas for Network CMDB
 */

import Joi from 'joi';

// UUID validation
export const uuidSchema = Joi.string().uuid({ version: ['uuidv4'] });

// AWS Account ID validation (12 digits)
export const awsAccountIdSchema = Joi.string()
  .pattern(/^\d{12}$/)
  .message('AWS Account ID must be a 12-digit number');

// AWS Resource ID patterns
export const awsVpcIdSchema = Joi.string()
  .pattern(/^vpc-[a-f0-9]{8,17}$/)
  .message('AWS VPC ID must match pattern vpc-xxxxxxxxxxxxxxxxx');

export const awsTransitGatewayIdSchema = Joi.string()
  .pattern(/^tgw-[a-f0-9]{8,17}$/)
  .message('AWS Transit Gateway ID must match pattern tgw-xxxxxxxxxxxxxxxxx');

export const awsCustomerGatewayIdSchema = Joi.string()
  .pattern(/^cgw-[a-f0-9]{8,17}$/)
  .message('AWS Customer Gateway ID must match pattern cgw-xxxxxxxxxxxxxxxxx');

export const awsVpcEndpointIdSchema = Joi.string()
  .pattern(/^vpce-[a-f0-9]{8,17}$/)
  .message('AWS VPC Endpoint ID must match pattern vpce-xxxxxxxxxxxxxxxxx');

export const awsDhcpOptionsIdSchema = Joi.string()
  .pattern(/^dopt-[a-f0-9]{8,17}$/)
  .message('AWS DHCP Options ID must match pattern dopt-xxxxxxxxxxxxxxxxx');

export const awsRouteTableIdSchema = Joi.string()
  .pattern(/^rtb-[a-f0-9]{8,17}$/)
  .message('AWS Route Table ID must match pattern rtb-xxxxxxxxxxxxxxxxx');

export const awsSubnetIdSchema = Joi.string()
  .pattern(/^subnet-[a-f0-9]{8,17}$/)
  .message('AWS Subnet ID must match pattern subnet-xxxxxxxxxxxxxxxxx');

export const awsSecurityGroupIdSchema = Joi.string()
  .pattern(/^sg-[a-f0-9]{8,17}$/)
  .message('AWS Security Group ID must match pattern sg-xxxxxxxxxxxxxxxxx');

export const awsNetworkInterfaceIdSchema = Joi.string()
  .pattern(/^eni-[a-f0-9]{8,17}$/)
  .message('AWS Network Interface ID must match pattern eni-xxxxxxxxxxxxxxxxx');

// AWS Regions
export const awsRegionSchema = Joi.string().valid(
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1'
);

// Network Resource States
export const networkResourceStateSchema = Joi.string().valid(
  'pending',
  'available',
  'active',
  'inactive',
  'deleting',
  'deleted',
  'failed'
);

// Instance Tenancy
export const instanceTenancySchema = Joi.string().valid(
  'default',
  'dedicated',
  'host'
);

// IP address validation
export const ipv4AddressSchema = Joi.string().ip({
  version: ['ipv4']
});

// CIDR block validation
export const cidrBlockSchema = Joi.string()
  .pattern(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/)
  .message('CIDR block must be in valid IPv4 CIDR format (e.g., 10.0.0.0/16)');

// BGP ASN validation (16-bit: 1-65534, 32-bit: 1-4294967295)
export const bgpAsnSchema = Joi.number()
  .integer()
  .min(1)
  .max(4294967295)
  .message('BGP ASN must be between 1 and 4294967295');

// AWS Tags validation
export const awsTagsSchema = Joi.object()
  .pattern(
    Joi.string().max(128), // Tag key
    Joi.string().max(256)  // Tag value
  )
  .max(50) // AWS limit of 50 tags per resource
  .message('Tags must be key-value pairs with keys up to 128 characters and values up to 256 characters, maximum 50 tags');

// Common metadata fields
export const metadataSchema = Joi.object({
  tags: awsTagsSchema.optional().allow(null),
  name: Joi.string().max(255).optional().allow(null),
  description: Joi.string().max(1000).optional().allow(null)
});

// Business context validation
export const businessContextSchema = Joi.object({
  environment: Joi.string().max(50).optional().allow(null),
  project: Joi.string().max(100).optional().allow(null),
  costCenter: Joi.string().max(50).optional().allow(null),
  owner: Joi.string().max(255).optional().allow(null)
});

// Sync information validation
export const syncMetadataSchema = Joi.object({
  sourceSystem: Joi.string().max(50).default('aws'),
  lastSyncAt: Joi.date().optional().allow(null),
  syncVersion: Joi.number().integer().min(1).default(1)
});

// Pagination validation
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(20),
  offset: Joi.number().integer().min(0).optional()
});

// Sorting validation
export const sortingSchema = Joi.object({
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('ASC'),
  multiSort: Joi.array().items(
    Joi.object({
      field: Joi.string().required(),
      order: Joi.string().valid('ASC', 'DESC').required()
    })
  ).optional()
});

// Date range validation
export const dateRangeSchema = Joi.object({
  createdAfter: Joi.date().iso().optional(),
  createdBefore: Joi.date().iso().optional(),
  updatedAfter: Joi.date().iso().optional(),
  updatedBefore: Joi.date().iso().optional(),
  lastSyncAfter: Joi.date().iso().optional(),
  lastSyncBefore: Joi.date().iso().optional()
});

// Search validation
export const searchSchema = Joi.object({
  search: Joi.string().max(255).optional(),
  searchFields: Joi.array().items(Joi.string()).optional()
});

// Common filters for network resources
export const networkResourceFiltersSchema = Joi.object({
  awsAccountId: awsAccountIdSchema.optional(),
  awsAccountIds: Joi.array().items(awsAccountIdSchema).optional(),
  region: awsRegionSchema.optional(),
  regions: Joi.array().items(awsRegionSchema).optional(),
  state: networkResourceStateSchema.optional(),
  states: Joi.array().items(networkResourceStateSchema).optional(),
  statusId: uuidSchema.optional(),
  environment: Joi.string().max(50).optional(),
  environments: Joi.array().items(Joi.string().max(50)).optional(),
  project: Joi.string().max(100).optional(),
  projects: Joi.array().items(Joi.string().max(100)).optional(),
  owner: Joi.string().max(255).optional(),
  owners: Joi.array().items(Joi.string().max(255)).optional(),
  costCenter: Joi.string().max(50).optional(),
  costCenters: Joi.array().items(Joi.string().max(50)).optional()
});

// Base query parameters schema combining all common elements
export const baseQueryParamsSchema = paginationSchema
  .concat(sortingSchema)
  .concat(dateRangeSchema)
  .concat(searchSchema)
  .concat(networkResourceFiltersSchema)
  .concat(Joi.object({
    include: Joi.array().items(Joi.string()).optional(),
    exclude: Joi.array().items(Joi.string()).optional(),
    format: Joi.string().valid('json', 'csv', 'xlsx').default('json'),
    fields: Joi.array().items(Joi.string()).optional()
  }));

// Bulk operation validation
export const bulkOperationSchema = Joi.object({
  operation: Joi.string().valid('create', 'update', 'delete', 'sync').required(),
  items: Joi.array().min(1).max(1000).required(),
  options: Joi.object({
    continueOnError: Joi.boolean().default(true),
    batchSize: Joi.number().integer().min(1).max(100).default(10),
    skipValidation: Joi.boolean().default(false)
  }).optional()
});

// Export validation
export const exportRequestSchema = baseQueryParamsSchema.concat(
  Joi.object({
    format: Joi.string().valid('csv', 'xlsx', 'json').required(),
    includeDeleted: Joi.boolean().default(false),
    includeAuditInfo: Joi.boolean().default(false),
    email: Joi.string().email().optional()
  })
);

// AWS Sync validation
export const awsSyncRequestSchema = Joi.object({
  resourceType: Joi.string().valid('vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all').required(),
  awsAccountId: awsAccountIdSchema.optional(),
  region: awsRegionSchema.optional(),
  resourceIds: Joi.array().items(Joi.string()).optional(),
  forceSync: Joi.boolean().default(false),
  options: Joi.object({
    skipValidation: Joi.boolean().default(false),
    batchSize: Joi.number().integer().min(1).max(100).default(10),
    maxConcurrency: Joi.number().integer().min(1).max(10).default(3)
  }).optional()
});

// Validation options
export const validationOptions: Joi.ValidationOptions = {
  abortEarly: false, // Collect all validation errors
  allowUnknown: false, // Don't allow unknown fields
  stripUnknown: true, // Remove unknown fields from validated data
  convert: true, // Convert values to appropriate types
  presence: 'optional' // Fields are optional unless specified
};

// Custom validation messages
export const customMessages = {
  'any.required': '{#label} is required',
  'any.empty': '{#label} cannot be empty',
  'string.base': '{#label} must be a string',
  'string.empty': '{#label} cannot be empty',
  'string.max': '{#label} must not exceed {#limit} characters',
  'string.pattern.base': '{#label} format is invalid',
  'number.base': '{#label} must be a number',
  'number.integer': '{#label} must be an integer',
  'number.min': '{#label} must be at least {#limit}',
  'number.max': '{#label} must not exceed {#limit}',
  'date.base': '{#label} must be a valid date',
  'date.iso': '{#label} must be in ISO format',
  'array.base': '{#label} must be an array',
  'array.min': '{#label} must contain at least {#limit} items',
  'array.max': '{#label} must not contain more than {#limit} items',
  'object.base': '{#label} must be an object',
  'any.only': '{#label} must be one of: {#valids}'
};

// Helper function to create validation schema with custom messages
export const createValidationSchema = (schema: Joi.Schema) => {
  return schema.messages(customMessages);
};