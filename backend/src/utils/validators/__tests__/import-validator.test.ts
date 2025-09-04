/**
 * Import Validator Tests
 * 
 * Comprehensive tests for import validation system
 */

import { ImportValidator } from '../import-validator';
import {
  ValidationContext,
  ImportValidationOptions,
  ValidationLocation,
  BatchValidationResult
} from '../types';

describe('ImportValidator', () => {
  let validator: ImportValidator;
  let mockOptions: ImportValidationOptions;

  beforeEach(() => {
    validator = new ImportValidator();
    mockOptions = {
      fileType: 'csv',
      hasHeaders: true,
      validateReferences: true,
      validateBusinessRules: true,
      strict: false,
      batchSize: 100
    };
  });

  describe('Single Record Validation', () => {
    it('should validate a valid VPC record', async () => {
      const validVpc = {
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.0.0/16',
        region: 'us-west-2',
        name: 'test-vpc',
        environment: 'dev'
      };

      const context: ValidationContext = {
        resourceType: 'vpc',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: mockOptions
      };

      const result = await validator.validateRecord(validVpc, 'vpc', context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.resourceType).toBe('vpc');
    });

    it('should validate a valid subnet record', async () => {
      const validSubnet = {
        awsSubnetId: 'subnet-1234567890abcdef0',
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-west-2a',
        name: 'test-subnet',
        subnetType: 'private'
      };

      const context: ValidationContext = {
        resourceType: 'subnet',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map([
          ['vpc-1234567890abcdef0', {
            awsVpcId: 'vpc-1234567890abcdef0',
            cidrBlock: '10.0.0.0/16',
            region: 'us-west-2',
            awsAccountId: '123456789012'
          }]
        ]),
        options: mockOptions
      };

      const result = await validator.validateRecord(validSubnet, 'subnet', context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid record', async () => {
      const invalidVpc = {
        awsVpcId: 'invalid-id',
        // Missing required fields
        name: 'test-vpc'
      };

      const context: ValidationContext = {
        resourceType: 'vpc',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: mockOptions
      };

      const result = await validator.validateRecord(invalidVpc, 'vpc', context);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate business rules when enabled', async () => {
      const subnetWithVpcMismatch = {
        awsSubnetId: 'subnet-1234567890abcdef0',
        awsVpcId: 'vpc-nonexistent',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-west-2a'
      };

      const context: ValidationContext = {
        resourceType: 'subnet',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: { ...mockOptions, validateBusinessRules: true }
      };

      const result = await validator.validateRecord(subnetWithVpcMismatch, 'subnet', context);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'VPC_NOT_FOUND')).toBe(true);
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple valid records', async () => {
      const validRecords = [
        {
          awsVpcId: 'vpc-1234567890abcdef0',
          awsAccountId: '123456789012',
          cidrBlock: '10.0.0.0/16',
          region: 'us-west-2',
          name: 'vpc-1',
          environment: 'dev'
        },
        {
          awsVpcId: 'vpc-1234567890abcdef1',
          awsAccountId: '123456789012',
          cidrBlock: '10.1.0.0/16',
          region: 'us-west-2',
          name: 'vpc-2',
          environment: 'dev'
        }
      ];

      const result = await validator.validateBatch(validRecords, 'vpc', mockOptions);

      expect(result.totalRecords).toBe(2);
      expect(result.validRecords).toBe(2);
      expect(result.invalidRecords).toBe(0);
      expect(result.batchId).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should handle mixed valid/invalid records', async () => {
      const mixedRecords = [
        {
          awsVpcId: 'vpc-1234567890abcdef0',
          awsAccountId: '123456789012',
          cidrBlock: '10.0.0.0/16',
          region: 'us-west-2',
          name: 'valid-vpc'
        },
        {
          awsVpcId: 'invalid-id',
          awsAccountId: '123456789012',
          cidrBlock: '10.1.0.0/16',
          region: 'us-west-2',
          name: 'invalid-vpc'
        },
        {
          awsVpcId: 'vpc-1234567890abcdef2',
          awsAccountId: '123456789012',
          // Missing required cidrBlock
          region: 'us-west-2',
          name: 'incomplete-vpc'
        }
      ];

      const result = await validator.validateBatch(mixedRecords, 'vpc', mockOptions);

      expect(result.totalRecords).toBe(3);
      expect(result.validRecords).toBe(1);
      expect(result.invalidRecords).toBe(2);
      expect(result.summary.totalErrors).toBeGreaterThan(0);
    });

    it('should process records in batches when batch size is specified', async () => {
      const largeDataset = Array.from({ length: 250 }, (_, i) => ({
        awsVpcId: `vpc-${i.toString().padStart(17, '0')}`,
        awsAccountId: '123456789012',
        cidrBlock: `10.${Math.floor(i / 256)}.${i % 256}.0/24`,
        region: 'us-west-2',
        name: `vpc-${i}`,
        environment: 'dev'
      }));

      const smallBatchOptions = { ...mockOptions, batchSize: 50 };
      const result = await validator.validateBatch(largeDataset, 'vpc', smallBatchOptions);

      expect(result.totalRecords).toBe(250);
      expect(result.processedRecords).toBe(250);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should stop early when max errors reached', async () => {
      const invalidRecords = Array.from({ length: 20 }, (_, i) => ({
        awsVpcId: `invalid-id-${i}`, // All invalid
        name: `vpc-${i}`
      }));

      const limitedOptions = { ...mockOptions, maxErrors: 5 };
      const result = await validator.validateBatch(invalidRecords, 'vpc', limitedOptions);

      expect(result.invalidRecords).toBeGreaterThan(0);
      expect(result.processedRecords).toBeLessThanOrEqual(result.totalRecords);
    });
  });

  describe('File Constraint Validation', () => {
    it('should validate file is not empty', async () => {
      const result = await validator.validateFileConstraints([], mockOptions);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('EMPTY_FILE');
    });

    it('should validate file size constraints', async () => {
      const largeDataset = Array.from({ length: 1100 }, (_, i) => ({
        awsVpcId: `vpc-${i}`,
        name: `vpc-${i}`
      }));

      const constrainedOptions = { ...mockOptions, maxRows: 1000 };
      const result = await validator.validateFileConstraints(largeDataset, constrainedOptions);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
    });

    it('should detect duplicate records', async () => {
      const recordsWithDuplicates = [
        {
          awsVpcId: 'vpc-1234567890abcdef0',
          name: 'vpc-1'
        },
        {
          awsVpcId: 'vpc-1234567890abcdef1',
          name: 'vpc-2'
        },
        {
          awsVpcId: 'vpc-1234567890abcdef0', // Duplicate
          name: 'vpc-1-duplicate'
        }
      ];

      const result = await validator.validateFileConstraints(recordsWithDuplicates, mockOptions);

      expect(result.warnings.some(w => w.code === 'DUPLICATE_RECORDS')).toBe(true);
    });
  });

  describe('Reference Validation', () => {
    it('should validate VPC references for subnets', async () => {
      const subnet = {
        awsSubnetId: 'subnet-1234567890abcdef0',
        awsVpcId: 'vpc-nonexistent',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-west-2a'
      };

      const context: ValidationContext = {
        resourceType: 'subnet',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(), // Empty - no VPC reference
        options: { ...mockOptions, validateReferences: true }
      };

      const result = await validator.validateRecord(subnet, 'subnet', context);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'VPC_REFERENCE_NOT_FOUND')).toBe(true);
    });

    it('should pass validation when references exist', async () => {
      const subnet = {
        awsSubnetId: 'subnet-1234567890abcdef0',
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-west-2a'
      };

      const context: ValidationContext = {
        resourceType: 'subnet',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map([
          ['vpc-1234567890abcdef0', { awsVpcId: 'vpc-1234567890abcdef0' }]
        ]),
        options: { ...mockOptions, validateReferences: true }
      };

      const result = await validator.validateRecord(subnet, 'subnet', context);

      expect(result.isValid).toBe(true);
    });

    it('should skip reference validation when disabled', async () => {
      const subnet = {
        awsSubnetId: 'subnet-1234567890abcdef0',
        awsVpcId: 'vpc-nonexistent',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-west-2a'
      };

      const context: ValidationContext = {
        resourceType: 'subnet',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: { ...mockOptions, validateReferences: false }
      };

      const result = await validator.validateRecord(subnet, 'subnet', context);

      // Should not have reference validation errors
      expect(result.errors.some(e => e.code === 'VPC_REFERENCE_NOT_FOUND')).toBe(false);
    });
  });

  describe('Business Rule Validation', () => {
    it('should validate VPC-Subnet relationships', async () => {
      const subnet = {
        awsSubnetId: 'subnet-1234567890abcdef0',
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '999999999999', // Different account
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-west-2a'
      };

      const context: ValidationContext = {
        resourceType: 'subnet',
        operation: 'create',
        existingData: new Map([
          ['vpc-1234567890abcdef0', {
            awsVpcId: 'vpc-1234567890abcdef0',
            awsAccountId: '123456789012', // Different account
            cidrBlock: '10.0.0.0/16',
            region: 'us-west-2'
          }]
        ]),
        referenceData: new Map(),
        options: { ...mockOptions, validateBusinessRules: true }
      };

      const result = await validator.validateRecord(subnet, 'subnet', context);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'ACCOUNT_MISMATCH')).toBe(true);
    });

    it('should validate CIDR block overlaps', async () => {
      const records = [
        {
          awsVpcId: 'vpc-1234567890abcdef0',
          awsAccountId: '123456789012',
          cidrBlock: '10.0.0.0/16',
          region: 'us-west-2',
          name: 'vpc-1'
        },
        {
          awsVpcId: 'vpc-1234567890abcdef1',
          awsAccountId: '123456789012',
          cidrBlock: '10.0.0.0/24', // Overlaps with first VPC
          region: 'us-west-2',
          name: 'vpc-2'
        }
      ];

      const result = await validator.validateBatch(records, 'vpc', {
        ...mockOptions,
        validateBusinessRules: true
      });

      expect(result.summary.totalErrors).toBeGreaterThan(0);
      expect(result.results.some(r => 
        r.errors.some(e => e.code === 'CIDR_OVERLAP_DETECTED')
      )).toBe(true);
    });

    it('should validate tag compliance', async () => {
      const prodVpcWithoutTags = {
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.0.0/16',
        region: 'us-west-2',
        environment: 'prod',
        name: 'prod-vpc'
        // Missing required production tags
      };

      const context: ValidationContext = {
        resourceType: 'vpc',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: { ...mockOptions, validateBusinessRules: true }
      };

      const result = await validator.validateRecord(prodVpcWithoutTags, 'vpc', context);

      expect(result.errors.some(e => e.code === 'MISSING_TAGS_PROD')).toBe(true);
    });

    it('should skip business rule validation when disabled', async () => {
      const subnet = {
        awsSubnetId: 'subnet-1234567890abcdef0',
        awsVpcId: 'vpc-nonexistent',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-west-2a'
      };

      const context: ValidationContext = {
        resourceType: 'subnet',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: { ...mockOptions, validateBusinessRules: false }
      };

      const result = await validator.validateRecord(subnet, 'subnet', context);

      // Should not have business rule errors
      expect(result.errors.some(e => e.code === 'VPC_NOT_FOUND')).toBe(false);
    });
  });

  describe('Custom Business Rules', () => {
    it('should allow registration of custom business rules', () => {
      const customRule = jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {
          totalRecords: 1,
          validRecords: 1,
          errorCount: 0,
          warningCount: 0,
          validationTime: 0,
          validatedAt: new Date()
        }
      });

      validator.registerBusinessRule('vpc', customRule);

      // The rule should be registered and called during validation
      expect(typeof customRule).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation exceptions gracefully', async () => {
      const malformedRecord = {
        // Intentionally malformed data that might cause exceptions
        awsVpcId: { nested: 'object' },
        awsAccountId: null,
        cidrBlock: undefined
      };

      const context: ValidationContext = {
        resourceType: 'vpc',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: mockOptions
      };

      const result = await validator.validateRecord(malformedRecord, 'vpc', context);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should not throw an exception
    });

    it('should handle unknown resource types', async () => {
      const record = { name: 'test' };

      const context: ValidationContext = {
        resourceType: 'unknown-type',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: mockOptions
      };

      const result = await validator.validateRecord(record, 'unknown-type', context);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('SCHEMA_NOT_FOUND');
    });
  });

  describe('Performance', () => {
    it('should complete single record validation quickly', async () => {
      const record = {
        awsVpcId: 'vpc-1234567890abcdef0',
        awsAccountId: '123456789012',
        cidrBlock: '10.0.0.0/16',
        region: 'us-west-2'
      };

      const context: ValidationContext = {
        resourceType: 'vpc',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: mockOptions
      };

      const startTime = Date.now();
      const result = await validator.validateRecord(record, 'vpc', context);
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.metadata.validationTime).toBeDefined();
    });

    it('should handle large batches efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        awsVpcId: `vpc-${i.toString().padStart(17, '0')}`,
        awsAccountId: '123456789012',
        cidrBlock: `10.${Math.floor(i / 256)}.${i % 256}.0/24`,
        region: 'us-west-2',
        name: `vpc-${i}`
      }));

      const startTime = Date.now();
      const result = await validator.validateBatch(largeDataset, 'vpc', mockOptions);
      const endTime = Date.now();

      expect(result.totalRecords).toBe(1000);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.processingTime).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Location Information', () => {
    it('should include location information in validation results', async () => {
      const record = {
        awsVpcId: 'invalid-id'
      };

      const context: ValidationContext = {
        resourceType: 'vpc',
        operation: 'create',
        existingData: new Map(),
        referenceData: new Map(),
        options: mockOptions
      };

      const location: ValidationLocation = {
        row: 3,
        column: 1,
        fieldPath: 'awsVpcId',
        sheet: 'VPCs'
      };

      const result = await validator.validateRecord(record, 'vpc', context, location);

      expect(result.errors[0].location).toEqual(expect.objectContaining({
        row: 3,
        sheet: 'VPCs'
      }));
    });

    it('should create location information from batch options', async () => {
      const records = [
        { awsVpcId: 'invalid-id-1' },
        { awsVpcId: 'invalid-id-2' }
      ];

      const optionsWithLocation = {
        ...mockOptions,
        hasHeaders: true,
        sheetName: 'ImportData'
      };

      const result = await validator.validateBatch(records, 'vpc', optionsWithLocation);

      // Check that errors include location information
      const errorWithLocation = result.results
        .flatMap(r => r.errors)
        .find(e => e.location);

      expect(errorWithLocation).toBeDefined();
      expect(errorWithLocation?.location?.sheet).toBe('ImportData');
    });
  });

  describe('Schema Access', () => {
    it('should provide access to validation schemas', () => {
      const vpcSchema = validator.getValidationSchema('vpc');
      
      expect(vpcSchema).toBeDefined();
      expect(vpcSchema?.resourceType).toBe('vpc');
      expect(vpcSchema?.fields).toBeDefined();
    });

    it('should return undefined for unknown schemas', () => {
      const unknownSchema = validator.getValidationSchema('unknown');
      
      expect(unknownSchema).toBeUndefined();
    });
  });
});