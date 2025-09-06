/**
 * Validators Index
 * 
 * Comprehensive validation system for import/export operations
 * Supports schema-based validation with detailed error reporting
 */

// Export main validator classes
export { SchemaValidator } from './schema-validator';
export { FieldValidator } from './field-validator';
export { ImportValidator } from './import-validator';

// Export validation result types
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationContext,
  ValidationRule,
  ValidationOptions,
  FieldValidationRule,
  SchemaValidationRule,
  ImportValidationOptions,
  BatchValidationResult,
  ValidationLocation,
  ValidationMetadata,
  ValidationSummary,
  BusinessRuleContext,
  BatchValidationContext,
  NetworkResourceSchema,
  AwsResourceValidation,
  ComplianceRule,
  ValidationPerformance
} from './types';

// Export AWS-specific validators
export {
  validateAwsVpcId,
  validateAwsSubnetId,
  validateAwsAccountId,
  validateAwsTransitGatewayId,
  validateAwsCustomerGatewayId,
  validateAwsResourceId,
  validateCidrBlock,
  validateIpv4Address,
  validateIpv6CidrBlock,
  validateAwsRegion,
  validateAvailabilityZone
} from './aws-validators';

// Export business rule validators
export {
  validateVpcSubnetRelationship,
  validateCidrBlockOverlap,
  validateResourceOwnership,
  validateEnvironmentConsistency,
  validateTagCompliance
} from './business-validators';

// Export validation utilities
export {
  aggregateValidationResults,
  formatValidationErrors,
  formatValidationWarnings,
  createValidationContext,
  createValidationLocation,
  isValidationPassed,
  getValidationSummary,
  generateValidationSummary,
  mergeValidationResults,
  filterValidationResults,
  exportValidationResult,
  createValidationResult
} from './validation-utils';