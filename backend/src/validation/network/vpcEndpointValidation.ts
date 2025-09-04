/**
 * VPC Endpoint validation schemas using Joi
 */

import Joi from 'joi';
import {
  uuidSchema,
  awsAccountIdSchema,
  awsVpcEndpointIdSchema,
  awsVpcIdSchema,
  awsRouteTableIdSchema,
  awsSubnetIdSchema,
  awsSecurityGroupIdSchema,
  awsNetworkInterfaceIdSchema,
  awsRegionSchema,
  networkResourceStateSchema,
  metadataSchema,
  businessContextSchema,
  syncMetadataSchema,
  baseQueryParamsSchema,
  createValidationSchema,
  validationOptions
} from '../common';

// VPC Endpoint type validation
export const vpcEndpointTypeSchema = Joi.string().valid('Gateway', 'Interface', 'GatewayLoadBalancer');

// VPC Endpoint service type validation
export const vpcEndpointServiceTypeSchema = Joi.string().valid('com.amazonaws', 'com.amazonaws.vpce', 'custom');

// AWS service name validation (e.g., com.amazonaws.us-east-1.s3)
export const awsServiceNameSchema = Joi.string()
  .pattern(/^com\.amazonaws(\.vpce)?(\.[a-z0-9-]+)*\.[a-z0-9-]+$/)
  .message('Service name must be a valid AWS service name format');

// VPC Endpoint DNS entry validation
export const vpcEndpointDnsEntrySchema = Joi.object({
  dnsName: Joi.string().domain().required(),
  hostedZoneId: Joi.string().max(32).optional()
});

// VPC Endpoint policy document validation
export const vpcEndpointPolicyDocumentSchema = Joi.object({
  Version: Joi.string().valid('2012-10-17').required(),
  Statement: Joi.array().items(
    Joi.object({
      Effect: Joi.string().valid('Allow', 'Deny').required(),
      Principal: Joi.alternatives().try(
        Joi.string(),
        Joi.object(),
        Joi.array()
      ).optional(),
      Action: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string())
      ).required(),
      Resource: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string())
      ).optional(),
      Condition: Joi.object().optional()
    })
  ).min(1).required()
});

// Core VPC Endpoint validation schema
export const vpcEndpointSchema = Joi.object({
  // Base entity fields
  id: uuidSchema.optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  deletedAt: Joi.date().optional().allow(null),

  // AWS identifiers
  awsVpcEndpointId: awsVpcEndpointIdSchema.required(),
  awsAccountId: awsAccountIdSchema.required(),
  region: awsRegionSchema.required(),
  regionId: uuidSchema.required(),
  statusId: uuidSchema.required(),
  vpcId: awsVpcIdSchema.required(),

  // Basic Configuration
  vpcEndpointType: vpcEndpointTypeSchema.required(),
  serviceName: awsServiceNameSchema.required(),

  // State information
  state: networkResourceStateSchema.required(),

  // Network Configuration
  routeTableIds: Joi.array()
    .items(awsRouteTableIdSchema)
    .optional()
    .allow(null),
  subnetIds: Joi.array()
    .items(awsSubnetIdSchema)
    .optional()
    .allow(null),
  securityGroupIds: Joi.array()
    .items(awsSecurityGroupIdSchema)
    .optional()
    .allow(null),

  // DNS Configuration
  privateDnsEnabled: Joi.boolean().optional().allow(null),
  dnsEntries: Joi.array()
    .items(vpcEndpointDnsEntrySchema)
    .optional()
    .allow(null),

  // Policy Configuration
  policyDocument: vpcEndpointPolicyDocumentSchema.optional().allow(null),

  // Service Configuration
  acceptanceRequired: Joi.boolean().optional().allow(null),

  // Network details
  networkInterfaceIds: Joi.array()
    .items(awsNetworkInterfaceIdSchema)
    .optional()
    .allow(null),

  // Creation timestamp from AWS
  creationTimestamp: Joi.date().optional().allow(null),

  // Metadata
  ...metadataSchema.describe().keys,

  // Sync information
  ...syncMetadataSchema.describe().keys,

  // Business context
  ...businessContextSchema.describe().keys
});

