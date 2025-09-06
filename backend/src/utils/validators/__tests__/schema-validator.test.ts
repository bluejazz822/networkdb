/**
 * Schema Validator Tests
 * 
 * Comprehensive tests for schema-based validation
 */

import { SchemaValidator } from '../schema-validator';
import {
  ValidationResult,
  ValidationContext,
  SchemaValidationRule,
  ValidationLocation
} from '../types';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;
  let mockContext: ValidationContext;
  let mockLocation: ValidationLocation;

  beforeEach(() => {
    validator = new SchemaValidator();
    mockContext = {
      resourceType: 'vpc',
      operation: 'create',
      existingData: new Map(),
      referenceData: new Map(),
      options: {
        strict: false,
        validateReferences: true,
        validateBusinessRules: true
      }
    };
    mockLocation = {
      row: 1,
      column: 1,
      fieldPath: 'test'
    };
  });

  describe('VPC Schema Validation', () => {
    it('should validate a valid VPC record', async () => {
      const validVpc = {
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.0.0/16',
        region: 'us-west-2',
        name: 'test-vpc',
        environment: 'dev',
        isDefault: false,
        enableDnsHostnames: true,
        enableDnsSupport: true,
        instanceTenancy: 'default'
      };

      const result = await validator.validate(validVpc, 'vpc', mockContext, mockLocation);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.totalRecords).toBe(1);
      expect(result.metadata.validRecords).toBe(1);
    });

    it('should fail validation for missing required fields', async () => {
      const invalidVpc = {
        awsVpcId: 'vpc-1234567890abcdef0',
        // Missing required fields: awsAccountId, cidrBlock, region
        name: 'test-vpc'
      };

      const result = await validator.validate(invalidVpc, 'vpc', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3); // Missing awsAccountId, cidrBlock, region
      
      const errorCodes = result.errors.map(e => e.code);
      expect(errorCodes).toContain('REQUIRED_FIELD_MISSING');
      
      const missingFields = result.errors.map(e => e.field);
      expect(missingFields).toContain('awsAccountId');
      expect(missingFields).toContain('cidrBlock');
      expect(missingFields).toContain('region');
    });

    it('should fail validation for invalid AWS VPC ID format', async () => {
      const invalidVpc = {
        awsVpcId: 'invalid-vpc-id',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.0.0/16',
        region: 'us-west-2'
      };

      const result = await validator.validate(invalidVpc, 'vpc', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_FORMAT');
      expect(result.errors[0].field).toBe('awsVpcId');
    });

    it('should fail validation for invalid CIDR block', async () => {
      const invalidVpc = {
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '256.0.0.0/16', // Invalid IP address
        region: 'us-west-2'
      };

      const result = await validator.validate(invalidVpc, 'vpc', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_FORMAT');
      expect(result.errors[0].field).toBe('cidrBlock');
    });

    it('should fail validation for invalid environment enum', async () => {
      const invalidVpc = {
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.0.0/16',
        region: 'us-west-2',
        environment: 'invalid-env'
      };

      const result = await validator.validate(invalidVpc, 'vpc', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_ENUM_VALUE');
      expect(result.errors[0].field).toBe('environment');
    });

    it('should validate string length constraints', async () => {
      const invalidVpc = {
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.0.0/16',
        region: 'us-west-2',
        name: 'x'.repeat(300), // Exceeds maxLength of 255
        description: 'x'.repeat(1500) // Exceeds maxLength of 1000
      };

      const result = await validator.validate(invalidVpc, 'vpc', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      
      const errorCodes = result.errors.map(e => e.code);
      expect(errorCodes).toContain('MAX_LENGTH_VIOLATION');
      
      const errorFields = result.errors.map(e => e.field);
      expect(errorFields).toContain('name');
      expect(errorFields).toContain('description');
    });
  });

  describe('Subnet Schema Validation', () => {
    it('should validate a valid subnet record', async () => {
      const validSubnet = {
        awsSubnetId: 'subnet-1234567890abcdef0',
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-west-2a',
        name: 'test-subnet',
        subnetType: 'private',
        mapPublicIpOnLaunch: false,
        isDefault: false
      };

      const result = await validator.validate(validSubnet, 'subnet', mockContext, mockLocation);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid subnet ID format', async () => {
      const invalidSubnet = {
        awsSubnetId: 'invalid-subnet-id',
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-west-2a'
      };

      const result = await validator.validate(invalidSubnet, 'subnet', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_FORMAT');
      expect(result.errors[0].field).toBe('awsSubnetId');
    });

    it('should fail validation for invalid availability zone format', async () => {
      const invalidSubnet = {
        awsSubnetId: 'subnet-1234567890abcdef0',
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'invalid-az'
      };

      const result = await validator.validate(invalidSubnet, 'subnet', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_FORMAT');
      expect(result.errors[0].field).toBe('availabilityZone');
    });
  });

  describe('Transit Gateway Schema Validation', () => {
    it('should validate a valid transit gateway record', async () => {
      const validTgw = {
        awsTransitGatewayId: 'tgw-1234567890abcdef0',
        awsAccountId: '123456789012',
        name: 'test-tgw',
        description: 'Test transit gateway',
        amazonSideAsn: 64512,
        autoAcceptSharedAttachments: 'enable',
        defaultRouteTableAssociation: 'enable',
        defaultRouteTablePropagation: 'enable'
      };

      const result = await validator.validate(validTgw, 'transitGateway', mockContext, mockLocation);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid ASN range', async () => {
      const invalidTgw = {
        awsTransitGatewayId: 'tgw-1234567890abcdef0',
        awsAccountId: '123456789012',
        amazonSideAsn: 100000 // Outside valid range
      };

      const result = await validator.validate(invalidTgw, 'transitGateway', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MAX_VALUE_VIOLATION');
      expect(result.errors[0].field).toBe('amazonSideAsn');
    });
  });

  describe('Custom Schema Registration', () => {
    it('should allow custom schema registration', () => {
      const customSchema: SchemaValidationRule = {
        resourceType: 'customResource',
        version: '1.0',
        requiredFields: ['id', 'name'],
        fields: {
          id: {
            field: 'id',
            required: true,
            type: 'string',
            pattern: /^custom-[a-f0-9]+$/
          },
          name: {
            field: 'name',
            required: true,
            type: 'string',
            maxLength: 100
          }
        }
      };

      validator.registerSchema(customSchema);

      const schema = validator.getSchema('customResource');
      expect(schema).toBeDefined();
      expect(schema?.resourceType).toBe('customResource');
    });

    it('should validate against custom schema', async () => {
      const customSchema: SchemaValidationRule = {
        resourceType: 'customResource',
        version: '1.0',
        requiredFields: ['id', 'name'],
        fields: {
          id: {
            field: 'id',
            required: true,
            type: 'string',
            pattern: /^custom-[a-f0-9]+$/
          },
          name: {
            field: 'name',
            required: true,
            type: 'string',
            maxLength: 100
          }
        }
      };

      validator.registerSchema(customSchema);

      const validRecord = {
        id: 'custom-123abc',
        name: 'Test Custom Resource'
      };

      const result = await validator.validate(validRecord, 'customResource', mockContext, mockLocation);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Schema Definition Validation', () => {
    it('should validate schema definitions', () => {
      const validSchema: SchemaValidationRule = {
        resourceType: 'testResource',
        version: '1.0',
        requiredFields: ['id'],
        fields: {
          id: {
            field: 'id',
            required: true,
            type: 'string'
          }
        }
      };

      const result = validator.validateSchema(validSchema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid schema definitions', () => {
      const invalidSchema: SchemaValidationRule = {
        resourceType: '',
        version: '1.0',
        requiredFields: ['id'],
        fields: {}
      };

      const result = validator.validateSchema(invalidSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const result = await validator.validate({}, 'nonexistent-schema', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SCHEMA_NOT_FOUND');
    });

    it('should handle malformed data gracefully', async () => {
      const malformedData = {
        awsVpcId: { invalid: 'object' }, // Should be string
        awsAccountId: 123456789012, // Should be string
        cidrBlock: null,
        region: undefined
      };

      const result = await validator.validate(malformedData, 'vpc', mockContext, mockLocation);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should complete validation within reasonable time', async () => {
      const validVpc = {
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.0.0/16',
        region: 'us-west-2'
      };

      const startTime = Date.now();
      const result = await validator.validate(validVpc, 'vpc', mockContext, mockLocation);
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(result.metadata.validationTime).toBeDefined();
    });

    it('should handle large number of fields efficiently', async () => {
      const largeRecord: any = {
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.0.0/16',
        region: 'us-west-2'
      };

      // Add many additional fields
      for (let i = 0; i < 100; i++) {
        largeRecord[`field${i}`] = `value${i}`;
      }

      const startTime = Date.now();
      const result = await validator.validate(largeRecord, 'vpc', mockContext, mockLocation);
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
    });
  });

  describe('Available Schemas', () => {
    it('should return list of available schemas', () => {
      const schemas = validator.getAvailableSchemas();

      expect(schemas).toContain('vpc');
      expect(schemas).toContain('subnet');
      expect(schemas).toContain('transitGateway');
      expect(schemas.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Location Information', () => {
    it('should include location information in validation errors', async () => {
      const invalidVpc = {
        awsVpcId: 'invalid-id'
      };

      const location: ValidationLocation = {
        row: 5,
        column: 2,
        fieldPath: 'awsVpcId',
        sheet: 'VPCs'
      };

      const result = await validator.validate(invalidVpc, 'vpc', mockContext, location);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].location).toEqual(expect.objectContaining({
        row: 5,
        column: 2,
        sheet: 'VPCs'
      }));
    });
  });
});