/**
 * Import Validator
 * 
 * Comprehensive validation system for import data with batch processing capabilities
 */

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationContext,
  ImportValidationOptions,
  BatchValidationResult,
  ValidationLocation,
  BusinessRuleContext,
  BatchValidationContext
} from './types';

import { SchemaValidator } from './schema-validator';
import { FieldValidator } from './field-validator';
import { 
  validateVpcSubnetRelationship,
  validateCidrBlockOverlap,
  validateResourceOwnership,
  validateEnvironmentConsistency,
  validateTagCompliance
} from './business-validators';

import {
  aggregateValidationResults,
  createValidationContext,
  createValidationLocation,
  mergeValidationResults
} from './validation-utils';

export class ImportValidator {
  private schemaValidator: SchemaValidator;
  private fieldValidator: FieldValidator;
  private businessRules: Map<string, Function[]> = new Map();

  constructor() {
    this.schemaValidator = new SchemaValidator();
    this.fieldValidator = FieldValidator.getInstance();
    this.initializeBusinessRules();
  }

  /**
   * Initialize business rule mappings for different resource types
   */
  private initializeBusinessRules(): void {
    // VPC business rules
    this.businessRules.set('vpc', [
      validateCidrBlockOverlap,
      validateResourceOwnership,
      validateEnvironmentConsistency,
      validateTagCompliance
    ]);

    // Subnet business rules  
    this.businessRules.set('subnet', [
      validateVpcSubnetRelationship,
      validateCidrBlockOverlap,
      validateResourceOwnership,
      validateEnvironmentConsistency,
      validateTagCompliance
    ]);

    // Transit Gateway business rules
    this.businessRules.set('transitGateway', [
      validateResourceOwnership,
      validateEnvironmentConsistency,
      validateTagCompliance
    ]);

    // Customer Gateway business rules
    this.businessRules.set('customerGateway', [
      validateResourceOwnership,
      validateEnvironmentConsistency,
      validateTagCompliance
    ]);
  }

