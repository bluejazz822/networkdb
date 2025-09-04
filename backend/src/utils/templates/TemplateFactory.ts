/**
 * Template Factory
 * Creates appropriate template generators and manages template configurations
 */

import { TemplateConfig, TemplateGenerationOptions, TemplateGenerationResult, NETWORK_FIELD_DEFINITIONS } from './types';
import { FileFormat, FieldDefinition } from '../file-processors/types';
import { BaseTemplateGenerator } from './BaseTemplateGenerator';
import { CsvTemplateGenerator } from './CsvTemplateGenerator';
import { ExcelTemplateGenerator } from './ExcelTemplateGenerator';
import { JsonTemplateGenerator } from './JsonTemplateGenerator';

export class TemplateFactory {
  private static templateConfigs: Map<string, TemplateConfig> = new Map();

  /**
   * Initialize default template configurations
   */
  static initialize(): void {
    // VPC Template
    this.registerTemplate({
      resourceType: 'vpc',
      fields: NETWORK_FIELD_DEFINITIONS.vpc,
      metadata: {
        name: 'VPC Import/Export Template',
        description: 'Template for importing and exporting VPC configurations',
        version: '1.0.0',
        createdAt: new Date(),
        tags: ['network', 'vpc', 'aws'],
        category: 'network'
      },
      validation: {
        required: ['vpcId', 'cidrBlock', 'region'],
        unique: ['vpcId'],
        relationships: [
          {
            field: 'state',
            dependsOn: 'vpcId',
            condition: 'required_if'
          }
        ]
      }
    });

    // Transit Gateway Template
    this.registerTemplate({
      resourceType: 'transitGateway',
      fields: NETWORK_FIELD_DEFINITIONS.transitGateway,
      metadata: {
        name: 'Transit Gateway Import/Export Template',
        description: 'Template for importing and exporting Transit Gateway configurations',
        version: '1.0.0',
        createdAt: new Date(),
        tags: ['network', 'transit-gateway', 'aws'],
        category: 'network'
      },
      validation: {
        required: ['transitGatewayId'],
        unique: ['transitGatewayId']
      }
    });

    // Customer Gateway Template
    this.registerTemplate({
      resourceType: 'customerGateway',
      fields: NETWORK_FIELD_DEFINITIONS.customerGateway,
      metadata: {
        name: 'Customer Gateway Import/Export Template',
        description: 'Template for importing and exporting Customer Gateway configurations',
        version: '1.0.0',
        createdAt: new Date(),
        tags: ['network', 'customer-gateway', 'vpn', 'aws'],
        category: 'network'
      },
      validation: {
        required: ['customerGatewayId', 'type', 'ipAddress', 'bgpAsn'],
        unique: ['customerGatewayId', 'ipAddress']
      }
    });

    // VPC Endpoint Template
    this.registerTemplate({
      resourceType: 'vpcEndpoint',
      fields: NETWORK_FIELD_DEFINITIONS.vpcEndpoint,
      metadata: {
        name: 'VPC Endpoint Import/Export Template',
        description: 'Template for importing and exporting VPC Endpoint configurations',
        version: '1.0.0',
        createdAt: new Date(),
        tags: ['network', 'vpc-endpoint', 'aws'],
        category: 'network'
      },
      validation: {
        required: ['vpcEndpointId', 'vpcId', 'serviceName', 'endpointType'],
        unique: ['vpcEndpointId'],
        relationships: [
          {
            field: 'serviceName',
            dependsOn: 'endpointType',
            condition: 'required_if'
          }
        ]
      }
    });
  }

  /**
   * Register a new template configuration
   */
  static registerTemplate(config: TemplateConfig): void {
    this.templateConfigs.set(config.resourceType, config);
  }

  /**
   * Get template configuration by resource type
   */
  static getTemplateConfig(resourceType: string): TemplateConfig | null {
    return this.templateConfigs.get(resourceType) || null;
  }

  /**
   * Get all available template configurations
   */
  static getAllTemplateConfigs(): TemplateConfig[] {
    return Array.from(this.templateConfigs.values());
  }

