/**
 * AWS-Specific Validators
 * 
 * Specialized validation functions for AWS resource identifiers and formats
 */

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationLocation,
  AwsResourceValidation
} from './types';

/**
 * AWS Regions mapping for validation
 */
const AWS_REGIONS = new Set([
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1',
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1', 'eu-south-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3', 'ap-south-1', 'ap-east-1',
  'sa-east-1',
  'me-south-1',
  'af-south-1'
]);

/**
 * AWS Resource ID patterns
 */
const AWS_PATTERNS = {
  VPC_ID: /^vpc-[a-f0-9]{8}([a-f0-9]{9})?$/,
  SUBNET_ID: /^subnet-[a-f0-9]{8}([a-f0-9]{9})?$/,
  INSTANCE_ID: /^i-[a-f0-9]{8}([a-f0-9]{9})?$/,
  SECURITY_GROUP_ID: /^sg-[a-f0-9]{8}([a-f0-9]{9})?$/,
  INTERNET_GATEWAY_ID: /^igw-[a-f0-9]{8}([a-f0-9]{9})?$/,
  NAT_GATEWAY_ID: /^nat-[a-f0-9]{17}$/,
  ROUTE_TABLE_ID: /^rtb-[a-f0-9]{8}([a-f0-9]{9})?$/,
  NETWORK_ACL_ID: /^acl-[a-f0-9]{8}([a-f0-9]{9})?$/,
  TRANSIT_GATEWAY_ID: /^tgw-[a-f0-9]{17}$/,
  TRANSIT_GATEWAY_ATTACHMENT_ID: /^tgw-attach-[a-f0-9]{17}$/,
  CUSTOMER_GATEWAY_ID: /^cgw-[a-f0-9]{8}([a-f0-9]{9})?$/,
  VPN_CONNECTION_ID: /^vpn-[a-f0-9]{8}([a-f0-9]{9})?$/,
  VPN_GATEWAY_ID: /^vgw-[a-f0-9]{8}([a-f0-9]{9})?$/,
  DHCP_OPTIONS_ID: /^dopt-[a-f0-9]{8}([a-f0-9]{9})?$/,
  PEERING_CONNECTION_ID: /^pcx-[a-f0-9]{8}([a-f0-9]{9})?$/,
  ENDPOINT_ID: /^vpce-[a-f0-9]{8}([a-f0-9]{9})?$/,
  ACCOUNT_ID: /^[0-9]{12}$/,
  AVAILABILITY_ZONE: /^[a-z]{2}-[a-z]+-[0-9]+[a-z]$/,
  REGION: /^[a-z]{2}-[a-z]+-[0-9]+$/
};

/**
 * Validate AWS VPC ID format
 */
export function validateAwsVpcId(
  value: string,
  location?: ValidationLocation
): ValidationResult {
  return validateAwsResourceId(value, 'VPC_ID', 'AWS VPC ID', location);
}

/**
 * Validate AWS Subnet ID format
 */
export function validateAwsSubnetId(
  value: string,
  location?: ValidationLocation
): ValidationResult {
  return validateAwsResourceId(value, 'SUBNET_ID', 'AWS Subnet ID', location);
}

/**
 * Validate AWS Account ID format
 */
export function validateAwsAccountId(
  value: string,
  location?: ValidationLocation
): ValidationResult {
  return validateAwsResourceId(value, 'ACCOUNT_ID', 'AWS Account ID', location);
}

/**
 * Validate AWS Transit Gateway ID format
 */
export function validateAwsTransitGatewayId(
  value: string,
  location?: ValidationLocation
): ValidationResult {
  return validateAwsResourceId(value, 'TRANSIT_GATEWAY_ID', 'AWS Transit Gateway ID', location);
}

/**
 * Validate AWS Customer Gateway ID format
 */
export function validateAwsCustomerGatewayId(
  value: string,
  location?: ValidationLocation
): ValidationResult {
  return validateAwsResourceId(value, 'CUSTOMER_GATEWAY_ID', 'AWS Customer Gateway ID', location);
}

/**
 * Generic AWS Resource ID validator
 */
