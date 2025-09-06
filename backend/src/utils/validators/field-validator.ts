/**
 * Field Validator
 * 
 * Provides individual field validation with specific rules and formats
 */

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationContext,
  FieldValidationRule,
  ValidationLocation,
  ValidationMetadata
} from './types';

export class FieldValidator {
  private static instance: FieldValidator;
  private customValidators: Map<string, Function> = new Map();

  constructor() {
    this.initializeBuiltInValidators();
  }

  public static getInstance(): FieldValidator {
    if (!FieldValidator.instance) {
      FieldValidator.instance = new FieldValidator();
    }
    return FieldValidator.instance;
  }

  /**
   * Initialize built-in validators
   */
  private initializeBuiltInValidators(): void {
    // Email validator
    this.registerValidator('email', (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    });

    // URL validator
    this.registerValidator('url', (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    });

    // IPv4 address validator
    this.registerValidator('ipv4', (value: string) => {
      const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      return ipv4Regex.test(value);
    });

    // IPv6 address validator
    this.registerValidator('ipv6', (value: string) => {
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      return ipv6Regex.test(value) || this.isValidIPv6Compressed(value);
    });

    // MAC address validator
    this.registerValidator('mac', (value: string) => {
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      return macRegex.test(value);
    });

    // JSON validator
    this.registerValidator('json', (value: string) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    });

    // UUID validator
    this.registerValidator('uuid', (value: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(value);
    });

    // AWS resource ID validators
    this.registerValidator('aws-vpc-id', (value: string) => {
      return /^vpc-[a-f0-9]{17}$/.test(value);
    });

    this.registerValidator('aws-subnet-id', (value: string) => {
      return /^subnet-[a-f0-9]{17}$/.test(value);
    });

    this.registerValidator('aws-instance-id', (value: string) => {
      return /^i-[a-f0-9]{17}$/.test(value);
    });

    this.registerValidator('aws-security-group-id', (value: string) => {
      return /^sg-[a-f0-9]{17}$/.test(value);
    });

    this.registerValidator('aws-account-id', (value: string) => {
      return /^[0-9]{12}$/.test(value);
    });

    this.registerValidator('aws-region', (value: string) => {
      return /^[a-z]{2}-[a-z]+-[0-9]$/.test(value);
    });

    this.registerValidator('aws-availability-zone', (value: string) => {
      return /^[a-z]{2}-[a-z]+-[0-9][a-z]$/.test(value);
    });

