/**
 * Test Setup for Validators
 * 
 * Common setup and utilities for validator tests
 */

import { ValidationContext, ValidationLocation, ImportValidationOptions } from '../types';

/**
 * Create a mock validation context for testing
 */
export function createMockValidationContext(
  resourceType: string,
  overrides?: Partial<ValidationContext>
): ValidationContext {
  return {
    resourceType,
    operation: 'create',
    existingData: new Map(),
    referenceData: new Map(),
    options: {
      strict: false,
      skipWarnings: false,
      validateReferences: true,
      validateBusinessRules: true,
      maxErrors: 100,
      timeout: 30000
    },
    ...overrides
  };
}

/**
 * Create a mock validation location for testing
 */
export function createMockValidationLocation(
  overrides?: Partial<ValidationLocation>
): ValidationLocation {
  return {
    row: 1,
    column: 1,
    line: 1,
    fieldPath: 'test',
    ...overrides
  };
}

/**
 * Create mock import validation options for testing
 */
export function createMockImportOptions(
  overrides?: Partial<ImportValidationOptions>
): ImportValidationOptions {
  return {
    fileType: 'csv',
    hasHeaders: true,
    validateReferences: true,
    validateBusinessRules: true,
    strict: false,
    batchSize: 100,
    ...overrides
  };
}

/**
 * Sample valid VPC record for testing
 */
export const VALID_VPC_RECORD = {
  awsVpcId: 'vpc-1234567890abcdef0',
  awsAccountId: '123456789012',
  cidrBlock: '10.0.0.0/16',
  region: 'us-west-2',
  name: 'test-vpc',
  environment: 'dev',
  isDefault: false,
  enableDnsHostnames: true,
  enableDnsSupport: true,
  instanceTenancy: 'default' as const,
  tags: {
    Environment: 'dev',
    Project: 'test',
    Owner: 'test-team'
  }
};

/**
 * Sample valid subnet record for testing
 */
export const VALID_SUBNET_RECORD = {
  awsSubnetId: 'subnet-1234567890abcdef0',
  awsVpcId: 'vpc-1234567890abcdef0',
  awsAccountId: '123456789012',
  cidrBlock: '10.0.1.0/24',
  availabilityZone: 'us-west-2a',
  name: 'test-subnet',
  subnetType: 'private' as const,
  mapPublicIpOnLaunch: false,
  isDefault: false,
  tags: {
    Environment: 'dev',
    Project: 'test',
    SubnetType: 'private'
  }
};

/**
 * Sample valid transit gateway record for testing
 */
export const VALID_TGW_RECORD = {
  awsTransitGatewayId: 'tgw-1234567890abcdef0',
  awsAccountId: '123456789012',
  name: 'test-tgw',
  description: 'Test transit gateway',
  state: 'available' as const,
  amazonSideAsn: 64512,
  autoAcceptSharedAttachments: 'enable' as const,
  defaultRouteTableAssociation: 'enable' as const,
  defaultRouteTablePropagation: 'enable' as const,
  tags: {
    Environment: 'dev',
    Project: 'test'
  }
};

/**
 * Collection of invalid AWS resource IDs for testing
 */
export const INVALID_AWS_IDS = {
  vpc: [
    'vpc-123', // Too short
    'vpc-xyz123', // Invalid characters
    'subnet-1234567890abcdef0', // Wrong prefix
    'vpc-', // Missing identifier
    '', // Empty
    'vpc 1234567890abcdef0' // Contains space
  ],
  subnet: [
    'subnet-123',
    'vpc-1234567890abcdef0',
    'subnet-xyz123',
    'invalid-subnet-id'
  ],
  account: [
    '12345678901', // Too short
    '1234567890123', // Too long
    '12345678901a', // Contains letter
    '123-456-789012' // Contains hyphens
  ],
  tgw: [
    'tgw-123',
    'vpc-1234567890abcdef0',
    'tgw-xyz123'
  ]
};

/**
 * Collection of invalid CIDR blocks for testing
 */
export const INVALID_CIDRS = [
  '10.0.0.0/33', // Invalid prefix
  '256.0.0.0/16', // Invalid IP
  '10.0.0.0/-1', // Negative prefix
  '10.0.0.0', // Missing prefix
  '10.0.0.0/16/24', // Double prefix
  'invalid-cidr',
  '10.0.0/16' // Incomplete IP
];

