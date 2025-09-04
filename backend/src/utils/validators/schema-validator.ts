/**
 * Schema Validator
 * 
 * Provides schema-based validation for network resources with detailed error reporting
 */

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationContext,
  SchemaValidationRule,
  FieldValidationRule,
  NetworkResourceSchema,
  ValidationLocation,
  ValidationMetadata
} from './types';

export class SchemaValidator {
  private schemas: Map<string, SchemaValidationRule> = new Map();

  constructor() {
    this.initializeNetworkSchemas();
  }

  /**
   * Initialize predefined schemas for network resources
   */
  private initializeNetworkSchemas(): void {
    // VPC Schema
    const vpcSchema: SchemaValidationRule = {
      resourceType: 'vpc',
      version: '1.0',
      requiredFields: ['awsVpcId', 'awsAccountId', 'cidrBlock', 'region'],
      fields: {
        awsVpcId: {
          field: 'awsVpcId',
          required: true,
          type: 'string',
          pattern: /^vpc-[a-f0-9]{17}$/,
          format: 'aws-vpc-id'
        },
        awsAccountId: {
          field: 'awsAccountId',
          required: true,
          type: 'string',
          pattern: /^[0-9]{12}$/,
          format: 'aws-account-id'
        },
        cidrBlock: {
          field: 'cidrBlock',
          required: true,
          type: 'string',
          pattern: /^([0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2}$/,
          format: 'cidr-block'
        },
        region: {
          field: 'region',
          required: true,
          type: 'string',
          pattern: /^[a-z]{2}-[a-z]+-[0-9]$/,
          format: 'aws-region'
        },
        name: {
          field: 'name',
          required: false,
          type: 'string',
          maxLength: 255
        },
        description: {
          field: 'description',
          required: false,
          type: 'string',
          maxLength: 1000
        },
        environment: {
          field: 'environment',
          required: false,
          type: 'string',
          enum: ['dev', 'test', 'staging', 'prod', 'sandbox']
        },
        state: {
          field: 'state',
          required: false,
          type: 'string',
          enum: ['pending', 'available', 'deleting']
        },
        isDefault: {
          field: 'isDefault',
          required: false,
          type: 'boolean'
        },
        enableDnsHostnames: {
          field: 'enableDnsHostnames',
          required: false,
          type: 'boolean'
        },
        enableDnsSupport: {
          field: 'enableDnsSupport',
          required: false,
          type: 'boolean'
        },
        instanceTenancy: {
          field: 'instanceTenancy',
          required: false,
          type: 'string',
          enum: ['default', 'dedicated', 'host']
        },
        tags: {
          field: 'tags',
          required: false,
          type: 'object'
        }
      }
    };

    // Subnet Schema
    const subnetSchema: SchemaValidationRule = {
      resourceType: 'subnet',
      version: '1.0',
      requiredFields: ['awsSubnetId', 'awsVpcId', 'awsAccountId', 'cidrBlock', 'availabilityZone'],
      fields: {
        awsSubnetId: {
          field: 'awsSubnetId',
          required: true,
          type: 'string',
          pattern: /^subnet-[a-f0-9]{17}$/,
          format: 'aws-subnet-id'
        },
        awsVpcId: {
          field: 'awsVpcId',
          required: true,
          type: 'string',
          pattern: /^vpc-[a-f0-9]{17}$/,
          format: 'aws-vpc-id',
          dependencies: ['vpcId']
        },
        awsAccountId: {
          field: 'awsAccountId',
          required: true,
          type: 'string',
          pattern: /^[0-9]{12}$/,
          format: 'aws-account-id'
        },
        cidrBlock: {
          field: 'cidrBlock',
          required: true,
          type: 'string',
          pattern: /^([0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2}$/,
          format: 'cidr-block'
        },
        availabilityZone: {
          field: 'availabilityZone',
          required: true,
          type: 'string',
          pattern: /^[a-z]{2}-[a-z]+-[0-9][a-z]$/,
          format: 'aws-availability-zone'
        },
        name: {
          field: 'name',
          required: false,
          type: 'string',
          maxLength: 255
        },
        description: {
          field: 'description',
          required: false,
          type: 'string',
          maxLength: 1000
        },
        state: {
          field: 'state',
          required: false,
          type: 'string',
          enum: ['pending', 'available', 'deleting']
        },
        subnetType: {
          field: 'subnetType',
          required: false,
          type: 'string',
          enum: ['public', 'private', 'isolated']
        },
        mapPublicIpOnLaunch: {
          field: 'mapPublicIpOnLaunch',
          required: false,
          type: 'boolean'
        },
        isDefault: {
          field: 'isDefault',
          required: false,
          type: 'boolean'
        },
        tags: {
          field: 'tags',
          required: false,
          type: 'object'
        }
      }
    };

    // Transit Gateway Schema
    const transitGatewaySchema: SchemaValidationRule = {
      resourceType: 'transitGateway',
      version: '1.0',
      requiredFields: ['awsTransitGatewayId', 'awsAccountId'],
      fields: {
        awsTransitGatewayId: {
          field: 'awsTransitGatewayId',
          required: true,
          type: 'string',
          pattern: /^tgw-[a-f0-9]{17}$/,
          format: 'aws-transit-gateway-id'
        },
        awsAccountId: {
          field: 'awsAccountId',
          required: true,
          type: 'string',
          pattern: /^[0-9]{12}$/,
          format: 'aws-account-id'
        },
        name: {
          field: 'name',
          required: false,
          type: 'string',
          maxLength: 255
        },
        description: {
          field: 'description',
          required: false,
          type: 'string',
          maxLength: 255
        },
        state: {
          field: 'state',
          required: false,
          type: 'string',
          enum: ['pending', 'available', 'modifying', 'deleting', 'deleted']
        },
        amazonSideAsn: {
          field: 'amazonSideAsn',
          required: false,
          type: 'number',
          min: 64512,
          max: 65534
        },
        autoAcceptSharedAttachments: {
          field: 'autoAcceptSharedAttachments',
          required: false,
          type: 'string',
          enum: ['enable', 'disable']
        },
        defaultRouteTableAssociation: {
          field: 'defaultRouteTableAssociation',
          required: false,
          type: 'string',
          enum: ['enable', 'disable']
        },
        defaultRouteTablePropagation: {
          field: 'defaultRouteTablePropagation',
          required: false,
          type: 'string',
          enum: ['enable', 'disable']
        },
        tags: {
          field: 'tags',
          required: false,
          type: 'object'
        }
      }
    };

    // Register schemas
    this.schemas.set('vpc', vpcSchema);
    this.schemas.set('subnet', subnetSchema);
    this.schemas.set('transitGateway', transitGatewaySchema);
  }

  /**
   * Register a custom schema
   */
  public registerSchema(schema: SchemaValidationRule): void {
    this.schemas.set(schema.resourceType, schema);
  }

  /**
   * Get schema by resource type
   */
  public getSchema(resourceType: string): SchemaValidationRule | undefined {
    return this.schemas.get(resourceType);
  }

  /**
   * Validate data against a schema
   */
  public async validate(
    data: any,
    resourceType: string,
    context?: ValidationContext,
    location?: ValidationLocation
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const schema = this.schemas.get(resourceType);

    if (!schema) {
      return this.createErrorResult(
        `Schema not found for resource type: ${resourceType}`,
        'SCHEMA_NOT_FOUND',
        location,
        startTime
      );
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate required fields
      await this.validateRequiredFields(data, schema, errors, location);

      // Validate field types and formats
      await this.validateFields(data, schema, errors, warnings, context, location);

      // Validate business rules if present
      if (schema.businessRules) {
        await this.validateBusinessRules(data, schema, errors, warnings, context, location);
      }

      const metadata = this.createMetadata(1, errors.length === 0 ? 1 : 0, errors.length, warnings.length, startTime);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata
      };

    } catch (error) {
      return this.createErrorResult(
        `Validation error: ${error.message}`,
        'VALIDATION_EXCEPTION',
        location,
        startTime,
        error
      );
    }
  }

  /**
   * Validate required fields
   */
  private async validateRequiredFields(
    data: any,
    schema: SchemaValidationRule,
    errors: ValidationError[],
    location?: ValidationLocation
  ): Promise<void> {
    for (const fieldName of schema.requiredFields) {
      if (data[fieldName] === undefined || data[fieldName] === null || data[fieldName] === '') {
        errors.push({
          field: fieldName,
          value: data[fieldName],
          message: `Required field '${fieldName}' is missing or empty`,
          code: 'REQUIRED_FIELD_MISSING',
          severity: 'error',
          location: location ? { ...location, fieldPath: fieldName } : { fieldPath: fieldName }
        });
      }
    }
  }

  /**
   * Validate individual fields
   */
  private async validateFields(
    data: any,
    schema: SchemaValidationRule,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    context?: ValidationContext,
    location?: ValidationLocation
  ): Promise<void> {
    for (const [fieldName, fieldRule] of Object.entries(schema.fields)) {
      const value = data[fieldName];
      const fieldLocation = location ? { ...location, fieldPath: fieldName } : { fieldPath: fieldName };

      // Skip validation if field is not present and not required
      if (!fieldRule.required && (value === undefined || value === null)) {
        continue;
      }

      // Type validation
      if (fieldRule.type && value !== undefined && value !== null) {
        if (!this.validateFieldType(value, fieldRule.type)) {
          errors.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' must be of type ${fieldRule.type}, got ${typeof value}`,
            code: 'INVALID_TYPE',
            severity: 'error',
            location: fieldLocation
          });
          continue;
        }
      }

      // Pattern validation
      if (fieldRule.pattern && typeof value === 'string') {
        if (!fieldRule.pattern.test(value)) {
          errors.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' does not match required format${fieldRule.format ? ` (${fieldRule.format})` : ''}`,
            code: 'INVALID_FORMAT',
            severity: 'error',
            location: fieldLocation
          });
        }
      }

      // Length validation
      if (typeof value === 'string') {
        if (fieldRule.minLength && value.length < fieldRule.minLength) {
          errors.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' must be at least ${fieldRule.minLength} characters long`,
            code: 'MIN_LENGTH_VIOLATION',
            severity: 'error',
            location: fieldLocation
          });
        }
        if (fieldRule.maxLength && value.length > fieldRule.maxLength) {
          errors.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' must not exceed ${fieldRule.maxLength} characters`,
            code: 'MAX_LENGTH_VIOLATION',
            severity: 'error',
            location: fieldLocation
          });
        }
      }

      // Numeric range validation
      if (typeof value === 'number') {
        if (fieldRule.min !== undefined && value < fieldRule.min) {
          errors.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' must be at least ${fieldRule.min}`,
            code: 'MIN_VALUE_VIOLATION',
            severity: 'error',
            location: fieldLocation
          });
        }
        if (fieldRule.max !== undefined && value > fieldRule.max) {
          errors.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' must not exceed ${fieldRule.max}`,
            code: 'MAX_VALUE_VIOLATION',
            severity: 'error',
            location: fieldLocation
          });
        }
      }

      // Enum validation
      if (fieldRule.enum && value !== undefined) {
        if (!fieldRule.enum.includes(value)) {
          errors.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' must be one of: ${fieldRule.enum.join(', ')}`,
            code: 'INVALID_ENUM_VALUE',
            severity: 'error',
            location: fieldLocation
          });
        }
      }

      // Custom validator
      if (fieldRule.customValidator && context) {
        try {
          const customResult = await fieldRule.customValidator(value, context);
          errors.push(...customResult.errors);
          warnings.push(...customResult.warnings);
        } catch (error) {
          errors.push({
            field: fieldName,
            value,
            message: `Custom validation failed: ${error.message}`,
            code: 'CUSTOM_VALIDATION_ERROR',
            severity: 'error',
            location: fieldLocation
          });
        }
      }
    }
  }

  /**
   * Validate business rules
   */
  private async validateBusinessRules(
    data: any,
    schema: SchemaValidationRule,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    context?: ValidationContext,
    location?: ValidationLocation
  ): Promise<void> {
    if (!schema.businessRules || !context) return;

    for (const rule of schema.businessRules) {
      try {
        const result = await rule.validate(data, context);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      } catch (error) {
        errors.push({
          field: 'businessRules',
          value: data,
          message: `Business rule '${rule.name}' validation failed: ${error.message}`,
          code: 'BUSINESS_RULE_ERROR',
          severity: 'error',
          location
        });
      }
    }
  }

  /**
   * Validate field type
   */
  private validateFieldType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      default:
        return true;
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(
    message: string,
    code: string,
    location?: ValidationLocation,
    startTime?: number,
    originalError?: any
  ): ValidationResult {
    return {
      isValid: false,
      errors: [{
        field: 'schema',
        value: null,
        message,
        code,
        severity: 'error',
        location,
        context: originalError
      }],
      warnings: [],
      metadata: this.createMetadata(1, 0, 1, 0, startTime || Date.now())
    };
  }

  /**
   * Create validation metadata
   */
  private createMetadata(
    totalRecords: number,
    validRecords: number,
    errorCount: number,
    warningCount: number,
    startTime: number
  ): ValidationMetadata {
    return {
      totalRecords,
      validRecords,
      errorCount,
      warningCount,
      validationTime: Date.now() - startTime,
      validatedAt: new Date()
    };
  }

  /**
   * Get all available schemas
   */
  public getAvailableSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Validate schema definition
   */
  public validateSchema(schema: SchemaValidationRule): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required properties
    if (!schema.resourceType) {
      errors.push({
        field: 'resourceType',
        value: schema.resourceType,
        message: 'Schema must have a resourceType',
        code: 'MISSING_RESOURCE_TYPE',
        severity: 'error'
      });
    }

    if (!schema.fields || Object.keys(schema.fields).length === 0) {
      errors.push({
        field: 'fields',
        value: schema.fields,
        message: 'Schema must define at least one field',
        code: 'NO_FIELDS_DEFINED',
        severity: 'error'
      });
    }

    // Validate field definitions
    if (schema.fields) {
      for (const [fieldName, fieldRule] of Object.entries(schema.fields)) {
        if (fieldRule.field !== fieldName) {
          warnings.push({
            field: fieldName,
            value: fieldRule.field,
            message: `Field name '${fieldName}' does not match rule field property '${fieldRule.field}'`,
            code: 'FIELD_NAME_MISMATCH',
            suggestion: `Set field property to '${fieldName}'`
          });
        }
      }
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
}