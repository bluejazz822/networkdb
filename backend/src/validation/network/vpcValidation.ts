/**
 * VPC validation schemas using Joi
 */

import Joi from 'joi';
import {
  uuidSchema,
  awsAccountIdSchema,
  awsVpcIdSchema,
  awsDhcpOptionsIdSchema,
  awsRegionSchema,
  networkResourceStateSchema,
  instanceTenancySchema,
  cidrBlockSchema,
  metadataSchema,
  businessContextSchema,
  syncMetadataSchema,
  baseQueryParamsSchema,
  createValidationSchema,
  validationOptions
} from '../common';

// VPC CIDR Block Association validation
export const vpcCidrBlockAssociationSchema = Joi.object({
  associationId: Joi.string().required(),
  cidrBlock: cidrBlockSchema.required(),
  cidrBlockState: Joi.object({
    state: Joi.string()
      .valid('associating', 'associated', 'disassociating', 'disassociated', 'failing', 'failed')
      .required(),
    statusMessage: Joi.string().optional()
  }).required()
});

// Core VPC validation schema
export const vpcSchema = Joi.object({
  // Base entity fields
  id: uuidSchema.optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  deletedAt: Joi.date().optional().allow(null),

  // AWS identifiers
  awsVpcId: awsVpcIdSchema.required(),
  awsAccountId: awsAccountIdSchema.required(),
  region: awsRegionSchema.required(),
  regionId: uuidSchema.required(),
  statusId: uuidSchema.required(),

  // Network configuration
  cidrBlock: cidrBlockSchema.required(),
  cidrBlockAssociationSet: Joi.array()
    .items(vpcCidrBlockAssociationSchema)
    .optional()
    .allow(null),
  dhcpOptionsId: awsDhcpOptionsIdSchema.optional().allow(null),

  // State information
  state: networkResourceStateSchema.required(),

  // Location
  availabilityZones: Joi.array()
    .items(Joi.string().max(20))
    .optional()
    .allow(null),

  // Configuration
  isDefault: Joi.boolean().default(false),
  instanceTenancy: instanceTenancySchema.default('default'),
  enableDnsHostnames: Joi.boolean().default(true),
  enableDnsSupport: Joi.boolean().default(true),
  enableNetworkAddressUsageMetrics: Joi.boolean().default(false),

  // Metadata
  ...metadataSchema.describe().keys,

  // Sync information
  ...syncMetadataSchema.describe().keys,

  // Business context
  ...businessContextSchema.describe().keys
});

// VPC Creation DTO validation
export const createVpcDtoSchema = createValidationSchema(
  Joi.object({
    // AWS identifiers
    awsVpcId: awsVpcIdSchema.required(),
    awsAccountId: awsAccountIdSchema.required(),
    region: awsRegionSchema.required(),
    regionId: uuidSchema.required(),
    statusId: uuidSchema.required(),

    // Network configuration
    cidrBlock: cidrBlockSchema.required(),
    cidrBlockAssociationSet: Joi.array()
      .items(vpcCidrBlockAssociationSchema)
      .optional(),
    dhcpOptionsId: awsDhcpOptionsIdSchema.optional(),

    // State
    state: networkResourceStateSchema.default('pending'),

    // Location
    availabilityZones: Joi.array()
      .items(Joi.string().max(20))
      .optional(),

    // Configuration
    isDefault: Joi.boolean().default(false),
    instanceTenancy: instanceTenancySchema.default('default'),
    enableDnsHostnames: Joi.boolean().default(true),
    enableDnsSupport: Joi.boolean().default(true),
    enableNetworkAddressUsageMetrics: Joi.boolean().default(false),

    // Metadata
    tags: Joi.object().pattern(
      Joi.string().max(128),
      Joi.string().max(256)
    ).optional(),
    name: Joi.string().max(255).optional(),
    description: Joi.string().max(1000).optional(),

    // Sync information
    sourceSystem: Joi.string().max(50).default('aws'),
    lastSyncAt: Joi.date().optional(),
    syncVersion: Joi.number().integer().min(1).default(1),

    // Business context
    environment: Joi.string().max(50).optional(),
    project: Joi.string().max(100).optional(),
    costCenter: Joi.string().max(50).optional(),
    owner: Joi.string().max(255).optional()
  })
);

// VPC Update DTO validation
export const updateVpcDtoSchema = createValidationSchema(
  Joi.object({
    // Network configuration updates
    cidrBlockAssociationSet: Joi.array()
      .items(vpcCidrBlockAssociationSchema)
      .optional(),
    dhcpOptionsId: awsDhcpOptionsIdSchema.optional().allow(null),

    // State updates
    state: networkResourceStateSchema.optional(),
    statusId: uuidSchema.optional(),

    // Configuration updates
    enableDnsHostnames: Joi.boolean().optional(),
    enableDnsSupport: Joi.boolean().optional(),
    enableNetworkAddressUsageMetrics: Joi.boolean().optional(),

    // Metadata updates
    tags: Joi.object().pattern(
      Joi.string().max(128),
      Joi.string().max(256)
    ).optional(),
    name: Joi.string().max(255).optional().allow(null),
    description: Joi.string().max(1000).optional().allow(null),

    // Sync information updates
    lastSyncAt: Joi.date().optional(),
    syncVersion: Joi.number().integer().min(1).optional(),

    // Business context updates
    environment: Joi.string().max(50).optional().allow(null),
    project: Joi.string().max(100).optional().allow(null),
    costCenter: Joi.string().max(50).optional().allow(null),
    owner: Joi.string().max(255).optional().allow(null)
  }).min(1) // At least one field must be provided for update
);

