/**
 * Validation Utilities
 * 
 * Utility functions for validation result processing, error reporting, and aggregation
 */

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationContext,
  ValidationLocation,
  BatchValidationResult,
  ValidationSummary,
  ValidationErrorSummary,
  ValidationMetadata
} from './types';

/**
 * Aggregate multiple validation results into a single batch result
 */
export function aggregateValidationResults(
  results: ValidationResult[],
  batchId: string,
  processingTime: number
): BatchValidationResult {
  const totalRecords = results.length;
  const validRecords = results.filter(r => r.isValid).length;
  const invalidRecords = totalRecords - validRecords;

  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];

  // Collect all errors and warnings
  for (const result of results) {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  // Generate summary
  const summary = generateValidationSummary(allErrors, allWarnings);

  return {
    batchId,
    totalRecords,
    processedRecords: totalRecords,
    validRecords,
    invalidRecords,
    results,
    summary,
    completedAt: new Date(),
    processingTime
  };
}

/**
 * Generate comprehensive validation summary
 */
export function generateValidationSummary(
  errors: ValidationError[],
  warnings: ValidationWarning[]
): ValidationSummary {
  const errorsByType: Record<string, number> = {};
  const errorsByField: Record<string, number> = {};
  const errorCounts: Map<string, { count: number; fields: Set<string>; firstLocation?: ValidationLocation }> = new Map();

  // Process errors
  for (const error of errors) {
    // Count by error code
    errorsByType[error.code] = (errorsByType[error.code] || 0) + 1;

    // Count by field
    errorsByField[error.field] = (errorsByField[error.field] || 0) + 1;

    // Track error details for summary
    if (!errorCounts.has(error.code)) {
      errorCounts.set(error.code, {
        count: 0,
        fields: new Set(),
        firstLocation: error.location
      });
    }
    
    const errorData = errorCounts.get(error.code)!;
    errorData.count++;
    errorData.fields.add(error.field);
  }

  // Generate most common errors
  const mostCommonErrors: ValidationErrorSummary[] = Array.from(errorCounts.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([code, data]) => ({
      code,
      message: errors.find(e => e.code === code)?.message || 'Unknown error',
      count: data.count,
      affectedFields: Array.from(data.fields),
      firstOccurrence: data.firstLocation || {}
    }));

  // Identify critical errors
  const criticalErrorCodes = new Set([
    'REQUIRED_FIELD_MISSING',
    'INVALID_TYPE',
    'INVALID_FORMAT',
    'CIDR_OVERLAP_DETECTED',
    'VPC_NOT_FOUND',
    'ACCOUNT_MISMATCH',
    'REGION_MISMATCH'
  ]);

  const criticalErrors = errors.filter(error => 
    criticalErrorCodes.has(error.code) || error.severity === 'error'
  );

  // Generate recommendations
  const recommendations = generateRecommendations(errors, warnings);

  return {
    totalErrors: errors.length,
    totalWarnings: warnings.length,
    errorsByType,
    errorsByField,
    mostCommonErrors,
    criticalErrors,
    recommendations
  };
}

/**
 * Format validation errors for human-readable output
 */
