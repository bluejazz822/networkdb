/**
 * Transit Gateway validation schemas using Joi
 */

import Joi from 'joi';
import {
  uuidSchema,
  awsAccountIdSchema,
  awsTransitGatewayIdSchema,
  awsRouteTableIdSchema,
  awsRegionSchema,
  networkResourceStateSchema,
  cidrBlockSchema,
  bgpAsnSchema,
  metadataSchema,
  businessContextSchema,
  syncMetadataSchema,
  baseQueryParamsSchema,
  createValidationSchema,
  validationOptions
} from '../common';

// Transit Gateway feature state validation
export const tgwFeatureStateSchema = Joi.string().valid('enable', 'disable');

// Transit Gateway type validation
export const transitGatewayTypeSchema = Joi.string().valid('hub', 'spoke', 'inspection');

// Transit Gateway CIDR Block validation
export const transitGatewayCidrBlockSchema = Joi.object({
  cidr: cidrBlockSchema.required(),
  state: Joi.string()
    .valid('pending', 'available', 'deleting', 'deleted', 'failed')
    .required()
});

// Core Transit Gateway validation schema
export const transitGatewaySchema = Joi.object({
  // Base entity fields
  id: uuidSchema.optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  deletedAt: Joi.date().optional().allow(null),

  // AWS identifiers
  awsTransitGatewayId: awsTransitGatewayIdSchema.required(),
  awsAccountId: awsAccountIdSchema.required(),
  region: awsRegionSchema.required(),
  regionId: uuidSchema.required(),
  statusId: uuidSchema.required(),

  // Basic information
  description: Joi.string().max(1000).optional().allow(null),

  // State information
  state: networkResourceStateSchema.required(),

  // Configuration
  amazonSideAsn: bgpAsnSchema.required(),
  autoAcceptSharedAttachments: tgwFeatureStateSchema.default('disable'),
  defaultRouteTableAssociation: tgwFeatureStateSchema.default('enable'),
  defaultRouteTablePropagation: tgwFeatureStateSchema.default('enable'),
  dnsSupport: tgwFeatureStateSchema.default('enable'),
  multicast: tgwFeatureStateSchema.default('disable'),

  // Route Tables
  associationDefaultRouteTableId: awsRouteTableIdSchema.optional().allow(null),
  propagationDefaultRouteTableId: awsRouteTableIdSchema.optional().allow(null),

  // Transit Gateway CIDR Blocks
  transitGatewayCidrBlocks: Joi.array()
    .items(transitGatewayCidrBlockSchema)
    .optional()
    .allow(null),

  // Metadata
  ...metadataSchema.describe().keys,

  // Sync information
  ...syncMetadataSchema.describe().keys,

  // Business context
  ...businessContextSchema.describe().keys,

  // Network Architecture
  transitGatewayType: transitGatewayTypeSchema.optional().allow(null),
  isPrimary: Joi.boolean().default(false)
});

// Transit Gateway Creation DTO validation
export const createTransitGatewayDtoSchema = createValidationSchema(
  Joi.object({
    // AWS identifiers
    awsTransitGatewayId: awsTransitGatewayIdSchema.required(),
    awsAccountId: awsAccountIdSchema.required(),
    region: awsRegionSchema.required(),
    regionId: uuidSchema.required(),
    statusId: uuidSchema.required(),

    // Basic information
    description: Joi.string().max(1000).optional(),

    // State
    state: networkResourceStateSchema.default('pending'),

    // Configuration
    amazonSideAsn: bgpAsnSchema.required(),
    autoAcceptSharedAttachments: tgwFeatureStateSchema.default('disable'),
    defaultRouteTableAssociation: tgwFeatureStateSchema.default('enable'),
    defaultRouteTablePropagation: tgwFeatureStateSchema.default('enable'),
    dnsSupport: tgwFeatureStateSchema.default('enable'),
    multicast: tgwFeatureStateSchema.default('disable'),

    // Route Tables
    associationDefaultRouteTableId: awsRouteTableIdSchema.optional(),
    propagationDefaultRouteTableId: awsRouteTableIdSchema.optional(),

    // Transit Gateway CIDR Blocks
    transitGatewayCidrBlocks: Joi.array()
      .items(transitGatewayCidrBlockSchema)
      .optional(),

    // Metadata
    tags: Joi.object().pattern(
      Joi.string().max(128),
      Joi.string().max(256)
    ).optional(),
    name: Joi.string().max(255).optional(),

    // Sync information
    sourceSystem: Joi.string().max(50).default('aws'),
    lastSyncAt: Joi.date().optional(),
    syncVersion: Joi.number().integer().min(1).default(1),

    // Business context
    environment: Joi.string().max(50).optional(),
    project: Joi.string().max(100).optional(),
    costCenter: Joi.string().max(50).optional(),
    owner: Joi.string().max(255).optional(),

    // Network Architecture
    transitGatewayType: transitGatewayTypeSchema.optional(),
    isPrimary: Joi.boolean().default(false)
  })
);

