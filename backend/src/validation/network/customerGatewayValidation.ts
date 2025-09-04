/**
 * Customer Gateway validation schemas using Joi
 */

import Joi from 'joi';
import {
  uuidSchema,
  awsAccountIdSchema,
  awsCustomerGatewayIdSchema,
  awsRegionSchema,
  networkResourceStateSchema,
  ipv4AddressSchema,
  cidrBlockSchema,
  bgpAsnSchema,
  metadataSchema,
  businessContextSchema,
  syncMetadataSchema,
  baseQueryParamsSchema,
  createValidationSchema,
  validationOptions
} from '../common';

// Customer Gateway type validation
export const customerGatewayTypeSchema = Joi.string().valid('ipsec.1');

// Phone number validation (international format)
export const phoneNumberSchema = Joi.string()
  .pattern(/^\+?[1-9]\d{1,14}$/)
  .message('Phone number must be in valid international format');

// Email validation
export const emailSchema = Joi.string().email();

// ARN validation for certificate
export const certificateArnSchema = Joi.string()
  .pattern(/^arn:aws:acm:[a-z0-9-]+:\d{12}:certificate\/[a-f0-9-]{36}$/)
  .message('Certificate ARN must be a valid AWS ACM certificate ARN');

// Maintenance window validation (e.g., "Sun:03:00-Sun:04:00")
export const maintenanceWindowSchema = Joi.string()
  .pattern(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun):\d{2}:\d{2}-(Mon|Tue|Wed|Thu|Fri|Sat|Sun):\d{2}:\d{2}$/)
  .message('Maintenance window must be in format "Day:HH:MM-Day:HH:MM"');

// Core Customer Gateway validation schema
export const customerGatewaySchema = Joi.object({
  // Base entity fields
  id: uuidSchema.optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  deletedAt: Joi.date().optional().allow(null),

  // AWS identifiers
  awsCustomerGatewayId: awsCustomerGatewayIdSchema.required(),
  awsAccountId: awsAccountIdSchema.required(),
  region: awsRegionSchema.required(),
  regionId: uuidSchema.required(),
  statusId: uuidSchema.required(),

  // Basic Configuration
  type: customerGatewayTypeSchema.default('ipsec.1'),
  ipAddress: ipv4AddressSchema.required(),
  bgpAsn: bgpAsnSchema.required(),

  // State information
  state: networkResourceStateSchema.required(),

  // Device Configuration
  deviceName: Joi.string().max(255).optional().allow(null),
  deviceModel: Joi.string().max(100).optional().allow(null),
  deviceVendor: Joi.string().max(100).optional().allow(null),
  deviceSoftwareVersion: Joi.string().max(100).optional().allow(null),

  // Network Configuration
  insideIpv4NetworkCidr: cidrBlockSchema.optional().allow(null),
  outsideIpAddress: ipv4AddressSchema.optional().allow(null),

  // Certificate-based Authentication
  certificateArn: certificateArnSchema.optional().allow(null),

  // Metadata
  ...metadataSchema.describe().keys,

  // Sync information
  ...syncMetadataSchema.describe().keys,

  // Business context
  ...businessContextSchema.describe().keys,

  // Physical Location and Contact
  siteLocation: Joi.string().max(255).optional().allow(null),
  siteAddress: Joi.string().max(1000).optional().allow(null),
  contactPerson: Joi.string().max(255).optional().allow(null),
  contactPhone: phoneNumberSchema.optional().allow(null),
  contactEmail: emailSchema.optional().allow(null),

  // Operational Information
  maintenanceWindow: maintenanceWindowSchema.optional().allow(null),
  isPrimary: Joi.boolean().default(false),
  redundancyGroup: Joi.string().max(100).optional().allow(null)
});

// Customer Gateway Creation DTO validation
export const createCustomerGatewayDtoSchema = createValidationSchema(
  Joi.object({
    // AWS identifiers
    awsCustomerGatewayId: awsCustomerGatewayIdSchema.required(),
    awsAccountId: awsAccountIdSchema.required(),
    region: awsRegionSchema.required(),
    regionId: uuidSchema.required(),
    statusId: uuidSchema.required(),

    // Basic Configuration
    type: customerGatewayTypeSchema.default('ipsec.1'),
    ipAddress: ipv4AddressSchema.required(),
    bgpAsn: bgpAsnSchema.required(),

    // State
    state: networkResourceStateSchema.default('pending'),

    // Device Configuration
    deviceName: Joi.string().max(255).optional(),
    deviceModel: Joi.string().max(100).optional(),
    deviceVendor: Joi.string().max(100).optional(),
    deviceSoftwareVersion: Joi.string().max(100).optional(),

    // Network Configuration
    insideIpv4NetworkCidr: cidrBlockSchema.optional(),
    outsideIpAddress: ipv4AddressSchema.optional(),

    // Certificate-based Authentication
    certificateArn: certificateArnSchema.optional(),

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
    owner: Joi.string().max(255).optional(),

    // Physical Location and Contact
    siteLocation: Joi.string().max(255).optional(),
    siteAddress: Joi.string().max(1000).optional(),
    contactPerson: Joi.string().max(255).optional(),
    contactPhone: phoneNumberSchema.optional(),
    contactEmail: emailSchema.optional(),

    // Operational Information
    maintenanceWindow: maintenanceWindowSchema.optional(),
    isPrimary: Joi.boolean().default(false),
    redundancyGroup: Joi.string().max(100).optional()
  })
);