export function validateAwsResourceId(
  value: string,
  resourceType: keyof typeof AWS_PATTERNS,
  displayName: string,
  location?: ValidationLocation
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!value || typeof value !== 'string') {
    errors.push({
      field: 'awsResourceId',
      value,
      message: `${displayName} must be a non-empty string`,
      code: 'INVALID_AWS_RESOURCE_ID',
      severity: 'error',
      location
    });
  } else {
    const pattern = AWS_PATTERNS[resourceType];
    if (!pattern.test(value)) {
      errors.push({
        field: 'awsResourceId',
        value,
        message: `Invalid ${displayName} format. Expected pattern: ${pattern.source}`,
        code: 'INVALID_AWS_RESOURCE_ID_FORMAT',
        severity: 'error',
        location
      });
    }

    // Check for common mistakes
    if (value.includes(' ')) {
      warnings.push({
        field: 'awsResourceId',
        value,
        message: `${displayName} contains spaces, which is not valid`,
        code: 'AWS_ID_CONTAINS_SPACES',
        suggestion: 'Remove all spaces from the AWS resource ID'
      });
    }

    if (value !== value.trim()) {
      warnings.push({
        field: 'awsResourceId',
        value,
        message: `${displayName} has leading or trailing whitespace`,
        code: 'AWS_ID_WHITESPACE',
        suggestion: 'Trim whitespace from the AWS resource ID'
      });
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

/**
 * Validate CIDR block format and ranges
 */
export function validateCidrBlock(
  value: string,
  options: {
    allowPrivateOnly?: boolean;
    minPrefix?: number;
    maxPrefix?: number;
    location?: ValidationLocation;
  } = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const { allowPrivateOnly = false, minPrefix = 8, maxPrefix = 30, location } = options;

  if (!value || typeof value !== 'string') {
    errors.push({
      field: 'cidrBlock',
      value,
      message: 'CIDR block must be a non-empty string',
      code: 'INVALID_CIDR_BLOCK',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  // Basic format validation
  const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2}$/;
  if (!cidrRegex.test(value)) {
    errors.push({
      field: 'cidrBlock',
      value,
      message: 'Invalid CIDR block format. Expected format: x.x.x.x/xx',
      code: 'INVALID_CIDR_FORMAT',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  const [ip, prefixStr] = value.split('/');
  const prefix = parseInt(prefixStr, 10);

  // Validate prefix length
  if (prefix < 0 || prefix > 32) {
    errors.push({
      field: 'cidrBlock',
      value,
      message: 'CIDR prefix must be between 0 and 32',
      code: 'INVALID_CIDR_PREFIX',
      severity: 'error',
      location
    });
  } else {
    // Check prefix range constraints
    if (prefix < minPrefix) {
      warnings.push({
        field: 'cidrBlock',
        value,
        message: `CIDR prefix /${prefix} is smaller than recommended minimum /${minPrefix}`,
        code: 'CIDR_PREFIX_TOO_SMALL',
        suggestion: `Consider using a prefix of /${minPrefix} or larger`
      });
    }

    if (prefix > maxPrefix) {
      warnings.push({
        field: 'cidrBlock',
        value,
        message: `CIDR prefix /${prefix} is larger than recommended maximum /${maxPrefix}`,
        code: 'CIDR_PREFIX_TOO_LARGE',
        suggestion: `Consider using a prefix of /${maxPrefix} or smaller`
      });
    }
  }

  // Validate IP address octets
  const octets = ip.split('.').map(octet => parseInt(octet, 10));
  const invalidOctets = octets.filter((octet, index) => {
    if (octet < 0 || octet > 255) return true;
    return false;
  });

  if (invalidOctets.length > 0) {
    errors.push({
      field: 'cidrBlock',
      value,
      message: 'Invalid IP address octets. Each octet must be between 0 and 255',
      code: 'INVALID_IP_OCTETS',
      severity: 'error',
      location
    });
  }

  // Check if it's a valid network address
  if (errors.length === 0) {
    const networkValid = isValidNetworkAddress(octets, prefix);
    if (!networkValid.isValid) {
      warnings.push({
        field: 'cidrBlock',
        value,
        message: `CIDR block is not a network address. Should be ${networkValid.correctNetwork}`,
        code: 'INVALID_NETWORK_ADDRESS',
        suggestion: `Use ${networkValid.correctNetwork} for proper network addressing`
      });
    }
  }

  // Check for private vs public ranges
  if (errors.length === 0 && allowPrivateOnly) {
    const isPrivate = isPrivateIPRange(octets);
    if (!isPrivate) {
      errors.push({
        field: 'cidrBlock',
        value,
        message: 'Only private IP ranges are allowed (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)',
        code: 'PUBLIC_IP_NOT_ALLOWED',
        severity: 'error',
        location
      });
    }
  }

  // Check for reserved ranges
  if (errors.length === 0) {
    const reservedCheck = checkReservedRanges(octets);
    if (reservedCheck.isReserved) {
      warnings.push({
        field: 'cidrBlock',
        value,
        message: `CIDR block falls within reserved range: ${reservedCheck.description}`,
        code: 'RESERVED_IP_RANGE',
        suggestion: 'Consider using a non-reserved IP range'
      });
    }
  }

  return createValidationResult(errors, warnings);
}

/**
 * Validate IPv4 address format
 */
export function validateIpv4Address(
  value: string,
  location?: ValidationLocation
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!value || typeof value !== 'string') {
    errors.push({
      field: 'ipAddress',
      value,
      message: 'IP address must be a non-empty string',
      code: 'INVALID_IP_ADDRESS',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  const ipv4Regex = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
  if (!ipv4Regex.test(value)) {
    errors.push({
      field: 'ipAddress',
      value,
      message: 'Invalid IPv4 address format',
      code: 'INVALID_IPV4_FORMAT',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  const octets = value.split('.').map(octet => parseInt(octet, 10));
  const invalidOctets = octets.filter(octet => octet < 0 || octet > 255);

  if (invalidOctets.length > 0) {
    errors.push({
      field: 'ipAddress',
      value,
      message: 'Invalid IP address octets. Each octet must be between 0 and 255',
      code: 'INVALID_IPV4_OCTETS',
      severity: 'error',
      location
    });
  }

  // Check for special addresses
  if (errors.length === 0) {
    const specialAddressCheck = checkSpecialIPAddresses(octets);
    if (specialAddressCheck.isSpecial) {
      warnings.push({
        field: 'ipAddress',
        value,
        message: `IP address is a special address: ${specialAddressCheck.description}`,
        code: 'SPECIAL_IP_ADDRESS',
        suggestion: specialAddressCheck.suggestion || 'Consider using a different IP address'
      });
    }
  }

  return createValidationResult(errors, warnings);
}

/**
 * Validate IPv6 CIDR block
 */
export function validateIpv6CidrBlock(
  value: string,
  location?: ValidationLocation
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!value || typeof value !== 'string') {
    errors.push({
      field: 'ipv6CidrBlock',
      value,
      message: 'IPv6 CIDR block must be a non-empty string',
      code: 'INVALID_IPV6_CIDR_BLOCK',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  // Basic IPv6 CIDR format check
  const ipv6CidrRegex = /^([0-9a-fA-F:]+)\/([0-9]{1,3})$/;
  const match = value.match(ipv6CidrRegex);

  if (!match) {
    errors.push({
      field: 'ipv6CidrBlock',
      value,
      message: 'Invalid IPv6 CIDR block format',
      code: 'INVALID_IPV6_CIDR_FORMAT',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  const [, ipv6, prefixStr] = match;
  const prefix = parseInt(prefixStr, 10);

  // Validate prefix
  if (prefix < 0 || prefix > 128) {
    errors.push({
      field: 'ipv6CidrBlock',
      value,
      message: 'IPv6 CIDR prefix must be between 0 and 128',
      code: 'INVALID_IPV6_PREFIX',
      severity: 'error',
      location
    });
  }

  // Basic IPv6 address validation
  const ipv6Valid = isValidIPv6Address(ipv6);
  if (!ipv6Valid) {
    errors.push({
      field: 'ipv6CidrBlock',
      value,
      message: 'Invalid IPv6 address format',
      code: 'INVALID_IPV6_ADDRESS',
      severity: 'error',
      location
    });
  }

  return createValidationResult(errors, warnings);
}

/**
 * Validate AWS region
 */
export function validateAwsRegion(
  value: string,
  location?: ValidationLocation
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!value || typeof value !== 'string') {
    errors.push({
      field: 'awsRegion',
      value,
      message: 'AWS region must be a non-empty string',
      code: 'INVALID_AWS_REGION',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  const regionPattern = AWS_PATTERNS.REGION;
  if (!regionPattern.test(value)) {
    errors.push({
      field: 'awsRegion',
      value,
      message: 'Invalid AWS region format. Expected format: xx-xxxxx-x',
      code: 'INVALID_AWS_REGION_FORMAT',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  if (!AWS_REGIONS.has(value)) {
    warnings.push({
      field: 'awsRegion',
      value,
      message: 'AWS region is not in the list of known regions',
      code: 'UNKNOWN_AWS_REGION',
      suggestion: 'Verify that this is a valid and active AWS region'
    });
  }

  return createValidationResult(errors, warnings);
}

/**
 * Validate AWS availability zone
 */
export function validateAvailabilityZone(
  value: string,
  region?: string,
  location?: ValidationLocation
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!value || typeof value !== 'string') {
    errors.push({
      field: 'availabilityZone',
      value,
      message: 'Availability zone must be a non-empty string',
      code: 'INVALID_AVAILABILITY_ZONE',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  const azPattern = AWS_PATTERNS.AVAILABILITY_ZONE;
  if (!azPattern.test(value)) {
    errors.push({
      field: 'availabilityZone',
      value,
      message: 'Invalid availability zone format. Expected format: xx-xxxxx-xa',
      code: 'INVALID_AZ_FORMAT',
      severity: 'error',
      location
    });
    return createValidationResult(errors, warnings);
  }

  // Check if AZ matches the provided region
  if (region && errors.length === 0) {
    const azRegion = value.slice(0, -1); // Remove the letter suffix
    if (azRegion !== region) {
      errors.push({
        field: 'availabilityZone',
        value,
        message: `Availability zone ${value} does not belong to region ${region}`,
        code: 'AZ_REGION_MISMATCH',
        severity: 'error',
        location
      });
    }
  }

  return createValidationResult(errors, warnings);
}

// Helper functions

function isValidNetworkAddress(octets: number[], prefix: number): { isValid: boolean; correctNetwork?: string } {
  if (prefix >= 32) return { isValid: true };

  const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const address = (octets[0] << 24 | octets[1] << 16 | octets[2] << 8 | octets[3]) >>> 0;
  const network = (address & mask) >>> 0;

  if (address !== network) {
    const correctOctets = [
      (network >>> 24) & 0xFF,
      (network >>> 16) & 0xFF,
      (network >>> 8) & 0xFF,
      network & 0xFF
    ];
    return {
      isValid: false,
      correctNetwork: `${correctOctets.join('.')}/${prefix}`
    };
  }

  return { isValid: true };
}

function isPrivateIPRange(octets: number[]): boolean {
  const [a, b] = octets;
  
  // 10.0.0.0/8
  if (a === 10) return true;
  
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  
  return false;
}

function checkReservedRanges(octets: number[]): { isReserved: boolean; description?: string } {
  const [a, b, c, d] = octets;

  // Loopback
  if (a === 127) return { isReserved: true, description: 'Loopback range (127.0.0.0/8)' };
  
  // Link-local
  if (a === 169 && b === 254) return { isReserved: true, description: 'Link-local range (169.254.0.0/16)' };
  
  // Multicast
  if (a >= 224 && a <= 239) return { isReserved: true, description: 'Multicast range (224.0.0.0/4)' };
  
  // Reserved
  if (a >= 240) return { isReserved: true, description: 'Reserved range (240.0.0.0/4)' };

  return { isReserved: false };
}

function checkSpecialIPAddresses(octets: number[]): { isSpecial: boolean; description?: string; suggestion?: string } {
  const [a, b, c, d] = octets;

  // Network address (ends with .0)
  if (d === 0) {
    return {
      isSpecial: true,
      description: 'Network address (ends with .0)',
      suggestion: 'Network addresses are typically not assigned to hosts'
    };
  }

  // Broadcast address (ends with .255 in /24)
  if (d === 255) {
    return {
      isSpecial: true,
      description: 'Potential broadcast address (ends with .255)',
      suggestion: 'Verify if this is intended as a broadcast address'
    };
  }

  // Default gateway (often ends with .1)
  if (d === 1) {
    return {
      isSpecial: true,
      description: 'Common gateway address (ends with .1)',
      suggestion: 'This is commonly used for gateway addresses'
    };
  }

  return { isSpecial: false };
}

function isValidIPv6Address(value: string): boolean {
  // Simplified IPv6 validation
  const ipv6Patterns = [
    /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,  // Full format
    /^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/,  // Compressed format
    /^::$/,  // All zeros
    /^::1$/,  // Loopback
  ];

  return ipv6Patterns.some(pattern => pattern.test(value));
}

function createValidationResult(errors: ValidationError[], warnings: ValidationWarning[]): ValidationResult {
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