// Transit Gateway Update DTO validation
export const updateTransitGatewayDtoSchema = createValidationSchema(
  Joi.object({
    // Basic information updates
    description: Joi.string().max(1000).optional().allow(null),

    // State updates
    state: networkResourceStateSchema.optional(),
    statusId: uuidSchema.optional(),

    // Configuration updates (note: amazonSideAsn typically cannot be changed after creation)
    autoAcceptSharedAttachments: tgwFeatureStateSchema.optional(),
    defaultRouteTableAssociation: tgwFeatureStateSchema.optional(),
    defaultRouteTablePropagation: tgwFeatureStateSchema.optional(),
    dnsSupport: tgwFeatureStateSchema.optional(),
    multicast: tgwFeatureStateSchema.optional(),

    // Route Tables updates
    associationDefaultRouteTableId: awsRouteTableIdSchema.optional().allow(null),
    propagationDefaultRouteTableId: awsRouteTableIdSchema.optional().allow(null),

    // Transit Gateway CIDR Blocks updates
    transitGatewayCidrBlocks: Joi.array()
      .items(transitGatewayCidrBlockSchema)
      .optional(),

    // Metadata updates
    tags: Joi.object().pattern(
      Joi.string().max(128),
      Joi.string().max(256)
    ).optional(),
    name: Joi.string().max(255).optional().allow(null),

    // Sync information updates
    lastSyncAt: Joi.date().optional(),
    syncVersion: Joi.number().integer().min(1).optional(),

    // Business context updates
    environment: Joi.string().max(50).optional().allow(null),
    project: Joi.string().max(100).optional().allow(null),
    costCenter: Joi.string().max(50).optional().allow(null),
    owner: Joi.string().max(255).optional().allow(null),

    // Network Architecture updates
    transitGatewayType: transitGatewayTypeSchema.optional().allow(null),
    isPrimary: Joi.boolean().optional()
  }).min(1) // At least one field must be provided for update
);

// Transit Gateway Query Parameters validation
export const transitGatewayQueryParamsSchema = createValidationSchema(
  baseQueryParamsSchema.concat(
    Joi.object({
      // Transit Gateway-specific filters
      awsTransitGatewayId: awsTransitGatewayIdSchema.optional(),
      amazonSideAsn: bgpAsnSchema.optional(),
      transitGatewayType: transitGatewayTypeSchema.optional(),
      isPrimary: Joi.boolean().optional(),
      autoAcceptSharedAttachments: tgwFeatureStateSchema.optional(),
      defaultRouteTableAssociation: tgwFeatureStateSchema.optional(),
      defaultRouteTablePropagation: tgwFeatureStateSchema.optional(),
      dnsSupport: tgwFeatureStateSchema.optional(),
      multicast: tgwFeatureStateSchema.optional(),

      // BGP ASN range filtering
      amazonSideAsnMin: bgpAsnSchema.optional(),
      amazonSideAsnMax: bgpAsnSchema.optional(),

      // Sorting specific to Transit Gateway
      sortBy: Joi.string()
        .valid('createdAt', 'updatedAt', 'name', 'awsTransitGatewayId', 'amazonSideAsn', 'region', 'lastSyncAt')
        .optional()
    })
  )
);

