/**
 * Business Rule Validators
 * 
 * Complex validation rules for resource relationships and business logic
 */

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  BusinessRuleContext,
  ValidationLocation,
  ComplianceRule
} from './types';

import { validateCidrBlock, validateAwsVpcId, validateAwsSubnetId } from './aws-validators';

/**
 * Validate VPC-Subnet relationship constraints
 */
export async function validateVpcSubnetRelationship(
  subnetData: any,
  context: BusinessRuleContext,
  location?: ValidationLocation
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const { awsVpcId, awsSubnetId, cidrBlock, vpcId } = subnetData;

    // Validate that VPC exists in the context
    if (context.existingResources && awsVpcId) {
      const vpc = context.existingResources.get(awsVpcId);
      if (!vpc) {
        errors.push({
          field: 'awsVpcId',
          value: awsVpcId,
          message: `VPC ${awsVpcId} not found in existing resources`,
          code: 'VPC_NOT_FOUND',
          severity: 'error',
          location
        });
      } else {
        // Validate CIDR block is within VPC CIDR
        if (cidrBlock && vpc.cidrBlock) {
          const cidrValid = await validateCidrWithinVpc(cidrBlock, vpc.cidrBlock);
          if (!cidrValid.isValid) {
            errors.push({
              field: 'cidrBlock',
              value: cidrBlock,
              message: `Subnet CIDR ${cidrBlock} is not within VPC CIDR ${vpc.cidrBlock}`,
              code: 'SUBNET_CIDR_NOT_IN_VPC',
              severity: 'error',
              location
            });
          }
        }

        // Check for CIDR overlap with existing subnets in the same VPC
        if (context.allRecords && cidrBlock) {
          const overlapping = await findOverlappingSubnets(cidrBlock, awsVpcId, context.allRecords, awsSubnetId);
          if (overlapping.length > 0) {
            errors.push({
              field: 'cidrBlock',
              value: cidrBlock,
              message: `Subnet CIDR ${cidrBlock} overlaps with existing subnets: ${overlapping.join(', ')}`,
              code: 'SUBNET_CIDR_OVERLAP',
              severity: 'error',
              location
            });
          }
        }

        // Validate account consistency
        if (subnetData.awsAccountId && vpc.awsAccountId && subnetData.awsAccountId !== vpc.awsAccountId) {
          errors.push({
            field: 'awsAccountId',
            value: subnetData.awsAccountId,
            message: `Subnet account ${subnetData.awsAccountId} does not match VPC account ${vpc.awsAccountId}`,
            code: 'ACCOUNT_MISMATCH',
            severity: 'error',
            location
          });
        }

        // Validate region consistency
        if (subnetData.region && vpc.region && subnetData.region !== vpc.region) {
          errors.push({
            field: 'region',
            value: subnetData.region,
            message: `Subnet region ${subnetData.region} does not match VPC region ${vpc.region}`,
            code: 'REGION_MISMATCH',
            severity: 'error',
            location
          });
        }

        // Check availability zone is in the same region
        if (subnetData.availabilityZone && vpc.region) {
          const azRegion = subnetData.availabilityZone.slice(0, -1);
          if (azRegion !== vpc.region) {
            errors.push({
              field: 'availabilityZone',
              value: subnetData.availabilityZone,
              message: `Availability zone ${subnetData.availabilityZone} is not in VPC region ${vpc.region}`,
              code: 'AZ_REGION_MISMATCH',
              severity: 'error',
              location
            });
          }
        }
      }
    }

  } catch (error) {
    errors.push({
      field: 'relationship',
      value: subnetData,
      message: `VPC-Subnet relationship validation failed: ${error.message}`,
      code: 'RELATIONSHIP_VALIDATION_ERROR',
      severity: 'error',
      location,
      context: error
    });
  }

  return createBusinessValidationResult(errors, warnings);
}

/**
 * Validate CIDR block overlaps within a resource context
 */