// VPC Query Parameters validation
export const vpcQueryParamsSchema = createValidationSchema(
  baseQueryParamsSchema.concat(
    Joi.object({
      // VPC-specific filters
      awsVpcId: awsVpcIdSchema.optional(),
      cidrBlock: cidrBlockSchema.optional(),
      isDefault: Joi.boolean().optional(),
      instanceTenancy: instanceTenancySchema.optional(),
      enableDnsHostnames: Joi.boolean().optional(),
      enableDnsSupport: Joi.boolean().optional(),
      dhcpOptionsId: awsDhcpOptionsIdSchema.optional(),
      availabilityZone: Joi.string().max(20).optional(),

      // Sorting specific to VPC
      sortBy: Joi.string()
        .valid('createdAt', 'updatedAt', 'name', 'awsVpcId', 'cidrBlock', 'region', 'lastSyncAt')
        .optional()
    })
  )
);

// VPC Bulk Operation validation
export const bulkVpcOperationSchema = createValidationSchema(
  Joi.object({
    operation: Joi.string().valid('update', 'delete', 'sync').required(),
    vpcIds: Joi.array()
      .items(uuidSchema)
      .min(1)
      .max(100)
      .required(),
    updateData: updateVpcDtoSchema.when('operation', {
      is: 'update',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
  })
);

// VPC Sync DTO validation
export const vpcSyncDtoSchema = createValidationSchema(
  Joi.object({
    awsVpcId: awsVpcIdSchema.required(),
    awsAccountId: awsAccountIdSchema.required(),
    region: awsRegionSchema.required(),
    forceSync: Joi.boolean().default(false)
  })
);

// VPC-specific validation rules
export const vpcValidationRules = {
  // Custom validation for CIDR block conflicts
  validateCidrConflict: (cidrBlock: string, existingCidrs: string[] = []): boolean => {
    // This would implement actual CIDR overlap detection
    // For now, just a placeholder
    return !existingCidrs.includes(cidrBlock);
  },

  // Validate VPC state transitions
  validateStateTransition: (currentState: string, newState: string): boolean => {
    const validTransitions: Record<string, string[]> = {
      pending: ['available', 'failed'],
      available: ['deleting', 'failed'],
      deleting: ['deleted', 'failed'],
      failed: ['pending', 'deleting']
    };
    
    return validTransitions[currentState]?.includes(newState) ?? false;
  },

  // Validate DHCP Options ID format
  validateDhcpOptionsId: (dhcpOptionsId: string): boolean => {
    return /^dopt-[a-f0-9]{8,17}$/.test(dhcpOptionsId);
  },

  // Validate availability zone format for region
  validateAvailabilityZone: (az: string, region: string): boolean => {
    return az.startsWith(region) && /^[a-z0-9-]+[a-z]$/.test(az);
  }
};

// VPC validation middleware schemas
export const vpcValidationSchemas = {
  create: createVpcDtoSchema,
  update: updateVpcDtoSchema,
  query: vpcQueryParamsSchema,
  bulk: bulkVpcOperationSchema,
  sync: vpcSyncDtoSchema
};

// Export validation options
export { validationOptions };

// Helper function to validate VPC data with custom business rules
export const validateVpcWithBusinessRules = async (
  data: any,
  context: {
    operation: 'create' | 'update';
    existingVpc?: any;
    existingCidrs?: string[];
  }
) => {
  // First validate with Joi schema
  const schema = context.operation === 'create' 
    ? createVpcDtoSchema 
    : updateVpcDtoSchema;
    
  const { error, value } = schema.validate(data, validationOptions);
  
  if (error) {
    return { error, value: null };
  }

  // Then apply custom business rules
  const businessErrors: string[] = [];

  // Check CIDR conflicts for new VPCs
  if (context.operation === 'create' && context.existingCidrs) {
    if (!vpcValidationRules.validateCidrConflict(value.cidrBlock, context.existingCidrs)) {
      businessErrors.push(`CIDR block ${value.cidrBlock} conflicts with existing VPC CIDR blocks`);
    }
  }

  // Check state transitions for updates
  if (context.operation === 'update' && context.existingVpc && value.state) {
    if (!vpcValidationRules.validateStateTransition(context.existingVpc.state, value.state)) {
      businessErrors.push(`Invalid state transition from ${context.existingVpc.state} to ${value.state}`);
    }
  }

  // Validate availability zones against region
  if (value.availabilityZones && value.region) {
    const invalidAZs = value.availabilityZones.filter(
      (az: string) => !vpcValidationRules.validateAvailabilityZone(az, value.region)
    );
    if (invalidAZs.length > 0) {
      businessErrors.push(`Invalid availability zones for region ${value.region}: ${invalidAZs.join(', ')}`);
    }
  }

  if (businessErrors.length > 0) {
    return {
      error: {
        details: businessErrors.map(message => ({ message, type: 'business' }))
      },
      value: null
    };
  }

  return { error: null, value };
};