// Customer Gateway Update DTO validation
export const updateCustomerGatewayDtoSchema = createValidationSchema(
  Joi.object({
    // Note: ipAddress and bgpAsn typically cannot be changed after creation
    // as it would require recreating the customer gateway in AWS

    // State updates
    state: networkResourceStateSchema.optional(),
    statusId: uuidSchema.optional(),

    // Device Configuration updates
    deviceName: Joi.string().max(255).optional().allow(null),
    deviceModel: Joi.string().max(100).optional().allow(null),
    deviceVendor: Joi.string().max(100).optional().allow(null),
    deviceSoftwareVersion: Joi.string().max(100).optional().allow(null),

    // Network Configuration updates
    insideIpv4NetworkCidr: cidrBlockSchema.optional().allow(null),
    outsideIpAddress: ipv4AddressSchema.optional().allow(null),

    // Certificate-based Authentication updates
    certificateArn: certificateArnSchema.optional().allow(null),

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
    owner: Joi.string().max(255).optional().allow(null),

    // Physical Location and Contact updates
    siteLocation: Joi.string().max(255).optional().allow(null),
    siteAddress: Joi.string().max(1000).optional().allow(null),
    contactPerson: Joi.string().max(255).optional().allow(null),
    contactPhone: phoneNumberSchema.optional().allow(null),
    contactEmail: emailSchema.optional().allow(null),

    // Operational Information updates
    maintenanceWindow: maintenanceWindowSchema.optional().allow(null),
    isPrimary: Joi.boolean().optional(),
    redundancyGroup: Joi.string().max(100).optional().allow(null)
  }).min(1) // At least one field must be provided for update
);

// Customer Gateway Query Parameters validation
export const customerGatewayQueryParamsSchema = createValidationSchema(
  baseQueryParamsSchema.concat(
    Joi.object({
      // Customer Gateway-specific filters
      awsCustomerGatewayId: awsCustomerGatewayIdSchema.optional(),
      type: customerGatewayTypeSchema.optional(),
      ipAddress: ipv4AddressSchema.optional(),
      bgpAsn: bgpAsnSchema.optional(),
      bgpAsnMin: bgpAsnSchema.optional(),
      bgpAsnMax: bgpAsnSchema.optional(),
      siteLocation: Joi.string().max(255).optional(),
      isPrimary: Joi.boolean().optional(),
      redundancyGroup: Joi.string().max(100).optional(),
      deviceVendor: Joi.string().max(100).optional(),
      deviceModel: Joi.string().max(100).optional(),
      contactPerson: Joi.string().max(255).optional(),
      contactEmail: emailSchema.optional(),

      // Boolean filters for optional fields
      hasInsideIpv4NetworkCidr: Joi.boolean().optional(),
      hasOutsideIpAddress: Joi.boolean().optional(),
      hasCertificateArn: Joi.boolean().optional(),
      hasContactInfo: Joi.boolean().optional(),
      hasMaintenanceWindow: Joi.boolean().optional(),

      // Sorting specific to Customer Gateway
      sortBy: Joi.string()
        .valid('createdAt', 'updatedAt', 'name', 'awsCustomerGatewayId', 'ipAddress', 'bgpAsn', 'siteLocation', 'region', 'lastSyncAt')
        .optional()
    })
  )
);