  /**
   * Create template generator for the specified format
   */
  static createGenerator(
    resourceType: string,
    format: FileFormat,
    customConfig?: Partial<TemplateConfig>
  ): BaseTemplateGenerator {
    let config = this.getTemplateConfig(resourceType);
    
    if (!config) {
      throw new Error(`No template configuration found for resource type: ${resourceType}`);
    }

    // Merge custom configuration if provided
    if (customConfig) {
      config = {
        ...config,
        ...customConfig,
        fields: customConfig.fields || config.fields,
        metadata: { ...config.metadata, ...customConfig.metadata },
        validation: { ...config.validation, ...customConfig.validation }
      };
    }

    switch (format) {
      case FileFormat.CSV:
        return new CsvTemplateGenerator(config);
      case FileFormat.EXCEL:
        return new ExcelTemplateGenerator(config);
      case FileFormat.JSON:
        return new JsonTemplateGenerator(config);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate template for resource type and format
   */
  static async generateTemplate(
    resourceType: string,
    format: FileFormat,
    options: TemplateGenerationOptions,
    customConfig?: Partial<TemplateConfig>
  ): Promise<TemplateGenerationResult> {
    const generator = this.createGenerator(resourceType, format, customConfig);
    return await generator.generateTemplate(format, options);
  }

  /**
   * Create custom template configuration
   */
  static createCustomTemplate(
    resourceType: string,
    fields: FieldDefinition[],
    metadata: {
      name: string;
      description: string;
      version?: string;
      author?: string;
      tags?: string[];
      category?: 'network' | 'infrastructure' | 'security' | 'other';
    }
  ): TemplateConfig {
    return {
      resourceType,
      fields,
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        category: 'other',
        ...metadata
      }
    };
  }

  /**
   * Validate template configuration
   */
  static validateTemplateConfig(config: TemplateConfig): string[] {
    const errors: string[] = [];

    if (!config.resourceType || config.resourceType.trim() === '') {
      errors.push('Resource type is required');
    }

    if (!config.fields || config.fields.length === 0) {
      errors.push('At least one field is required');
    }

    if (!config.metadata) {
      errors.push('Template metadata is required');
    } else {
      if (!config.metadata.name || config.metadata.name.trim() === '') {
        errors.push('Template name is required');
      }
      
      if (!config.metadata.description || config.metadata.description.trim() === '') {
        errors.push('Template description is required');
      }
    }

    // Validate field definitions
    config.fields?.forEach((field, index) => {
      if (!field.name || field.name.trim() === '') {
        errors.push(`Field ${index + 1}: name is required`);
      }
      
      if (!field.type) {
        errors.push(`Field ${index + 1}: type is required`);
      }
    });

    // Check for duplicate field names
    if (config.fields) {
      const fieldNames = config.fields.map(f => f.name);
      const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
      
      if (duplicates.length > 0) {
        errors.push(`Duplicate field names found: ${duplicates.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Get template statistics
   */
  static getTemplateStats(resourceType: string): any {
    const config = this.getTemplateConfig(resourceType);
    
    if (!config) {
      return null;
    }

    return {
      resourceType: config.resourceType,
      fieldCount: config.fields.length,
      requiredFields: config.fields.filter(f => f.required).length,
      optionalFields: config.fields.filter(f => !f.required).length,
      validationRules: {
        hasPatterns: config.fields.some(f => f.validation?.pattern),
        hasEnums: config.fields.some(f => f.validation?.enum),
        hasRanges: config.fields.some(f => f.validation?.min !== undefined || f.validation?.max !== undefined)
      },
      metadata: {
        version: config.metadata.version,
        category: config.metadata.category,
        tags: config.metadata.tags || []
      }
    };
  }

  /**
   * Export template configuration as JSON
   */
  static exportTemplateConfig(resourceType: string): string | null {
    const config = this.getTemplateConfig(resourceType);
    
    if (!config) {
      return null;
    }

    return JSON.stringify(config, null, 2);
  }

  /**
   * Import template configuration from JSON
   */
  static importTemplateConfig(jsonString: string): void {
    try {
      const config: TemplateConfig = JSON.parse(jsonString);
      
      // Validate configuration
      const errors = this.validateTemplateConfig(config);
      
      if (errors.length > 0) {
        throw new Error(`Invalid template configuration: ${errors.join(', ')}`);
      }

      // Convert date strings back to Date objects
      if (typeof config.metadata.createdAt === 'string') {
        config.metadata.createdAt = new Date(config.metadata.createdAt);
      }

      this.registerTemplate(config);
      
    } catch (error) {
      throw new Error(`Failed to import template configuration: ${error.message}`);
    }
  }
}

// Initialize default templates
TemplateFactory.initialize();