export async function validateCidrBlockOverlap(
  cidrBlock: string,
  resourceType: string,
  context: BusinessRuleContext,
  location?: ValidationLocation
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    if (!context.allRecords) {
      warnings.push({
        field: 'cidrBlock',
        value: cidrBlock,
        message: 'Cannot validate CIDR overlaps without context records',
        code: 'MISSING_CONTEXT_RECORDS',
        suggestion: 'Provide all records in context for comprehensive validation'
      });
      return createBusinessValidationResult(errors, warnings);
    }

    const overlappingResources = await findCidrOverlaps(cidrBlock, resourceType, context.allRecords);
    
    if (overlappingResources.length > 0) {
      const overlappingIds = overlappingResources.map(r => r.id || r.awsVpcId || r.awsSubnetId).join(', ');
      errors.push({
        field: 'cidrBlock',
        value: cidrBlock,
        message: `CIDR block ${cidrBlock} overlaps with existing resources: ${overlappingIds}`,
        code: 'CIDR_OVERLAP_DETECTED',
        severity: 'error',
        location
      });
    }

    // Check for potential subnet exhaustion
    if (resourceType === 'vpc') {
      const subnetCount = await countSubnetsInVpc(cidrBlock, context.allRecords);
      const maxSubnets = calculateMaxSubnets(cidrBlock);
      
      if (subnetCount > maxSubnets * 0.8) {
        warnings.push({
          field: 'cidrBlock',
          value: cidrBlock,
          message: `VPC CIDR ${cidrBlock} is approaching subnet capacity (${subnetCount}/${maxSubnets})`,
          code: 'VPC_SUBNET_CAPACITY_WARNING',
          suggestion: 'Consider using a larger CIDR block for future subnet requirements'
        });
      }
    }

  } catch (error) {
    errors.push({
      field: 'cidrBlock',
      value: cidrBlock,
      message: `CIDR overlap validation failed: ${error.message}`,
      code: 'CIDR_VALIDATION_ERROR',
      severity: 'error',
      location,
      context: error
    });
  }

  return createBusinessValidationResult(errors, warnings);
}

/**
 * Validate resource ownership and access permissions
 */
export async function validateResourceOwnership(
  resourceData: any,
  context: BusinessRuleContext,
  location?: ValidationLocation
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // Check owner field is present
    if (!resourceData.owner && !resourceData.team) {
      warnings.push({
        field: 'owner',
        value: resourceData.owner,
        message: 'Resource does not have an assigned owner or team',
        code: 'MISSING_OWNER',
        suggestion: 'Assign an owner or team for accountability and management'
      });
    }

    // Validate owner format (email or team name)
    if (resourceData.owner) {
      const ownerValid = validateOwnerFormat(resourceData.owner);
      if (!ownerValid.isValid) {
        warnings.push({
          field: 'owner',
          value: resourceData.owner,
          message: ownerValid.message,
          code: 'INVALID_OWNER_FORMAT',
          suggestion: 'Use email address or valid team identifier'
        });
      }
    }

    // Check cost center is present for production resources
    if (resourceData.environment === 'prod' && !resourceData.costCenter) {
      errors.push({
        field: 'costCenter',
        value: resourceData.costCenter,
        message: 'Production resources must have a cost center assigned',
        code: 'MISSING_COST_CENTER_PROD',
        severity: 'error',
        location
      });
    }

    // Validate project assignment
    if (!resourceData.project) {
      warnings.push({
        field: 'project',
        value: resourceData.project,
        message: 'Resource does not have an assigned project',
        code: 'MISSING_PROJECT',
        suggestion: 'Assign a project for better resource organization'
      });
    }

  } catch (error) {
    errors.push({
      field: 'ownership',
      value: resourceData,
      message: `Ownership validation failed: ${error.message}`,
      code: 'OWNERSHIP_VALIDATION_ERROR',
      severity: 'error',
      location,
      context: error
    });
  }

  return createBusinessValidationResult(errors, warnings);
}

/**
 * Validate environment consistency and naming conventions
 */