export function formatValidationErrors(
  errors: ValidationError[],
  format: 'text' | 'json' | 'csv' = 'text'
): string {
  if (errors.length === 0) {
    return format === 'json' ? '[]' : 'No validation errors found.';
  }

  switch (format) {
    case 'json':
      return JSON.stringify(errors, null, 2);

    case 'csv':
      const headers = ['Field', 'Value', 'Error Code', 'Message', 'Severity', 'Location'];
      const rows = errors.map(error => [
        error.field,
        JSON.stringify(error.value),
        error.code,
        error.message,
        error.severity,
        formatLocation(error.location)
      ]);
      
      return [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    case 'text':
    default:
      return errors.map((error, index) => {
        const location = formatLocation(error.location);
        return [
          `${index + 1}. ${error.severity.toUpperCase()}: ${error.message}`,
          `   Field: ${error.field}`,
          `   Value: ${JSON.stringify(error.value)}`,
          `   Code: ${error.code}`,
          location ? `   Location: ${location}` : null
        ].filter(Boolean).join('\n');
      }).join('\n\n');
  }
}

/**
 * Format validation warnings for human-readable output
 */
export function formatValidationWarnings(
  warnings: ValidationWarning[],
  format: 'text' | 'json' | 'csv' = 'text'
): string {
  if (warnings.length === 0) {
    return format === 'json' ? '[]' : 'No validation warnings found.';
  }

  switch (format) {
    case 'json':
      return JSON.stringify(warnings, null, 2);

    case 'csv':
      const headers = ['Field', 'Value', 'Code', 'Message', 'Suggestion', 'Location'];
      const rows = warnings.map(warning => [
        warning.field,
        JSON.stringify(warning.value),
        warning.code,
        warning.message,
        warning.suggestion || '',
        formatLocation(warning.location)
      ]);
      
      return [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    case 'text':
    default:
      return warnings.map((warning, index) => {
        const location = formatLocation(warning.location);
        return [
          `${index + 1}. WARNING: ${warning.message}`,
          `   Field: ${warning.field}`,
          `   Value: ${JSON.stringify(warning.value)}`,
          `   Code: ${warning.code}`,
          warning.suggestion ? `   Suggestion: ${warning.suggestion}` : null,
          location ? `   Location: ${location}` : null
        ].filter(Boolean).join('\n');
      }).join('\n\n');
  }
}

/**
 * Create validation context with default values
 */
export function createValidationContext(
  resourceType: string,
  operation: 'create' | 'update' | 'delete',
  options?: Partial<ValidationContext>
): ValidationContext {
  return {
    resourceType,
    operation,
    existingData: new Map(),
    referenceData: new Map(),
    options: {
      strict: false,
      skipWarnings: false,
      validateReferences: true,
      validateBusinessRules: true,
      maxErrors: 100,
      timeout: 30000,
      ...options?.options
    },
    ...options
  };
}

/**
 * Check if validation passed (no errors)
 */
export function isValidationPassed(result: ValidationResult | BatchValidationResult): boolean {
  if ('isValid' in result) {
    return result.isValid;
  } else {
    return result.invalidRecords === 0;
  }
}

/**
 * Get validation summary for a single result
 */
export function getValidationSummary(result: ValidationResult): ValidationSummary {
  return generateValidationSummary(result.errors, result.warnings);
}

/**
 * Create enhanced validation location with line numbers and context
 */
export function createValidationLocation(
  row?: number,
  column?: number,
  fieldPath?: string,
  context?: {
    sheet?: string;
    section?: string;
    fileName?: string;
  }
): ValidationLocation {
  return {
    row,
    column,
    line: row, // Alias for compatibility
    fieldPath,
    sheet: context?.sheet,
    section: context?.section
  };
}

/**
 * Format location information for display
 */
export function formatLocation(location?: ValidationLocation): string {
  if (!location) return '';

  const parts: string[] = [];

  if (location.sheet) {
    parts.push(`Sheet: ${location.sheet}`);
  }

  if (location.section) {
    parts.push(`Section: ${location.section}`);
  }

  if (location.row !== undefined) {
    parts.push(`Row: ${location.row}`);
  }

  if (location.column !== undefined) {
    parts.push(`Column: ${location.column}`);
  }

  if (location.fieldPath) {
    parts.push(`Field: ${location.fieldPath}`);
  }

  return parts.join(', ');
}

/**
 * Generate recommendations based on error patterns
 */
export function generateRecommendations(
  errors: ValidationError[],
  warnings: ValidationWarning[]
): string[] {
  const recommendations: string[] = [];
  const errorCodes = new Set(errors.map(e => e.code));
  const warningCodes = new Set(warnings.map(w => w.code));

  // Missing required fields
  if (errorCodes.has('REQUIRED_FIELD_MISSING')) {
    recommendations.push('Ensure all required fields are provided in your data');
  }

  // Format issues
  if (errorCodes.has('INVALID_FORMAT') || errorCodes.has('PATTERN_MISMATCH')) {
    recommendations.push('Verify that field formats match AWS resource ID patterns (e.g., vpc-xxxxxxxxxxxxxxxxx)');
  }

  // CIDR block issues
  if (errorCodes.has('CIDR_OVERLAP_DETECTED') || errorCodes.has('INVALID_CIDR_FORMAT')) {
    recommendations.push('Review CIDR block assignments to avoid overlaps and ensure proper network addressing');
  }

  // Relationship issues
  if (errorCodes.has('VPC_NOT_FOUND') || errorCodes.has('ACCOUNT_MISMATCH') || errorCodes.has('REGION_MISMATCH')) {
    recommendations.push('Validate resource relationships and ensure consistency across accounts and regions');
  }

  // Tag compliance
  if (warningCodes.has('MISSING_TAGS') || errorCodes.has('MISSING_REQUIRED_TAG')) {
    recommendations.push('Implement consistent tagging strategy with required tags for production resources');
  }

  // Naming conventions
  if (warningCodes.has('NAMING_CONVENTION_WARNING')) {
    recommendations.push('Adopt standardized naming conventions that include environment prefixes');
  }

  // Ownership and governance
  if (warningCodes.has('MISSING_OWNER') || errorCodes.has('MISSING_COST_CENTER_PROD')) {
    recommendations.push('Assign owners and cost centers to resources for proper accountability and billing');
  }

  // Performance and capacity
  if (warningCodes.has('VPC_SUBNET_CAPACITY_WARNING')) {
    recommendations.push('Plan for future growth by using appropriately sized CIDR blocks');
  }

  // Data quality
  if (warningCodes.has('WHITESPACE_WARNING') || warningCodes.has('AWS_ID_WHITESPACE')) {
    recommendations.push('Clean up data by removing unnecessary whitespace and formatting inconsistencies');
  }

  // If no specific recommendations, provide general guidance
  if (recommendations.length === 0 && (errors.length > 0 || warnings.length > 0)) {
    recommendations.push('Review validation errors and warnings to improve data quality');
  }

  return recommendations;
}

/**
 * Create validation result with metadata
 */
export function createValidationResult(
  isValid: boolean,
  errors: ValidationError[] = [],
  warnings: ValidationWarning[] = [],
  metadata?: Partial<ValidationMetadata>
): ValidationResult {
  const defaultMetadata: ValidationMetadata = {
    totalRecords: 1,
    validRecords: isValid ? 1 : 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    validationTime: 0,
    validatedAt: new Date(),
    ...metadata
  };

  return {
    isValid,
    errors,
    warnings,
    metadata: defaultMetadata
  };
}

/**
 * Merge multiple validation results into one
 */
export function mergeValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  let totalRecords = 0;
  let validRecords = 0;
  let totalValidationTime = 0;

  for (const result of results) {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
    totalRecords += result.metadata.totalRecords;
    validRecords += result.metadata.validRecords;
    totalValidationTime += result.metadata.validationTime;
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    metadata: {
      totalRecords,
      validRecords,
      errorCount: allErrors.length,
      warningCount: allWarnings.length,
      validationTime: totalValidationTime,
      validatedAt: new Date()
    }
  };
}

/**
 * Filter validation results by severity or field
 */
export function filterValidationResults(
  result: ValidationResult,
  filters: {
    severity?: ('error' | 'warning')[];
    fields?: string[];
    codes?: string[];
  }
): ValidationResult {
  let filteredErrors = result.errors;
  let filteredWarnings = result.warnings;

  if (filters.severity) {
    if (!filters.severity.includes('error')) {
      filteredErrors = [];
    }
    if (!filters.severity.includes('warning')) {
      filteredWarnings = [];
    }
  }

  if (filters.fields) {
    filteredErrors = filteredErrors.filter(e => filters.fields!.includes(e.field));
    filteredWarnings = filteredWarnings.filter(w => filters.fields!.includes(w.field));
  }

  if (filters.codes) {
    filteredErrors = filteredErrors.filter(e => filters.codes!.includes(e.code));
    filteredWarnings = filteredWarnings.filter(w => filters.codes!.includes(w.code));
  }

  return {
    ...result,
    isValid: filteredErrors.length === 0,
    errors: filteredErrors,
    warnings: filteredWarnings,
    metadata: {
      ...result.metadata,
      errorCount: filteredErrors.length,
      warningCount: filteredWarnings.length
    }
  };
}

/**
 * Convert validation result to different output formats
 */
export function exportValidationResult(
  result: ValidationResult | BatchValidationResult,
  format: 'json' | 'csv' | 'text' | 'summary'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);

    case 'csv':
      if ('results' in result) {
        // Batch result - export all errors from all results
        const allErrors = result.results.flatMap(r => r.errors);
        return formatValidationErrors(allErrors, 'csv');
      } else {
        return formatValidationErrors(result.errors, 'csv');
      }

    case 'text':
      if ('results' in result) {
        // Batch result
        const sections = [
          `Batch Validation Report - ${result.batchId}`,
          `Total Records: ${result.totalRecords}`,
          `Valid Records: ${result.validRecords}`,
          `Invalid Records: ${result.invalidRecords}`,
          `Processing Time: ${result.processingTime}ms`,
          '',
          'Summary:',
          `- Total Errors: ${result.summary.totalErrors}`,
          `- Total Warnings: ${result.summary.totalWarnings}`,
          `- Critical Errors: ${result.summary.criticalErrors.length}`,
          '',
          'Recommendations:',
          ...result.summary.recommendations.map(r => `- ${r}`)
        ];
        return sections.join('\n');
      } else {
        const summary = getValidationSummary(result);
        const sections = [
          'Validation Report',
          `Valid: ${result.isValid ? 'Yes' : 'No'}`,
          `Errors: ${result.errors.length}`,
          `Warnings: ${result.warnings.length}`,
          '',
          'Errors:',
          formatValidationErrors(result.errors, 'text'),
          '',
          'Warnings:',
          formatValidationWarnings(result.warnings, 'text')
        ];
        return sections.join('\n');
      }

    case 'summary':
    default:
      if ('summary' in result) {
        return JSON.stringify(result.summary, null, 2);
      } else {
        const summary = getValidationSummary(result);
        return JSON.stringify(summary, null, 2);
      }
  }
}