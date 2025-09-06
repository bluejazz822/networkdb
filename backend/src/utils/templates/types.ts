/**
 * Template Generation Types for Network CMDB
 * Defines interfaces and types for dynamic template generation
 */

import { FileFormat, FieldDefinition } from '../file-processors/types';

// Template configuration for resource types
export interface TemplateConfig {
  resourceType: string;
  fields: FieldDefinition[];
  metadata: TemplateMetadata;
  validation?: ValidationRules;
}

// Template metadata
export interface TemplateMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  createdAt: Date;
  tags?: string[];
  category: 'network' | 'infrastructure' | 'security' | 'other';
}

// Validation rules for templates
export interface ValidationRules {
  required: string[];
  unique?: string[];
  relationships?: FieldRelationship[];
  customValidators?: CustomValidator[];
}

// Field relationship for cross-field validation
export interface FieldRelationship {
  field: string;
  dependsOn: string;
  condition: 'required_if' | 'exists_if' | 'equals_if';
  value?: any;
}

// Custom validator function
export interface CustomValidator {
  field: string;
  validator: (value: any, record: any) => ValidationResult;
  message: string;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

// Template generation options
export interface TemplateGenerationOptions {
  format: FileFormat;
  includeSampleData: boolean;
  includeDescriptions: boolean;
  includeValidation: boolean;
  maxSampleRecords?: number;
  customHeaders?: Record<string, string>;
  fieldOrder?: string[];
}

// Template generation result
export interface TemplateGenerationResult {
  success: boolean;
  buffer: Buffer;
  metadata: {
    format: FileFormat;
    recordCount: number;
    fieldCount: number;
    size: number;
    generatedAt: Date;
  };
  errors?: string[];
}

// Sample data generator configuration
export interface SampleDataConfig {
  seed?: number;
  locale?: string;
  realistic?: boolean;
  patterns?: Record<string, any>;
}

// Template registry entry
export interface TemplateRegistryEntry {
  id: string;
  config: TemplateConfig;
  lastUsed: Date;
  usageCount: number;
  isSystem: boolean;
}

// Network resource specific field definitions
export const NETWORK_FIELD_DEFINITIONS = {
  vpc: [
    {
      name: 'vpcId',
      type: 'string' as const,
      required: true,
      description: 'VPC unique identifier (vpc-xxxxxxxxx)',
      example: 'vpc-12345678',
      validation: { pattern: '^vpc-[0-9a-f]{8,17}$' }
    },
    {
      name: 'cidrBlock',
      type: 'string' as const,
      required: true,
      description: 'VPC CIDR block (e.g., 10.0.0.0/16)',
      example: '10.0.0.0/16',
      validation: { pattern: '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/\\d{1,2}$' }
    },
    {
      name: 'name',
      type: 'string' as const,
      required: false,
      description: 'Human-readable name for the VPC',
      example: 'Production VPC'
    },
    {
      name: 'region',
      type: 'string' as const,
      required: true,
      description: 'AWS region where VPC is located',
      example: 'us-east-1',
      validation: { pattern: '^[a-z]{2}-[a-z]+-\\d{1}$' }
    },
    {
      name: 'state',
      type: 'string' as const,
      required: false,
      description: 'Current state of the VPC',
      example: 'available',
      validation: { enum: ['pending', 'available'] }
    },
    {
      name: 'tags',
      type: 'string' as const,
      required: false,
      description: 'Comma-separated list of tags (key=value)',
      example: 'Environment=Production,Owner=NetworkTeam'
    }
  ],
  transitGateway: [
    {
      name: 'transitGatewayId',
      type: 'string' as const,
      required: true,
      description: 'Transit Gateway unique identifier',
      example: 'tgw-12345678',
      validation: { pattern: '^tgw-[0-9a-f]{8,17}$' }
    },
    {
      name: 'amazonSideAsn',
      type: 'number' as const,
      required: false,
      description: 'Amazon side ASN for BGP',
      example: 64512,
      validation: { min: 64512, max: 65534 }
    },
    {
      name: 'description',
      type: 'string' as const,
      required: false,
      description: 'Description of the Transit Gateway',
      example: 'Main corporate transit gateway'
    },
    {
      name: 'state',
      type: 'string' as const,
      required: false,
      description: 'Current state of the Transit Gateway',
      example: 'available',
      validation: { enum: ['pending', 'available', 'modifying', 'deleting', 'deleted'] }
    }
  ],
  customerGateway: [
    {
      name: 'customerGatewayId',
      type: 'string' as const,
      required: true,
      description: 'Customer Gateway unique identifier',
      example: 'cgw-12345678',
      validation: { pattern: '^cgw-[0-9a-f]{8,17}$' }
    },
    {
      name: 'type',
      type: 'string' as const,
      required: true,
      description: 'Type of VPN connection',
      example: 'ipsec.1',
      validation: { enum: ['ipsec.1'] }
    },
    {
      name: 'ipAddress',
      type: 'ip' as const,
      required: true,
      description: 'Public IP address of customer gateway',
      example: '203.0.113.12'
    },
    {
      name: 'bgpAsn',
      type: 'number' as const,
      required: true,
      description: 'Customer BGP ASN',
      example: 65000,
      validation: { min: 1, max: 4294967294 }
    }
  ],
  vpcEndpoint: [
    {
      name: 'vpcEndpointId',
      type: 'string' as const,
      required: true,
      description: 'VPC Endpoint unique identifier',
      example: 'vpce-12345678',
      validation: { pattern: '^vpce-[0-9a-f]{8,17}$' }
    },
    {
      name: 'vpcId',
      type: 'string' as const,
      required: true,
      description: 'Associated VPC ID',
      example: 'vpc-12345678',
      validation: { pattern: '^vpc-[0-9a-f]{8,17}$' }
    },
    {
      name: 'serviceName',
      type: 'string' as const,
      required: true,
      description: 'AWS service name for the endpoint',
      example: 'com.amazonaws.us-east-1.s3'
    },
    {
      name: 'endpointType',
      type: 'string' as const,
      required: true,
      description: 'Type of VPC endpoint',
      example: 'Gateway',
      validation: { enum: ['Interface', 'Gateway', 'GatewayLoadBalancer'] }
    }
  ]
} as const;