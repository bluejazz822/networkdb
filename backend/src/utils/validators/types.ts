/**
 * Validation Types and Interfaces
 * 
 * Defines all types used throughout the validation system
 */

// Core validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: ValidationMetadata;
}

// Validation error with detailed location information
export interface ValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
  severity: 'error' | 'warning';
  location?: ValidationLocation;
  context?: any;
}

// Validation warning
export interface ValidationWarning {
  field: string;
  value: any;
  message: string;
  code: string;
  suggestion?: string;
  location?: ValidationLocation;
}

// Location information for errors
export interface ValidationLocation {
  row?: number;
  column?: number;
  line?: number;
  fieldPath?: string;
  sheet?: string; // For Excel files
  section?: string; // For JSON files
}

// Validation metadata
export interface ValidationMetadata {
  totalRecords: number;
  validRecords: number;
  errorCount: number;
  warningCount: number;
  validationTime: number;
  validatedAt: Date;
  resourceType?: string;
  batchId?: string;
}

// Validation context for passing data between validators
export interface ValidationContext {
  resourceType: string;
  operation: 'create' | 'update' | 'delete';
  existingData?: Map<string, any>;
  referenceData?: Map<string, any>;
  options?: ValidationOptions;
  batchContext?: BatchValidationContext;
}

// Batch validation context
export interface BatchValidationContext {
  batchId: string;
  currentIndex: number;
  totalRecords: number;
  processedIds: Set<string>;
  validatedIds: Set<string>;
}

// General validation options
export interface ValidationOptions {
  strict?: boolean;
  skipWarnings?: boolean;
  validateReferences?: boolean;
  validateBusinessRules?: boolean;
  maxErrors?: number;
  timeout?: number;
  customRules?: ValidationRule[];
}

// Generic validation rule interface
export interface ValidationRule {
  name: string;
  description: string;
  validate: (value: any, context: ValidationContext) => ValidationResult | Promise<ValidationResult>;
  applicableFields?: string[];
  priority?: number;
  async?: boolean;
}

// Field-specific validation rule
export interface FieldValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  format?: string;
  enum?: any[];
  customValidator?: (value: any, context: ValidationContext) => ValidationResult | Promise<ValidationResult>;
  dependencies?: string[];
}

// Schema validation rule
export interface SchemaValidationRule {
  resourceType: string;
  version?: string;
  fields: Record<string, FieldValidationRule>;
  requiredFields: string[];
  businessRules?: ValidationRule[];
  relationships?: RelationshipRule[];
}

// Relationship validation rule
export interface RelationshipRule {
  name: string;
  sourceField: string;
  targetResource: string;
  targetField: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  required?: boolean;
  cascadeValidation?: boolean;
}

// Import-specific validation options
export interface ImportValidationOptions extends ValidationOptions {
  fileType: 'csv' | 'excel' | 'json';
  hasHeaders?: boolean;
  delimiter?: string;
  encoding?: string;
  sheetName?: string;
  skipRows?: number;
  maxRows?: number;
  previewMode?: boolean;
  batchSize?: number;
}

// Batch validation result
export interface BatchValidationResult {
  batchId: string;
  totalRecords: number;
  processedRecords: number;
  validRecords: number;
  invalidRecords: number;
  results: ValidationResult[];
  summary: ValidationSummary;
  completedAt?: Date;
  processingTime: number;
}

// Validation summary
export interface ValidationSummary {
  totalErrors: number;
  totalWarnings: number;
  errorsByType: Record<string, number>;
  errorsByField: Record<string, number>;
  mostCommonErrors: ValidationErrorSummary[];
  criticalErrors: ValidationError[];
  recommendations: string[];
}

// Error summary for reporting
export interface ValidationErrorSummary {
  code: string;
  message: string;
  count: number;
  affectedFields: string[];
  firstOccurrence: ValidationLocation;
}

// Resource-specific validation schemas
export interface NetworkResourceSchema {
  vpc: SchemaValidationRule;
  subnet: SchemaValidationRule;
  transitGateway: SchemaValidationRule;
  transitGatewayAttachment: SchemaValidationRule;
  customerGateway: SchemaValidationRule;
}

// AWS-specific validation types
export interface AwsResourceValidation {
  resourceId: string;
  resourceType: string;
  accountId: string;
  region: string;
  isValidFormat: boolean;
  exists?: boolean;
  accessible?: boolean;
}

// Business rule validation context
export interface BusinessRuleContext extends ValidationContext {
  allRecords?: any[];
  existingResources?: Map<string, any>;
  accountLimits?: Record<string, number>;
  complianceRules?: ComplianceRule[];
}

// Compliance rule for business validation
export interface ComplianceRule {
  name: string;
  description: string;
  category: string;
  severity: 'error' | 'warning' | 'info';
  validate: (context: BusinessRuleContext) => ValidationResult | Promise<ValidationResult>;
  applicableResourceTypes: string[];
}

// Performance tracking for validation
export interface ValidationPerformance {
  totalTime: number;
  schemaValidationTime: number;
  fieldValidationTime: number;
  businessRuleValidationTime: number;
  validationsPerSecond: number;
  memoryUsage: number;
}