export async function validateEnvironmentConsistency(
  resourceData: any,
  context: BusinessRuleContext,
  location?: ValidationLocation
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const { environment, name, tags } = resourceData;

    // Validate environment values
    const validEnvironments = ['dev', 'test', 'staging', 'prod', 'sandbox'];
    if (environment && !validEnvironments.includes(environment)) {
      errors.push({
        field: 'environment',
        value: environment,
        message: `Invalid environment value. Must be one of: ${validEnvironments.join(', ')}`,
        code: 'INVALID_ENVIRONMENT',
        severity: 'error',
        location
      });
    }

    // Check naming convention consistency
    if (name && environment) {
      const namingValid = validateNamingConvention(name, environment);
      if (!namingValid.isValid) {
        warnings.push({
          field: 'name',
          value: name,
          message: namingValid.message,
          code: 'NAMING_CONVENTION_WARNING',
          suggestion: namingValid.suggestion
        });
      }
    }

    // Check tag consistency with environment
    if (tags && environment) {
      const envTag = tags.Environment || tags.environment;
      if (envTag && envTag !== environment) {
        warnings.push({
          field: 'tags',
          value: tags,
          message: `Environment tag (${envTag}) does not match environment field (${environment})`,
          code: 'ENVIRONMENT_TAG_MISMATCH',
          suggestion: 'Ensure environment field and Environment tag are consistent'
        });
      }
    }

    // Production environment additional checks
    if (environment === 'prod') {
      const prodChecks = await validateProductionRequirements(resourceData);
      errors.push(...prodChecks.errors);
      warnings.push(...prodChecks.warnings);
    }

  } catch (error) {
    errors.push({
      field: 'environment',
      value: resourceData,
      message: `Environment validation failed: ${error.message}`,
      code: 'ENVIRONMENT_VALIDATION_ERROR',
      severity: 'error',
      location,
      context: error
    });
  }

  return createBusinessValidationResult(errors, warnings);
}

/**
 * Validate tag compliance with organizational standards
 */
export async function validateTagCompliance(
  resourceData: any,
  context: BusinessRuleContext,
  location?: ValidationLocation
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const { tags, environment, project, owner, costCenter } = resourceData;

    // Required tags for production
    const requiredProdTags = ['Environment', 'Project', 'Owner', 'CostCenter'];
    const requiredDevTags = ['Environment', 'Project'];
    
    const requiredTags = environment === 'prod' ? requiredProdTags : requiredDevTags;

    if (!tags) {
      if (environment === 'prod') {
        errors.push({
          field: 'tags',
          value: tags,
          message: 'Production resources must have tags',
          code: 'MISSING_TAGS_PROD',
          severity: 'error',
          location
        });
      } else {
        warnings.push({
          field: 'tags',
          value: tags,
          message: 'Resource should have tags for better organization',
          code: 'MISSING_TAGS',
          suggestion: 'Add relevant tags for resource identification and management'
        });
      }
      return createBusinessValidationResult(errors, warnings);
    }

    // Check for required tags
    for (const requiredTag of requiredTags) {
      if (!tags[requiredTag]) {
        const severity = environment === 'prod' ? 'error' : 'warning';
        const errorOrWarning = {
          field: 'tags',
          value: tags,
          message: `Missing required tag: ${requiredTag}`,
          code: 'MISSING_REQUIRED_TAG',
          ...(severity === 'error' ? { severity: 'error' as const, location } : 
              { suggestion: `Add ${requiredTag} tag for better resource management` })
        };

        if (severity === 'error') {
          errors.push(errorOrWarning as ValidationError);
        } else {
          warnings.push(errorOrWarning as ValidationWarning);
        }
      }
    }

    // Validate tag value formats
    const tagValidations = [
      { tag: 'Environment', expected: environment },
      { tag: 'Project', expected: project },
      { tag: 'Owner', expected: owner },
      { tag: 'CostCenter', expected: costCenter }
    ];

    for (const { tag, expected } of tagValidations) {
      if (tags[tag] && expected && tags[tag] !== expected) {
        warnings.push({
          field: 'tags',
          value: tags,
          message: `Tag ${tag} (${tags[tag]}) does not match field value (${expected})`,
          code: 'TAG_FIELD_MISMATCH',
          suggestion: `Ensure ${tag} tag matches the corresponding field value`
        });
      }
    }

    // Check for non-standard tag keys
    const standardTags = new Set(['Environment', 'Project', 'Owner', 'CostCenter', 'Name', 'Description', 'Team']);
    const nonStandardTags = Object.keys(tags).filter(tag => !standardTags.has(tag));
    
    if (nonStandardTags.length > 0) {
      warnings.push({
        field: 'tags',
        value: tags,
        message: `Non-standard tag keys found: ${nonStandardTags.join(', ')}`,
        code: 'NON_STANDARD_TAGS',
        suggestion: 'Consider using standard tag keys for consistency'
      });
    }

    // Validate tag value lengths and formats
    for (const [key, value] of Object.entries(tags)) {
      if (typeof value === 'string' && value.length > 256) {
        errors.push({
          field: 'tags',
          value: tags,
          message: `Tag ${key} value exceeds maximum length of 256 characters`,
          code: 'TAG_VALUE_TOO_LONG',
          severity: 'error',
          location
        });
      }
    }

  } catch (error) {
    errors.push({
      field: 'tags',
      value: resourceData,
      message: `Tag compliance validation failed: ${error.message}`,
      code: 'TAG_VALIDATION_ERROR',
      severity: 'error',
      location,
      context: error
    });
  }

  return createBusinessValidationResult(errors, warnings);
}