/**
 * Collection of valid CIDR blocks for testing
 */
export const VALID_CIDRS = [
  '10.0.0.0/16',
  '192.168.1.0/24',
  '172.16.0.0/12',
  '0.0.0.0/0',
  '10.0.0.0/8',
  '192.168.0.1/32'
];

/**
 * Collection of valid AWS regions for testing
 */
export const VALID_AWS_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'ap-southeast-1',
  'ca-central-1',
  'sa-east-1'
];

/**
 * Collection of valid availability zones for testing
 */
export const VALID_AVAILABILITY_ZONES = [
  'us-east-1a',
  'us-west-2b',
  'eu-west-1c',
  'ap-southeast-1d'
];

/**
 * Helper function to create a large dataset for performance testing
 */
export function createLargeDataset(
  count: number,
  recordType: 'vpc' | 'subnet' | 'tgw' = 'vpc'
): any[] {
  const records = [];
  
  for (let i = 0; i < count; i++) {
    switch (recordType) {
      case 'vpc':
        records.push({
          ...VALID_VPC_RECORD,
          awsVpcId: `vpc-${i.toString().padStart(17, '0')}`,
          name: `vpc-${i}`,
          cidrBlock: `10.${Math.floor(i / 256)}.${i % 256}.0/24`
        });
        break;
      case 'subnet':
        records.push({
          ...VALID_SUBNET_RECORD,
          awsSubnetId: `subnet-${i.toString().padStart(17, '0')}`,
          name: `subnet-${i}`,
          cidrBlock: `10.0.${Math.floor(i / 256)}.${i % 256}/28`
        });
        break;
      case 'tgw':
        records.push({
          ...VALID_TGW_RECORD,
          awsTransitGatewayId: `tgw-${i.toString().padStart(17, '0')}`,
          name: `tgw-${i}`
        });
        break;
    }
  }
  
  return records;
}

/**
 * Helper function to create records with specific validation errors
 */
export function createRecordsWithErrors(
  errorTypes: string[],
  resourceType: 'vpc' | 'subnet' | 'tgw' = 'vpc'
): any[] {
  const records = [];
  
  for (const errorType of errorTypes) {
    let record: any;
    
    switch (resourceType) {
      case 'vpc':
        record = { ...VALID_VPC_RECORD };
        break;
      case 'subnet':
        record = { ...VALID_SUBNET_RECORD };
        break;
      case 'tgw':
        record = { ...VALID_TGW_RECORD };
        break;
    }
    
    // Introduce specific errors
    switch (errorType) {
      case 'INVALID_ID_FORMAT':
        record[resourceType === 'vpc' ? 'awsVpcId' : 
               resourceType === 'subnet' ? 'awsSubnetId' : 
               'awsTransitGatewayId'] = 'invalid-id';
        break;
      case 'MISSING_REQUIRED_FIELD':
        delete record.awsAccountId;
        break;
      case 'INVALID_CIDR':
        if (record.cidrBlock) {
          record.cidrBlock = '256.0.0.0/16';
        }
        break;
      case 'INVALID_ENUM':
        if (record.environment) {
          record.environment = 'invalid-env';
        }
        break;
      case 'LENGTH_VIOLATION':
        record.name = 'x'.repeat(300);
        break;
    }
    
    records.push(record);
  }
  
  return records;
}

/**
 * Async helper to wait for a specified time (useful for timeout tests)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to create validation results for testing aggregation
 */
export function createMockValidationResults(
  count: number,
  validCount: number
): any[] {
  const results = [];
  
  for (let i = 0; i < count; i++) {
    const isValid = i < validCount;
    results.push({
      isValid,
      errors: isValid ? [] : [
        {
          field: 'test',
          value: 'invalid',
          message: `Test error ${i}`,
          code: 'TEST_ERROR',
          severity: 'error'
        }
      ],
      warnings: [],
      metadata: {
        totalRecords: 1,
        validRecords: isValid ? 1 : 0,
        errorCount: isValid ? 0 : 1,
        warningCount: 0,
        validationTime: 10,
        validatedAt: new Date()
      }
    });
  }
  
  return results;
}