    // CIDR block validator
    this.registerValidator('cidr-block', (value: string) => {
      const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2}$/;
      if (!cidrRegex.test(value)) return false;

      const [ip, prefix] = value.split('/');
      const prefixNum = parseInt(prefix, 10);
      
      if (prefixNum < 0 || prefixNum > 32) return false;

      const parts = ip.split('.').map(part => parseInt(part, 10));
      return parts.every(part => part >= 0 && part <= 255);
    });

    // Port validator
    this.registerValidator('port', (value: number | string) => {
      const port = typeof value === 'string' ? parseInt(value, 10) : value;
      return port >= 1 && port <= 65535;
    });

    // Domain name validator
    this.registerValidator('domain', (value: string) => {
      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;
      return domainRegex.test(value) && value.length <= 253;
    });
  }

  /**
   * Register a custom validator
   */
  public registerValidator(name: string, validator: Function): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Validate a single field
   */
  public async validateField(
    fieldName: string,
    value: any,
    rule: FieldValidationRule,
    context?: ValidationContext,
    location?: ValidationLocation
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const fieldLocation = location ? { ...location, fieldPath: fieldName } : { fieldPath: fieldName };

    try {
      // Check if field is required
      if (rule.required && this.isEmpty(value)) {
        errors.push({
          field: fieldName,
          value,
          message: `Field '${fieldName}' is required`,
          code: 'REQUIRED_FIELD',
          severity: 'error',
          location: fieldLocation
        });
        return this.createResult(errors, warnings, startTime);
      }

      // Skip validation if value is empty and not required
      if (!rule.required && this.isEmpty(value)) {
        return this.createResult(errors, warnings, startTime);
      }

      // Type validation
      if (rule.type) {
        const typeValid = await this.validateType(fieldName, value, rule.type, errors, fieldLocation);
        if (!typeValid) {
          return this.createResult(errors, warnings, startTime);
        }
      }

      // String-specific validations
      if (typeof value === 'string') {
        await this.validateStringField(fieldName, value, rule, errors, warnings, fieldLocation);
      }

      // Number-specific validations
      if (typeof value === 'number') {
        await this.validateNumberField(fieldName, value, rule, errors, fieldLocation);
      }

      // Array-specific validations
      if (Array.isArray(value)) {
        await this.validateArrayField(fieldName, value, rule, errors, warnings, fieldLocation);
      }

      // Object-specific validations
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        await this.validateObjectField(fieldName, value, rule, errors, warnings, fieldLocation);
      }

      // Enum validation
      if (rule.enum && value !== undefined && value !== null) {
        if (!rule.enum.includes(value)) {
          errors.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' must be one of: ${rule.enum.join(', ')}`,
            code: 'INVALID_ENUM_VALUE',
            severity: 'error',
            location: fieldLocation
          });
        }
      }

      // Format validation
      if (rule.format && typeof value === 'string') {
        const formatValid = await this.validateFormat(fieldName, value, rule.format, errors, fieldLocation);
        if (!formatValid) {
          warnings.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' format validation failed but value was accepted`,
            code: 'FORMAT_WARNING',
            suggestion: `Ensure the value matches the expected ${rule.format} format`
          });
        }
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string') {
        if (!rule.pattern.test(value)) {
          errors.push({
            field: fieldName,
            value,
            message: `Field '${fieldName}' does not match the required pattern`,
            code: 'PATTERN_MISMATCH',
            severity: 'error',
            location: fieldLocation
          });
        }
      }

      // Custom validator
      if (rule.customValidator && context) {
        try {
          const customResult = await rule.customValidator(value, context);
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

      // Dependency validation
      if (rule.dependencies && context) {
        await this.validateDependencies(fieldName, value, rule.dependencies, context, errors, warnings, fieldLocation);
      }

      return this.createResult(errors, warnings, startTime);

    } catch (error) {
      errors.push({
        field: fieldName,
        value,
        message: `Field validation error: ${error.message}`,
        code: 'VALIDATION_EXCEPTION',
        severity: 'error',
        location: fieldLocation,
        context: error
      });
      return this.createResult(errors, warnings, startTime);
    }
  }

  /**
   * Validate multiple fields
   */
  public async validateFields(
    data: Record<string, any>,
    rules: Record<string, FieldValidationRule>,
    context?: ValidationContext,
    location?: ValidationLocation
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    for (const [fieldName, rule] of Object.entries(rules)) {
      const value = data[fieldName];
      const result = await this.validateField(fieldName, value, rule, context, location);
      
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      metadata: {
        totalRecords: Object.keys(rules).length,
        validRecords: Object.keys(rules).length - allErrors.length,
        errorCount: allErrors.length,
        warningCount: allWarnings.length,
        validationTime: Date.now() - startTime,
        validatedAt: new Date()
      }
    };
  }

  /**
   * Check if value is empty
   */
  private isEmpty(value: any): boolean {
    return value === undefined || value === null || value === '' || 
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
  }

  /**
   * Validate field type
   */
  private async validateType(
    fieldName: string,
    value: any,
    expectedType: string,
    errors: ValidationError[],
    location: ValidationLocation
  ): Promise<boolean> {
    let isValid = false;

    switch (expectedType) {
      case 'string':
        isValid = typeof value === 'string';
        break;
      case 'number':
        isValid = typeof value === 'number' && !isNaN(value);
        break;
      case 'boolean':
        isValid = typeof value === 'boolean';
        break;
      case 'object':
        isValid = typeof value === 'object' && value !== null && !Array.isArray(value);
        break;
      case 'array':
        isValid = Array.isArray(value);
        break;
      case 'date':
        isValid = value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
        break;
      default:
        isValid = true; // Unknown type, allow it
        break;
    }

    if (!isValid) {
      errors.push({
        field: fieldName,
        value,
        message: `Field '${fieldName}' must be of type ${expectedType}, got ${Array.isArray(value) ? 'array' : typeof value}`,
        code: 'INVALID_TYPE',
        severity: 'error',
        location
      });
    }

    return isValid;
  }

  /**
   * Validate string field
   */
  private async validateStringField(
    fieldName: string,
    value: string,
    rule: FieldValidationRule,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    location: ValidationLocation
  ): Promise<void> {
    // Length validations
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      errors.push({
        field: fieldName,
        value,
        message: `Field '${fieldName}' must be at least ${rule.minLength} characters long`,
        code: 'MIN_LENGTH_VIOLATION',
        severity: 'error',
        location
      });
    }

    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      errors.push({
        field: fieldName,
        value,
        message: `Field '${fieldName}' must not exceed ${rule.maxLength} characters`,
        code: 'MAX_LENGTH_VIOLATION',
        severity: 'error',
        location
      });
    }

    // Whitespace warnings
    if (value !== value.trim()) {
      warnings.push({
        field: fieldName,
        value,
        message: `Field '${fieldName}' contains leading or trailing whitespace`,
        code: 'WHITESPACE_WARNING',
        suggestion: 'Consider trimming whitespace from the value'
      });
    }
  }

  /**
   * Validate number field
   */
  private async validateNumberField(
    fieldName: string,
    value: number,
    rule: FieldValidationRule,
    errors: ValidationError[],
    location: ValidationLocation
  ): Promise<void> {
    if (rule.min !== undefined && value < rule.min) {
      errors.push({
        field: fieldName,
        value,
        message: `Field '${fieldName}' must be at least ${rule.min}`,
        code: 'MIN_VALUE_VIOLATION',
        severity: 'error',
        location
      });
    }

    if (rule.max !== undefined && value > rule.max) {
      errors.push({
        field: fieldName,
        value,
        message: `Field '${fieldName}' must not exceed ${rule.max}`,
        code: 'MAX_VALUE_VIOLATION',
        severity: 'error',
        location
      });
    }
  }

  /**
   * Validate array field
   */
  private async validateArrayField(
    fieldName: string,
    value: any[],
    rule: FieldValidationRule,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    location: ValidationLocation
  ): Promise<void> {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      errors.push({
        field: fieldName,
        value,
        message: `Array '${fieldName}' must contain at least ${rule.minLength} items`,
        code: 'MIN_ARRAY_LENGTH',
        severity: 'error',
        location
      });
    }

    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      errors.push({
        field: fieldName,
        value,
        message: `Array '${fieldName}' must not contain more than ${rule.maxLength} items`,
        code: 'MAX_ARRAY_LENGTH',
        severity: 'error',
        location
      });
    }

    // Check for duplicates
    const uniqueValues = new Set(value);
    if (uniqueValues.size !== value.length) {
      warnings.push({
        field: fieldName,
        value,
        message: `Array '${fieldName}' contains duplicate values`,
        code: 'ARRAY_DUPLICATES',
        suggestion: 'Consider removing duplicate values for consistency'
      });
    }
  }

  /**
   * Validate object field
   */
  private async validateObjectField(
    fieldName: string,
    value: object,
    rule: FieldValidationRule,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    location: ValidationLocation
  ): Promise<void> {
    const keys = Object.keys(value);

    if (rule.minLength !== undefined && keys.length < rule.minLength) {
      errors.push({
        field: fieldName,
        value,
        message: `Object '${fieldName}' must have at least ${rule.minLength} properties`,
        code: 'MIN_OBJECT_PROPERTIES',
        severity: 'error',
        location
      });
    }

    if (rule.maxLength !== undefined && keys.length > rule.maxLength) {
      errors.push({
        field: fieldName,
        value,
        message: `Object '${fieldName}' must not have more than ${rule.maxLength} properties`,
        code: 'MAX_OBJECT_PROPERTIES',
        severity: 'error',
        location
      });
    }
  }

  /**
   * Validate format using built-in or custom validators
   */
  private async validateFormat(
    fieldName: string,
    value: string,
    format: string,
    errors: ValidationError[],
    location: ValidationLocation
  ): Promise<boolean> {
    const validator = this.customValidators.get(format);
    
    if (!validator) {
      errors.push({
        field: fieldName,
        value,
        message: `Unknown format validator: ${format}`,
        code: 'UNKNOWN_FORMAT_VALIDATOR',
        severity: 'error',
        location
      });
      return false;
    }

    try {
      const isValid = await validator(value);
      
      if (!isValid) {
        errors.push({
          field: fieldName,
          value,
          message: `Field '${fieldName}' does not match the required ${format} format`,
          code: 'FORMAT_VALIDATION_FAILED',
          severity: 'error',
          location
        });
      }

      return isValid;
    } catch (error) {
      errors.push({
        field: fieldName,
        value,
        message: `Format validation error for ${format}: ${error.message}`,
        code: 'FORMAT_VALIDATOR_ERROR',
        severity: 'error',
        location
      });
      return false;
    }
  }

  /**
   * Validate field dependencies
   */
  private async validateDependencies(
    fieldName: string,
    value: any,
    dependencies: string[],
    context: ValidationContext,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    location: ValidationLocation
  ): Promise<void> {
    // This would typically check if dependent fields exist and are valid
    // Implementation depends on how context provides access to other field values
    // For now, just add a placeholder warning
    warnings.push({
      field: fieldName,
      value,
      message: `Field '${fieldName}' has dependencies: ${dependencies.join(', ')}`,
      code: 'DEPENDENCY_CHECK',
      suggestion: 'Ensure all dependent fields are properly validated'
    });
  }

  /**
   * Check if IPv6 address is in compressed format
   */
  private isValidIPv6Compressed(value: string): boolean {
    // Simple check for :: notation
    if (value.includes('::')) {
      const parts = value.split('::');
      if (parts.length !== 2) return false;
      
      // Check each part
      return parts.every(part => {
        if (part === '') return true;
        const segments = part.split(':');
        return segments.every(segment => 
          segment === '' || /^[0-9a-fA-F]{1,4}$/.test(segment)
        );
      });
    }
    return false;
  }

  /**
   * Create validation result
   */
  private createResult(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    startTime: number
  ): ValidationResult {
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        totalRecords: 1,
        validRecords: errors.length === 0 ? 1 : 0,
        errorCount: errors.length,
        warningCount: warnings.length,
        validationTime: Date.now() - startTime,
        validatedAt: new Date()
      }
    };
  }

  /**
   * Get all registered validators
   */
  public getRegisteredValidators(): string[] {
    return Array.from(this.customValidators.keys());
  }

  /**
   * Check if a validator exists
   */
  public hasValidator(name: string): boolean {
    return this.customValidators.has(name);
  }
}