  /**
   * Validate a single record for import
   */
  public async validateRecord(
    record: any,
    resourceType: string,
    context: ValidationContext,
    location?: ValidationLocation
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const results: ValidationResult[] = [];

    try {
      // 1. Schema validation
      const schemaResult = await this.schemaValidator.validate(record, resourceType, context, location);
      results.push(schemaResult);

      // Short-circuit if schema validation fails with critical errors
      if (schemaResult.errors.some(e => this.isCriticalError(e.code))) {
        return mergeValidationResults(...results);
      }

      // 2. Business rule validation
      if (context.options?.validateBusinessRules !== false) {
        const businessResult = await this.validateBusinessRules(record, resourceType, context, location);
        results.push(businessResult);
      }

      // 3. Cross-reference validation
      if (context.options?.validateReferences !== false) {
        const referenceResult = await this.validateReferences(record, resourceType, context, location);
        results.push(referenceResult);
      }

      const finalResult = mergeValidationResults(...results);
      finalResult.metadata.resourceType = resourceType;
      finalResult.metadata.validationTime = Date.now() - startTime;

      return finalResult;

    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'record',
          value: record,
          message: `Record validation failed: ${error.message}`,
          code: 'VALIDATION_EXCEPTION',
          severity: 'error',
          location,
          context: error
        }],
        warnings: [],
        metadata: {
          totalRecords: 1,
          validRecords: 0,
          errorCount: 1,
          warningCount: 0,
          validationTime: Date.now() - startTime,
          validatedAt: new Date(),
          resourceType
        }
      };
    }
  }

  /**
   * Validate multiple records in batch
   */
  public async validateBatch(
    records: any[],
    resourceType: string,
    options: ImportValidationOptions
  ): Promise<BatchValidationResult> {
    const startTime = Date.now();
    const batchId = options.batchSize ? 
      `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` :
      `import-${Date.now()}`;

    // Create batch context
    const batchContext: BatchValidationContext = {
      batchId,
      currentIndex: 0,
      totalRecords: records.length,
      processedIds: new Set(),
      validatedIds: new Set()
    };

    // Prepare reference data for cross-validation
    const referenceData = await this.prepareReferenceData(records, resourceType, options);
    const existingData = await this.loadExistingData(resourceType, options);

    const results: ValidationResult[] = [];
    const batchSize = options.batchSize || records.length;

    // Process records in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchResults = await this.processBatch(
        batch,
        resourceType,
        i,
        referenceData,
        existingData,
        options,
        batchContext
      );
      results.push(...batchResults);

      // Check for early termination conditions
      if (options.maxErrors && results.filter(r => !r.isValid).length >= options.maxErrors) {
        break;
      }
    }

    const processingTime = Date.now() - startTime;
    return aggregateValidationResults(results, batchId, processingTime);
  }

  /**
   * Process a single batch of records
   */
  private async processBatch(
    batch: any[],
    resourceType: string,
    startIndex: number,
    referenceData: Map<string, any>,
    existingData: Map<string, any>,
    options: ImportValidationOptions,
    batchContext: BatchValidationContext
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];
      const recordIndex = startIndex + i;
      batchContext.currentIndex = recordIndex;

      // Create location information
      const location = this.createLocationFromOptions(recordIndex, record, options);

      // Create validation context
      const context = this.createImportContext(
        resourceType,
        batch, // All records in current batch
        referenceData,
        existingData,
        options,
        batchContext
      );

      try {
        const result = await this.validateRecord(record, resourceType, context, location);
        results.push(result);

        // Track processed records
        const recordId = this.getRecordIdentifier(record, resourceType);
        if (recordId) {
          batchContext.processedIds.add(recordId);
          if (result.isValid) {
            batchContext.validatedIds.add(recordId);
          }
        }

      } catch (error) {
        results.push({
          isValid: false,
          errors: [{
            field: 'batch',
            value: record,
            message: `Batch processing error at record ${recordIndex}: ${error.message}`,
            code: 'BATCH_PROCESSING_ERROR',
            severity: 'error',
            location
          }],
          warnings: [],
          metadata: {
            totalRecords: 1,
            validRecords: 0,
            errorCount: 1,
            warningCount: 0,
            validationTime: 0,
            validatedAt: new Date(),
            resourceType,
            batchId: batchContext.batchId
          }
        });
      }
    }

    return results;
  }

  /**
   * Validate business rules for a record
   */
  private async validateBusinessRules(
    record: any,
    resourceType: string,
    context: ValidationContext,
    location?: ValidationLocation
  ): Promise<ValidationResult> {
    const rules = this.businessRules.get(resourceType) || [];
    const results: ValidationResult[] = [];

    // Create business rule context
    const businessContext: BusinessRuleContext = {
      ...context,
      allRecords: context.batchContext ? [] : undefined, // Will be populated in batch validation
      existingResources: context.existingData,
      accountLimits: {
        maxVpcsPerRegion: 5,
        maxSubnetsPerVpc: 200,
        maxTransitGateways: 5
      }
    };

    for (const rule of rules) {
      try {
        const result = await rule(record, businessContext, location);
        results.push(result);
      } catch (error) {
        results.push({
          isValid: false,
          errors: [{
            field: 'businessRule',
            value: record,
            message: `Business rule validation failed: ${error.message}`,
            code: 'BUSINESS_RULE_ERROR',
            severity: 'error',
            location
          }],
          warnings: [],
          metadata: {
            totalRecords: 1,
            validRecords: 0,
            errorCount: 1,
            warningCount: 0,
            validationTime: 0,
            validatedAt: new Date()
          }
        });
      }
    }

    return mergeValidationResults(...results);
  }

  /**
   * Validate cross-references between records
   */
  private async validateReferences(
    record: any,
    resourceType: string,
    context: ValidationContext,
    location?: ValidationLocation
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate VPC references for subnets
      if (resourceType === 'subnet' && record.awsVpcId) {
        const vpcExists = context.referenceData?.has(record.awsVpcId) || 
                         context.existingData?.has(record.awsVpcId);
        
        if (!vpcExists) {
          errors.push({
            field: 'awsVpcId',
            value: record.awsVpcId,
            message: `Referenced VPC ${record.awsVpcId} not found in import data or existing resources`,
            code: 'VPC_REFERENCE_NOT_FOUND',
            severity: 'error',
            location
          });
        }
      }

      // Validate Transit Gateway references for attachments
      if (resourceType === 'transitGatewayAttachment' && record.transitGatewayId) {
        const tgwExists = context.referenceData?.has(record.transitGatewayId) ||
                         context.existingData?.has(record.transitGatewayId);

        if (!tgwExists) {
          errors.push({
            field: 'transitGatewayId',
            value: record.transitGatewayId,
            message: `Referenced Transit Gateway ${record.transitGatewayId} not found`,
            code: 'TGW_REFERENCE_NOT_FOUND',
            severity: 'error',
            location
          });
        }
      }

      // Check for circular references
      const circularRef = await this.detectCircularReferences(record, resourceType, context);
      if (circularRef.hasCircularReference) {
        warnings.push({
          field: 'references',
          value: record,
          message: `Potential circular reference detected: ${circularRef.path}`,
          code: 'CIRCULAR_REFERENCE_WARNING',
          suggestion: 'Review resource dependencies to avoid circular references'
        });
      }

    } catch (error) {
      errors.push({
        field: 'references',
        value: record,
        message: `Reference validation failed: ${error.message}`,
        code: 'REFERENCE_VALIDATION_ERROR',
        severity: 'error',
        location
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        totalRecords: 1,
        validRecords: errors.length === 0 ? 1 : 0,
        errorCount: errors.length,
        warningCount: warnings.length,
        validationTime: 0,
        validatedAt: new Date()
      }
    };
  }

  /**
   * Prepare reference data from import records
   */
  private async prepareReferenceData(
    records: any[],
    resourceType: string,
    options: ImportValidationOptions
  ): Promise<Map<string, any>> {
    const referenceData = new Map<string, any>();

    for (const record of records) {
      const id = this.getRecordIdentifier(record, resourceType);
      if (id) {
        referenceData.set(id, record);
      }
    }

    return referenceData;
  }

  /**
   * Load existing data for reference validation
   */
  private async loadExistingData(
    resourceType: string,
    options: ImportValidationOptions
  ): Promise<Map<string, any>> {
    // This would typically query the database for existing resources
    // For now, return empty map as placeholder
    const existingData = new Map<string, any>();
    
    // TODO: Implement actual database queries
    // const existingRecords = await this.databaseService.findByResourceType(resourceType);
    // for (const record of existingRecords) {
    //   const id = this.getRecordIdentifier(record, resourceType);
    //   if (id) {
    //     existingData.set(id, record);
    //   }
    // }

    return existingData;
  }

  /**
   * Create import-specific validation context
   */
  private createImportContext(
    resourceType: string,
    allRecords: any[],
    referenceData: Map<string, any>,
    existingData: Map<string, any>,
    options: ImportValidationOptions,
    batchContext?: BatchValidationContext
  ): ValidationContext {
    return {
      resourceType,
      operation: 'create',
      existingData,
      referenceData,
      options: {
        strict: options.strict || false,
        skipWarnings: options.skipWarnings || false,
        validateReferences: options.validateReferences !== false,
        validateBusinessRules: options.validateBusinessRules !== false,
        maxErrors: options.maxErrors || 100,
        timeout: options.timeout || 30000,
        customRules: options.customRules
      },
      batchContext
    };
  }

  /**
   * Create location information from options and record index
   */
  private createLocationFromOptions(
    index: number,
    record: any,
    options: ImportValidationOptions
  ): ValidationLocation {
    const row = options.hasHeaders !== false ? index + 2 : index + 1; // Account for header row
    
    return createValidationLocation(
      row,
      undefined,
      undefined,
      {
        sheet: options.sheetName,
        fileName: `import.${options.fileType}`
      }
    );
  }

  /**
   * Get unique identifier for a record based on resource type
   */
  private getRecordIdentifier(record: any, resourceType: string): string | null {
    switch (resourceType) {
      case 'vpc':
        return record.awsVpcId;
      case 'subnet':
        return record.awsSubnetId;
      case 'transitGateway':
        return record.awsTransitGatewayId;
      case 'customerGateway':
        return record.awsCustomerGatewayId;
      default:
        return record.id || record.awsResourceId || null;
    }
  }

  /**
   * Check if an error code is critical and should stop validation
   */
  private isCriticalError(code: string): boolean {
    const criticalCodes = new Set([
      'SCHEMA_NOT_FOUND',
      'VALIDATION_EXCEPTION',
      'INVALID_TYPE',
      'REQUIRED_FIELD_MISSING'
    ]);
    
    return criticalCodes.has(code);
  }

  /**
   * Detect circular references in resource dependencies
   */
  private async detectCircularReferences(
    record: any,
    resourceType: string,
    context: ValidationContext
  ): Promise<{ hasCircularReference: boolean; path?: string }> {
    // Simple circular reference detection
    // In a real implementation, this would build a dependency graph
    
    const visited = new Set<string>();
    const recordId = this.getRecordIdentifier(record, resourceType);
    
    if (!recordId) {
      return { hasCircularReference: false };
    }

    // Check immediate dependencies
    const dependencies = this.getRecordDependencies(record, resourceType);
    
    for (const dep of dependencies) {
      if (dep === recordId) {
        return { 
          hasCircularReference: true, 
          path: `${recordId} -> ${dep}` 
        };
      }
    }

    return { hasCircularReference: false };
  }

  /**
   * Get dependencies for a record
   */
  private getRecordDependencies(record: any, resourceType: string): string[] {
    const dependencies: string[] = [];

    switch (resourceType) {
      case 'subnet':
        if (record.awsVpcId) dependencies.push(record.awsVpcId);
        break;
      case 'transitGatewayAttachment':
        if (record.transitGatewayId) dependencies.push(record.transitGatewayId);
        if (record.vpcId) dependencies.push(record.vpcId);
        break;
    }

    return dependencies;
  }

  /**
   * Validate file-specific constraints
   */
  public async validateFileConstraints(
    records: any[],
    options: ImportValidationOptions
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // File size constraints
    if (options.maxRows && records.length > options.maxRows) {
      errors.push({
        field: 'file',
        value: records.length,
        message: `File contains ${records.length} records, exceeding maximum of ${options.maxRows}`,
        code: 'FILE_TOO_LARGE',
        severity: 'error'
      });
    }

    // Empty file check
    if (records.length === 0) {
      errors.push({
        field: 'file',
        value: records.length,
        message: 'File is empty or contains no valid records',
        code: 'EMPTY_FILE',
        severity: 'error'
      });
    }

    // Duplicate record check
    const duplicates = this.findDuplicateRecords(records, options);
    if (duplicates.length > 0) {
      warnings.push({
        field: 'file',
        value: duplicates,
        message: `Found ${duplicates.length} duplicate records`,
        code: 'DUPLICATE_RECORDS',
        suggestion: 'Remove duplicate records before importing'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        totalRecords: 1,
        validRecords: errors.length === 0 ? 1 : 0,
        errorCount: errors.length,
        warningCount: warnings.length,
        validationTime: 0,
        validatedAt: new Date()
      }
    };
  }

  /**
   * Find duplicate records in the import data
   */
  private findDuplicateRecords(
    records: any[],
    options: ImportValidationOptions
  ): Array<{ indices: number[]; key: string }> {
    const seen = new Map<string, number[]>();
    const duplicates: Array<{ indices: number[]; key: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const key = this.generateRecordKey(record, options);
      
      if (seen.has(key)) {
        seen.get(key)!.push(i);
      } else {
        seen.set(key, [i]);
      }
    }

    for (const [key, indices] of seen.entries()) {
      if (indices.length > 1) {
        duplicates.push({ indices, key });
      }
    }

    return duplicates;
  }

  /**
   * Generate a unique key for duplicate detection
   */
  private generateRecordKey(record: any, options: ImportValidationOptions): string {
    // Generate key based on unique identifiers
    const keyFields = [];
    
    if (record.awsVpcId) keyFields.push(record.awsVpcId);
    if (record.awsSubnetId) keyFields.push(record.awsSubnetId);
    if (record.awsTransitGatewayId) keyFields.push(record.awsTransitGatewayId);
    if (record.awsCustomerGatewayId) keyFields.push(record.awsCustomerGatewayId);
    
    // If no AWS IDs, use name and other identifying fields
    if (keyFields.length === 0) {
      if (record.name) keyFields.push(record.name);
      if (record.cidrBlock) keyFields.push(record.cidrBlock);
      if (record.region) keyFields.push(record.region);
    }

    return keyFields.length > 0 ? keyFields.join('|') : JSON.stringify(record);
  }

  /**
   * Get validation schema for a resource type
   */
  public getValidationSchema(resourceType: string) {
    return this.schemaValidator.getSchema(resourceType);
  }

  /**
   * Register custom validation rules
   */
  public registerBusinessRule(resourceType: string, rule: Function): void {
    if (!this.businessRules.has(resourceType)) {
      this.businessRules.set(resourceType, []);
    }
    this.businessRules.get(resourceType)!.push(rule);
  }
}