// Transit Gateway Bulk Operation validation
export const bulkTransitGatewayOperationSchema = createValidationSchema(
  Joi.object({
    operation: Joi.string().valid('update', 'delete', 'sync').required(),
    transitGatewayIds: Joi.array()
      .items(uuidSchema)
      .min(1)
      .max(100)
      .required(),
    updateData: updateTransitGatewayDtoSchema.when('operation', {
      is: 'update',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
  })
);

// Transit Gateway Sync DTO validation
export const transitGatewaySyncDtoSchema = createValidationSchema(
  Joi.object({
    awsTransitGatewayId: awsTransitGatewayIdSchema.required(),
    awsAccountId: awsAccountIdSchema.required(),
    region: awsRegionSchema.required(),
    forceSync: Joi.boolean().default(false)
  })
);

// Transit Gateway-specific validation rules
export const transitGatewayValidationRules = {
  // Validate BGP ASN conflicts within account/region
  validateAsnConflict: (asn: number, existingAsns: number[] = []): boolean => {
    return !existingAsns.includes(asn);
  },

  // Validate state transitions
  validateStateTransition: (currentState: string, newState: string): boolean => {
    const validTransitions: Record<string, string[]> = {
      pending: ['available', 'failed'],
      modifying: ['available', 'failed'],
      available: ['deleting', 'modifying', 'failed'],
      deleting: ['deleted', 'failed'],
      failed: ['pending', 'deleting']
    };
    
    return validTransitions[currentState]?.includes(newState) ?? false;
  },

  // Validate Amazon-side ASN ranges (private ASN ranges)
  validateAmazonSideAsn: (asn: number): boolean => {
    // Amazon side ASN must be in private ASN ranges:
    // 16-bit: 64512-65534 (RFC 6996)
    // 32-bit: 4200000000-4294967294
    return (asn >= 64512 && asn <= 65534) || 
           (asn >= 4200000000 && asn <= 4294967294);
  },

  // Validate only one primary Transit Gateway per region
  validatePrimaryConstraint: (
    isPrimary: boolean, 
    region: string, 
    existingPrimaryTgwId?: string,
    currentTgwId?: string
  ): boolean => {
    if (!isPrimary) return true;
    return !existingPrimaryTgwId || existingPrimaryTgwId === currentTgwId;
  },

  // Validate CIDR block doesn't overlap with VPC CIDRs
  validateCidrOverlap: (
    tgwCidrs: string[], 
    existingVpcCidrs: string[] = []
  ): string[] => {
    // This would implement actual CIDR overlap detection
    // For now, just return overlapping CIDRs (placeholder)
    return tgwCidrs.filter(cidr => existingVpcCidrs.includes(cidr));
  }
};

// Transit Gateway validation middleware schemas
export const transitGatewayValidationSchemas = {
  create: createTransitGatewayDtoSchema,
  update: updateTransitGatewayDtoSchema,
  query: transitGatewayQueryParamsSchema,
  bulk: bulkTransitGatewayOperationSchema,
  sync: transitGatewaySyncDtoSchema
};

// Export validation options
export { validationOptions };

// Helper function to validate Transit Gateway data with custom business rules
export const validateTransitGatewayWithBusinessRules = async (
  data: any,
  context: {
    operation: 'create' | 'update';
    existingTransitGateway?: any;
    existingAsns?: number[];
    existingPrimaryTgwId?: string;
    existingVpcCidrs?: string[];
  }
) => {
  // First validate with Joi schema
  const schema = context.operation === 'create' 
    ? createTransitGatewayDtoSchema 
    : updateTransitGatewayDtoSchema;
    
  const { error, value } = schema.validate(data, validationOptions);
  
  if (error) {
    return { error, value: null };
  }

  // Then apply custom business rules
  const businessErrors: string[] = [];

  // Check Amazon-side ASN validity for new Transit Gateways
  if (context.operation === 'create' && value.amazonSideAsn) {
    if (!transitGatewayValidationRules.validateAmazonSideAsn(value.amazonSideAsn)) {
      businessErrors.push(
        `Amazon-side ASN ${value.amazonSideAsn} is not in valid private ASN range ` +
        '(64512-65534 or 4200000000-4294967294)'
      );
    }

    // Check ASN conflicts within region
    if (context.existingAsns && 
        !transitGatewayValidationRules.validateAsnConflict(value.amazonSideAsn, context.existingAsns)) {
      businessErrors.push(`ASN ${value.amazonSideAsn} conflicts with existing Transit Gateway in the same region`);
    }
  }

  // Check state transitions for updates
  if (context.operation === 'update' && context.existingTransitGateway && value.state) {
    if (!transitGatewayValidationRules.validateStateTransition(
      context.existingTransitGateway.state, 
      value.state
    )) {
      businessErrors.push(
        `Invalid state transition from ${context.existingTransitGateway.state} to ${value.state}`
      );
    }
  }

  // Check primary Transit Gateway constraint
  if (value.isPrimary && value.region) {
    const currentId = context.existingTransitGateway?.id;
    if (!transitGatewayValidationRules.validatePrimaryConstraint(
      value.isPrimary,
      value.region,
      context.existingPrimaryTgwId,
      currentId
    )) {
      businessErrors.push(`Another Transit Gateway is already marked as primary in region ${value.region}`);
    }
  }

  // Check CIDR block overlaps with VPCs
  if (value.transitGatewayCidrBlocks && context.existingVpcCidrs) {
    const tgwCidrs = value.transitGatewayCidrBlocks.map((block: any) => block.cidr);
    const overlappingCidrs = transitGatewayValidationRules.validateCidrOverlap(
      tgwCidrs,
      context.existingVpcCidrs
    );
    
    if (overlappingCidrs.length > 0) {
      businessErrors.push(
        `Transit Gateway CIDR blocks overlap with existing VPC CIDRs: ${overlappingCidrs.join(', ')}`
      );
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