// Helper functions

async function validateCidrWithinVpc(subnetCidr: string, vpcCidr: string): Promise<{ isValid: boolean; message?: string }> {
  try {
    // Parse CIDR blocks
    const [subnetNetwork, subnetPrefix] = subnetCidr.split('/');
    const [vpcNetwork, vpcPrefix] = vpcCidr.split('/');
    
    const subnetPrefixNum = parseInt(subnetPrefix, 10);
    const vpcPrefixNum = parseInt(vpcPrefix, 10);

    // Subnet prefix must be larger (more specific) than VPC prefix
    if (subnetPrefixNum <= vpcPrefixNum) {
      return { isValid: false, message: 'Subnet CIDR must be more specific than VPC CIDR' };
    }

    // Convert to numeric representation for comparison
    const subnetAddr = ipToNumber(subnetNetwork);
    const vpcAddr = ipToNumber(vpcNetwork);
    
    const vpcMask = (0xFFFFFFFF << (32 - vpcPrefixNum)) >>> 0;
    const subnetInVpcNetwork = (subnetAddr & vpcMask) >>> 0;
    
    return { 
      isValid: subnetInVpcNetwork === vpcAddr,
      message: subnetInVpcNetwork !== vpcAddr ? 'Subnet is not within VPC network range' : undefined
    };
  } catch (error) {
    return { isValid: false, message: `CIDR validation error: ${error.message}` };
  }
}

async function findOverlappingSubnets(cidrBlock: string, vpcId: string, allRecords: any[], excludeSubnetId?: string): Promise<string[]> {
  const overlapping: string[] = [];
  
  try {
    const subnets = allRecords.filter(record => 
      record.resourceType === 'subnet' && 
      record.awsVpcId === vpcId &&
      record.awsSubnetId !== excludeSubnetId
    );

    for (const subnet of subnets) {
      if (subnet.cidrBlock && await cidrBlocksOverlap(cidrBlock, subnet.cidrBlock)) {
        overlapping.push(subnet.awsSubnetId || subnet.name || 'unknown');
      }
    }
  } catch (error) {
    console.error('Error finding overlapping subnets:', error);
  }

  return overlapping;
}

async function findCidrOverlaps(cidrBlock: string, resourceType: string, allRecords: any[]): Promise<any[]> {
  const overlapping: any[] = [];
  
  try {
    const relevantRecords = allRecords.filter(record => record.cidrBlock);

    for (const record of relevantRecords) {
      if (await cidrBlocksOverlap(cidrBlock, record.cidrBlock)) {
        overlapping.push(record);
      }
    }
  } catch (error) {
    console.error('Error finding CIDR overlaps:', error);
  }

  return overlapping;
}