// VPC Endpoint Creation DTO validation
export const createVpcEndpointDtoSchema = createValidationSchema(
  Joi.object({
    // AWS identifiers
    awsVpcEndpointId: awsVpcEndpointIdSchema.required(),
    awsAccountId: awsAccountIdSchema.required(),
    region: awsRegionSchema.required(),
    regionId: uuidSchema.required(),
    statusId: uuidSchema.required(),
    vpcId: awsVpcIdSchema.required(),

    // Basic Configuration
    vpcEndpointType: vpcEndpointTypeSchema.required(),
    serviceName: awsServiceNameSchema.required(),

    // State
    state: networkResourceStateSchema.default('pending'),

    // Network Configuration - conditional based on endpoint type
    routeTableIds: Joi.array()
      .items(awsRouteTableIdSchema)
      .when('vpcEndpointType', {
        is: 'Gateway',
        then: Joi.required(),
        otherwise: Joi.forbidden()
      }),
    subnetIds: Joi.array()
      .items(awsSubnetIdSchema)
      .when('vpcEndpointType', {
        is: Joi.valid('Interface', 'GatewayLoadBalancer'),
        then: Joi.required(),
        otherwise: Joi.forbidden()
      }),
    securityGroupIds: Joi.array()
      .items(awsSecurityGroupIdSchema)
      .when('vpcEndpointType', {
        is: Joi.valid('Interface', 'GatewayLoadBalancer'),
        then: Joi.optional(),
        otherwise: Joi.forbidden()
      }),

    // DNS Configuration - Interface endpoints only
    privateDnsEnabled: Joi.boolean()
      .when('vpcEndpointType', {
        is: 'Interface',
        then: Joi.optional(),
        otherwise: Joi.forbidden()
      }),

    // Policy Configuration
    policyDocument: vpcEndpointPolicyDocumentSchema.optional(),

    // Service Configuration
    acceptanceRequired: Joi.boolean().optional(),

    // AWS creation timestamp
    creationTimestamp: Joi.date().optional(),

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

// VPC Endpoint Update DTO validation
export const updateVpcEndpointDtoSchema = createValidationSchema(
  Joi.object({
    // State updates
    state: networkResourceStateSchema.optional(),
    statusId: uuidSchema.optional(),

    // Network Configuration updates
    routeTableIds: Joi.array()
      .items(awsRouteTableIdSchema)
      .optional(),
    subnetIds: Joi.array()
      .items(awsSubnetIdSchema)
      .optional(),
    securityGroupIds: Joi.array()
      .items(awsSecurityGroupIdSchema)
      .optional(),

    // DNS Configuration updates
    privateDnsEnabled: Joi.boolean().optional(),

    // Policy Configuration updates
    policyDocument: vpcEndpointPolicyDocumentSchema.optional().allow(null),

    // Network details updates
    networkInterfaceIds: Joi.array()
      .items(awsNetworkInterfaceIdSchema)
      .optional(),

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

// VPC Endpoint Query Parameters validation
export const vpcEndpointQueryParamsSchema = createValidationSchema(
  baseQueryParamsSchema.concat(
    Joi.object({
      // VPC Endpoint-specific filters
      awsVpcEndpointId: awsVpcEndpointIdSchema.optional(),
      vpcId: awsVpcIdSchema.optional(),
      vpcEndpointType: vpcEndpointTypeSchema.optional(),
      serviceName: awsServiceNameSchema.optional(),
      serviceNamePattern: Joi.string().max(255).optional(),
      privateDnsEnabled: Joi.boolean().optional(),
      acceptanceRequired: Joi.boolean().optional(),
      routeTableId: awsRouteTableIdSchema.optional(),
      subnetId: awsSubnetIdSchema.optional(),
      securityGroupId: awsSecurityGroupIdSchema.optional(),

      // Boolean filters
      hasRouteTableAssociations: Joi.boolean().optional(),
      hasSubnetAssociations: Joi.boolean().optional(),
      hasSecurityGroupAssociations: Joi.boolean().optional(),
      hasPolicyDocument: Joi.boolean().optional(),

      // Date filters
      creationTimestampAfter: Joi.date().iso().optional(),
      creationTimestampBefore: Joi.date().iso().optional(),

      // Sorting specific to VPC Endpoint
      sortBy: Joi.string()
        .valid('createdAt', 'updatedAt', 'name', 'awsVpcEndpointId', 'serviceName', 'vpcEndpointType', 'region', 'lastSyncAt', 'creationTimestamp')
        .optional()
    })
  )
);

// VPC Endpoint Bulk Operation validation
export const bulkVpcEndpointOperationSchema = createValidationSchema(
  Joi.object({
    operation: Joi.string().valid('update', 'delete', 'sync').required(),
    vpcEndpointIds: Joi.array()
      .items(uuidSchema)
      .min(1)
      .max(100)
      .required(),
    updateData: updateVpcEndpointDtoSchema.when('operation', {
      is: 'update',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
  })
);

// VPC Endpoint Sync DTO validation
export const vpcEndpointSyncDtoSchema = createValidationSchema(
  Joi.object({
    awsVpcEndpointId: awsVpcEndpointIdSchema.required(),
    awsAccountId: awsAccountIdSchema.required(),
    region: awsRegionSchema.required(),
    forceSync: Joi.boolean().default(false)
  })
);

// VPC Endpoint-specific validation rules
export const vpcEndpointValidationRules = {
  // Validate endpoint type and service name compatibility
  validateServiceCompatibility: (endpointType: string, serviceName: string): boolean => {
    if (endpointType === 'Gateway') {
      // Gateway endpoints only support S3 and DynamoDB
      return serviceName.includes('.s3') || serviceName.includes('.dynamodb');
    }
    
    if (endpointType === 'Interface') {
      // Interface endpoints support most AWS services except S3 and DynamoDB
      return !serviceName.includes('.s3') && !serviceName.includes('.dynamodb');
    }
    
    if (endpointType === 'GatewayLoadBalancer') {
      // Gateway Load Balancer endpoints support VPC endpoint services
      return serviceName.includes('com.amazonaws.vpce');
    }
    
    return false;
  },

  // Validate state transitions
  validateStateTransition: (currentState: string, newState: string): boolean => {
    const validTransitions: Record<string, string[]> = {
      pending: ['available', 'failed'],
      available: ['deleting', 'failed'],
      deleting: ['deleted', 'failed'],
      failed: ['pending', 'deleting']
    };
    
    return validTransitions[currentState]?.includes(newState) ?? false;
  },

  // Validate route table belongs to same VPC (for Gateway endpoints)
  validateRouteTableVpc: (routeTableVpcId: string, vpcId: string): boolean => {
    return routeTableVpcId === vpcId;
  },

  // Validate subnet belongs to same VPC (for Interface endpoints)
  validateSubnetVpc: (subnetVpcId: string, vpcId: string): boolean => {
    return subnetVpcId === vpcId;
  },

  // Validate security group belongs to same VPC
  validateSecurityGroupVpc: (sgVpcId: string, vpcId: string): boolean => {
    return sgVpcId === vpcId;
  },

  // Validate service name format and region compatibility
  validateServiceName: (serviceName: string, region: string): boolean => {
    // Check if service name includes the correct region
    if (serviceName.startsWith('com.amazonaws.')) {
      const parts = serviceName.split('.');
      if (parts.length >= 4) {
        const serviceRegion = parts[2];
        return serviceRegion === region;
      }
    }
    return true; // For custom services or other formats
  },

  // Validate policy document structure
  validatePolicyDocument: (policy: any): boolean => {
    try {
      // Basic structure validation
      return policy && 
             policy.Version === '2012-10-17' && 
             Array.isArray(policy.Statement) && 
             policy.Statement.length > 0;
    } catch {
      return false;
    }
  }
};

// VPC Endpoint validation middleware schemas
export const vpcEndpointValidationSchemas = {
  create: createVpcEndpointDtoSchema,
  update: updateVpcEndpointDtoSchema,
  query: vpcEndpointQueryParamsSchema,
  bulk: bulkVpcEndpointOperationSchema,
  sync: vpcEndpointSyncDtoSchema
};

// Export validation options
export { validationOptions };

// Helper function to validate VPC Endpoint data with custom business rules
export const validateVpcEndpointWithBusinessRules = async (
  data: any,
  context: {
    operation: 'create' | 'update';
    existingVpcEndpoint?: any;
    vpcInfo?: { id: string; region: string };
    routeTableVpcIds?: Record<string, string>;
    subnetVpcIds?: Record<string, string>;
    securityGroupVpcIds?: Record<string, string>;
  }
) => {
  // First validate with Joi schema
  const schema = context.operation === 'create' 
    ? createVpcEndpointDtoSchema 
    : updateVpcEndpointDtoSchema;
    
  const { error, value } = schema.validate(data, validationOptions);
  
  if (error) {
    return { error, value: null };
  }

  // Then apply custom business rules
  const businessErrors: string[] = [];

  // Check endpoint type and service compatibility
  if (context.operation === 'create') {
    if (!vpcEndpointValidationRules.validateServiceCompatibility(
      value.vpcEndpointType, 
      value.serviceName
    )) {
      businessErrors.push(
        `Service ${value.serviceName} is not compatible with endpoint type ${value.vpcEndpointType}`
      );
    }

    // Validate service name region compatibility
    if (context.vpcInfo && !vpcEndpointValidationRules.validateServiceName(
      value.serviceName, 
      context.vpcInfo.region
    )) {
      businessErrors.push(
        `Service ${value.serviceName} region does not match VPC region ${context.vpcInfo.region}`
      );
    }
  }

  // Check state transitions for updates
  if (context.operation === 'update' && context.existingVpcEndpoint && value.state) {
    if (!vpcEndpointValidationRules.validateStateTransition(
      context.existingVpcEndpoint.state, 
      value.state
    )) {
      businessErrors.push(
        `Invalid state transition from ${context.existingVpcEndpoint.state} to ${value.state}`
      );
    }
  }

  // Validate route table VPC associations
  if (value.routeTableIds && context.routeTableVpcIds && context.vpcInfo) {
    const invalidRouteTables = value.routeTableIds.filter((rtId: string) => {
      const rtVpcId = context.routeTableVpcIds![rtId];
      return rtVpcId && rtVpcId !== context.vpcInfo!.id;
    });
    
    if (invalidRouteTables.length > 0) {
      businessErrors.push(
        `Route tables do not belong to the same VPC: ${invalidRouteTables.join(', ')}`
      );
    }
  }

  // Validate subnet VPC associations
  if (value.subnetIds && context.subnetVpcIds && context.vpcInfo) {
    const invalidSubnets = value.subnetIds.filter((subnetId: string) => {
      const subnetVpcId = context.subnetVpcIds![subnetId];
      return subnetVpcId && subnetVpcId !== context.vpcInfo!.id;
    });
    
    if (invalidSubnets.length > 0) {
      businessErrors.push(
        `Subnets do not belong to the same VPC: ${invalidSubnets.join(', ')}`
      );
    }
  }

  // Validate security group VPC associations
  if (value.securityGroupIds && context.securityGroupVpcIds && context.vpcInfo) {
    const invalidSecurityGroups = value.securityGroupIds.filter((sgId: string) => {
      const sgVpcId = context.securityGroupVpcIds![sgId];
      return sgVpcId && sgVpcId !== context.vpcInfo!.id;
    });
    
    if (invalidSecurityGroups.length > 0) {
      businessErrors.push(
        `Security groups do not belong to the same VPC: ${invalidSecurityGroups.join(', ')}`
      );
    }
  }

  // Validate policy document if provided
  if (value.policyDocument && 
      !vpcEndpointValidationRules.validatePolicyDocument(value.policyDocument)) {
    businessErrors.push('VPC Endpoint policy document has invalid structure');
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