// Customer Gateway Bulk Operation validation
export const bulkCustomerGatewayOperationSchema = createValidationSchema(
  Joi.object({
    operation: Joi.string().valid('update', 'delete', 'sync').required(),
    customerGatewayIds: Joi.array()
      .items(uuidSchema)
      .min(1)
      .max(100)
      .required(),
    updateData: updateCustomerGatewayDtoSchema.when('operation', {
      is: 'update',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
  })
);

// Customer Gateway Sync DTO validation
export const customerGatewaySyncDtoSchema = createValidationSchema(
  Joi.object({
    awsCustomerGatewayId: awsCustomerGatewayIdSchema.required(),
    awsAccountId: awsAccountIdSchema.required(),
    region: awsRegionSchema.required(),
    forceSync: Joi.boolean().default(false)
  })
);

// Customer Gateway-specific validation rules
export const customerGatewayValidationRules = {
  // Validate IP address conflicts
  validateIpConflict: (ipAddress: string, existingIps: string[] = []): boolean => {
    return !existingIps.includes(ipAddress);
  },

  // Validate BGP ASN is customer ASN (not Amazon reserved)
  validateCustomerAsn: (asn: number): boolean => {
    // Customer ASNs should not be in Amazon reserved ranges
    // Amazon uses: 7224, 9059, 10124, 17493, and 64512-65534
    const amazonReservedAsns = [7224, 9059, 10124, 17493];
    const amazonPrivateRange = asn >= 64512 && asn <= 65534;
    
    return !amazonReservedAsns.includes(asn) && !amazonPrivateRange;
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

  // Validate only one primary customer gateway per site location
  validatePrimaryConstraint: (
    isPrimary: boolean,
    siteLocation: string,
    redundancyGroup: string | null,
    existingPrimaryCgwId?: string,
    currentCgwId?: string
  ): boolean => {
    if (!isPrimary) return true;
    
    // If no site location specified, can't enforce constraint
    if (!siteLocation) return true;
    
    return !existingPrimaryCgwId || existingPrimaryCgwId === currentCgwId;
  },

  // Validate maintenance window format and logic
  validateMaintenanceWindow: (window: string): boolean => {
    const pattern = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun):(\d{2}):(\d{2})-(Mon|Tue|Wed|Thu|Fri|Sat|Sun):(\d{2}):(\d{2})$/;
    const match = window.match(pattern);
    
    if (!match) return false;
    
    const [, startDay, startHour, startMin, endDay, endHour, endMin] = match;
    
    // Validate hours and minutes
    const startHourNum = parseInt(startHour);
    const startMinNum = parseInt(startMin);
    const endHourNum = parseInt(endHour);
    const endMinNum = parseInt(endMin);
    
    if (startHourNum > 23 || endHourNum > 23 || startMinNum > 59 || endMinNum > 59) {
      return false;
    }
    
    // Could add more logic to validate that end time is after start time
    return true;
  },

  // Validate inside IPv4 network CIDR doesn't conflict
  validateInsideCidrConflict: (
    cidr: string,
    existingCidrs: string[] = []
  ): boolean => {
    // This would implement actual CIDR overlap detection
    return !existingCidrs.includes(cidr);
  }
};

// Customer Gateway validation middleware schemas
export const customerGatewayValidationSchemas = {
  create: createCustomerGatewayDtoSchema,
  update: updateCustomerGatewayDtoSchema,
  query: customerGatewayQueryParamsSchema,
  bulk: bulkCustomerGatewayOperationSchema,
  sync: customerGatewaySyncDtoSchema
};

// Export validation options
export { validationOptions };

// Helper function to validate Customer Gateway data with custom business rules
export const validateCustomerGatewayWithBusinessRules = async (
  data: any,
  context: {
    operation: 'create' | 'update';
    existingCustomerGateway?: any;
    existingIpAddresses?: string[];
    existingPrimaryCgwId?: string;
    existingInsideCidrs?: string[];
  }
) => {
  // First validate with Joi schema
  const schema = context.operation === 'create' 
    ? createCustomerGatewayDtoSchema 
    : updateCustomerGatewayDtoSchema;
    
  const { error, value } = schema.validate(data, validationOptions);
  
  if (error) {
    return { error, value: null };
  }

  // Then apply custom business rules
  const businessErrors: string[] = [];

  // Check IP address conflicts for new Customer Gateways
  if (context.operation === 'create' && context.existingIpAddresses) {
    if (!customerGatewayValidationRules.validateIpConflict(
      value.ipAddress, 
      context.existingIpAddresses
    )) {
      businessErrors.push(`IP address ${value.ipAddress} conflicts with existing Customer Gateway`);
    }
  }

  // Check BGP ASN validity for new Customer Gateways
  if (context.operation === 'create' && value.bgpAsn) {
    if (!customerGatewayValidationRules.validateCustomerAsn(value.bgpAsn)) {
      businessErrors.push(
        `BGP ASN ${value.bgpAsn} is reserved for Amazon use. ` +
        'Please use a customer ASN outside of Amazon reserved ranges.'
      );
    }
  }

  // Check state transitions for updates
  if (context.operation === 'update' && context.existingCustomerGateway && value.state) {
    if (!customerGatewayValidationRules.validateStateTransition(
      context.existingCustomerGateway.state, 
      value.state
    )) {
      businessErrors.push(
        `Invalid state transition from ${context.existingCustomerGateway.state} to ${value.state}`
      );
    }
  }

  // Check primary Customer Gateway constraint
  if (value.isPrimary && value.siteLocation) {
    const currentId = context.existingCustomerGateway?.id;
    if (!customerGatewayValidationRules.validatePrimaryConstraint(
      value.isPrimary,
      value.siteLocation,
      value.redundancyGroup,
      context.existingPrimaryCgwId,
      currentId
    )) {
      businessErrors.push(
        `Another Customer Gateway is already marked as primary for site location: ${value.siteLocation}`
      );
    }
  }

  // Validate maintenance window format if provided
  if (value.maintenanceWindow && 
      !customerGatewayValidationRules.validateMaintenanceWindow(value.maintenanceWindow)) {
    businessErrors.push(`Invalid maintenance window format: ${value.maintenanceWindow}`);
  }

  // Check inside IPv4 CIDR conflicts
  if (value.insideIpv4NetworkCidr && context.existingInsideCidrs) {
    if (!customerGatewayValidationRules.validateInsideCidrConflict(
      value.insideIpv4NetworkCidr,
      context.existingInsideCidrs
    )) {
      businessErrors.push(
        `Inside IPv4 CIDR ${value.insideIpv4NetworkCidr} conflicts with existing Customer Gateway`
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