async function cidrBlocksOverlap(cidr1: string, cidr2: string): Promise<boolean> {
  try {
    const [network1, prefix1] = cidr1.split('/');
    const [network2, prefix2] = cidr2.split('/');
    
    const addr1 = ipToNumber(network1);
    const addr2 = ipToNumber(network2);
    const prefixNum1 = parseInt(prefix1, 10);
    const prefixNum2 = parseInt(prefix2, 10);

    // Determine the smaller (less specific) prefix
    const minPrefix = Math.min(prefixNum1, prefixNum2);
    const mask = (0xFFFFFFFF << (32 - minPrefix)) >>> 0;

    // Check if networks overlap at the less specific level
    const network1Masked = (addr1 & mask) >>> 0;
    const network2Masked = (addr2 & mask) >>> 0;

    return network1Masked === network2Masked;
  } catch (error) {
    return false;
  }
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(part => parseInt(part, 10));
  return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
}

async function countSubnetsInVpc(vpcCidr: string, allRecords: any[]): Promise<number> {
  return allRecords.filter(record => 
    record.resourceType === 'subnet' && 
    record.cidrBlock
  ).length;
}

function calculateMaxSubnets(vpcCidr: string): number {
  const [, prefix] = vpcCidr.split('/');
  const prefixNum = parseInt(prefix, 10);
  
  // Assuming /24 subnets as default
  const subnetPrefix = 24;
  if (prefixNum >= subnetPrefix) return 1;
  
  return Math.pow(2, subnetPrefix - prefixNum);
}

function validateOwnerFormat(owner: string): { isValid: boolean; message?: string } {
  // Email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(owner)) {
    return { isValid: true };
  }

  // Team name format (alphanumeric with hyphens/underscores)
  const teamRegex = /^[a-zA-Z0-9_-]+$/;
  if (teamRegex.test(owner)) {
    return { isValid: true };
  }

  return { 
    isValid: false, 
    message: 'Owner must be a valid email address or team name (alphanumeric with hyphens/underscores)'
  };
}

function validateNamingConvention(name: string, environment: string): { isValid: boolean; message?: string; suggestion?: string } {
  // Expected format: {environment}-{resource-type}-{identifier}
  const expectedPrefix = environment.toLowerCase();
  
  if (!name.toLowerCase().startsWith(expectedPrefix)) {
    return {
      isValid: false,
      message: `Resource name should start with environment prefix '${expectedPrefix}'`,
      suggestion: `Consider renaming to '${expectedPrefix}-{resource-type}-{identifier}'`
    };
  }

  // Check for invalid characters
  const validName = /^[a-zA-Z0-9-_]+$/.test(name);
  if (!validName) {
    return {
      isValid: false,
      message: 'Resource name contains invalid characters',
      suggestion: 'Use only alphanumeric characters, hyphens, and underscores'
    };
  }

  return { isValid: true };
}

async function validateProductionRequirements(resourceData: any): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Production resources must have description
  if (!resourceData.description) {
    errors.push({
      field: 'description',
      value: resourceData.description,
      message: 'Production resources must have a description',
      code: 'MISSING_DESCRIPTION_PROD',
      severity: 'error'
    });
  }

  // Production resources should have backup/monitoring tags
  if (resourceData.tags) {
    if (!resourceData.tags.Backup && !resourceData.tags.backup) {
      warnings.push({
        field: 'tags',
        value: resourceData.tags,
        message: 'Production resource should have backup configuration specified in tags',
        code: 'MISSING_BACKUP_TAG',
        suggestion: 'Add Backup tag to specify backup requirements'
      });
    }

    if (!resourceData.tags.Monitoring && !resourceData.tags.monitoring) {
      warnings.push({
        field: 'tags',
        value: resourceData.tags,
        message: 'Production resource should have monitoring configuration specified in tags',
        code: 'MISSING_MONITORING_TAG',
        suggestion: 'Add Monitoring tag to specify monitoring requirements'
      });
    }
  }

  return { errors, warnings };
}

function createBusinessValidationResult(errors: ValidationError[], warnings: ValidationWarning[]): ValidationResult {
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