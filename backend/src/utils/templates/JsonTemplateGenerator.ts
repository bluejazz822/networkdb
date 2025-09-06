/**
 * JSON Template Generator
 * Generates JSON templates with schema, sample data, and validation information
 */

import { BaseTemplateGenerator } from './BaseTemplateGenerator';
import { TemplateGenerationOptions, TemplateGenerationResult } from './types';
import { FileFormat } from '../file-processors/types';

export class JsonTemplateGenerator extends BaseTemplateGenerator {
  /**
   * Generate JSON template
   */
  async generateTemplate(
    format: FileFormat,
    options: TemplateGenerationOptions
  ): Promise<TemplateGenerationResult> {
    this.validateConfig();
    
    if (format !== FileFormat.JSON) {
      throw new Error(`JSON generator cannot handle format: ${format}`);
    }

    try {
      const templateObject = this.createTemplateObject(options);
      const jsonString = JSON.stringify(templateObject, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');
      
      return {
        success: true,
        buffer,
        metadata: {
          format: FileFormat.JSON,
          recordCount: options.includeSampleData ? (options.maxSampleRecords || 5) : 0,
          fieldCount: this.config.fields.length,
          size: buffer.length,
          generatedAt: new Date()
        }
      };
      
    } catch (error) {
      return {
        success: false,
        buffer: Buffer.alloc(0),
        metadata: {
          format: FileFormat.JSON,
          recordCount: 0,
          fieldCount: 0,
          size: 0,
          generatedAt: new Date()
        },
        errors: [error.message]
      };
    }
  }

  /**
   * Create complete template object
   */
  private createTemplateObject(options: TemplateGenerationOptions): any {
    const template: any = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: this.config.metadata.name,
      description: this.config.metadata.description,
      version: this.config.metadata.version,
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          properties: {
            resourceType: {
              type: 'string',
              const: this.config.resourceType,
              description: 'Resource type for this data'
            },
            version: {
              type: 'string',
              const: this.config.metadata.version,
              description: 'Template version'
            },
            generatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when this data was generated'
            },
            totalRecords: {
              type: 'integer',
              minimum: 0,
              description: 'Total number of records in the data array'
            }
          },
          required: ['resourceType', 'version', 'generatedAt', 'totalRecords']
        },
        data: {
          type: 'array',
          items: this.createRecordSchema(),
          description: `Array of ${this.config.resourceType} records`
        }
      },
      required: ['metadata', 'data']
    };

    // Add documentation if requested
    if (options.includeDescriptions) {
      template.documentation = this.createDocumentation();
    }

    // Add validation schema if requested
    if (options.includeValidation) {
      template.validationRules = this.createValidationRules();
    }

    // Add sample data if requested
    if (options.includeSampleData) {
      template.sampleData = this.createSampleDataStructure(options);
    }

    return template;
  }

  /**
   * Create JSON schema for a single record
   */
  private createRecordSchema(): any {
    const schema: any = {
      type: 'object',
      properties: {},
      required: []
    };

    this.config.fields.forEach(field => {
      const fieldSchema = this.createFieldSchema(field);
      schema.properties[field.name] = fieldSchema;
      
      if (field.required) {
        schema.required.push(field.name);
      }
    });

    return schema;
  }

  /**
   * Create JSON schema for a single field
   */
  private createFieldSchema(field: any): any {
    const schema: any = {
      description: field.description || `${field.name} field`
    };

    // Set type
    switch (field.type) {
      case 'string':
        schema.type = 'string';
        break;
      case 'number':
        schema.type = 'number';
        break;
      case 'boolean':
        schema.type = 'boolean';
        break;
      case 'date':
        schema.type = 'string';
        schema.format = 'date-time';
        break;
      case 'email':
        schema.type = 'string';
        schema.format = 'email';
        break;
      case 'ip':
        schema.type = 'string';
        schema.format = 'ipv4';
        break;
      case 'mac':
        schema.type = 'string';
        schema.pattern = '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$';
        break;
      default:
        schema.type = 'string';
    }

    // Add validation rules
    if (field.validation) {
      if (field.validation.pattern) {
        schema.pattern = field.validation.pattern;
      }
      
      if (field.validation.min !== undefined) {
        if (field.type === 'string') {
          schema.minLength = field.validation.min;
        } else {
          schema.minimum = field.validation.min;
        }
      }
      
      if (field.validation.max !== undefined) {
        if (field.type === 'string') {
          schema.maxLength = field.validation.max;
        } else {
          schema.maximum = field.validation.max;
        }
      }
      
      if (field.validation.enum) {
        schema.enum = field.validation.enum;
      }
    }

    // Add example
    if (field.example !== undefined) {
      schema.examples = [field.example];
    }

    return schema;
  }

  /**
   * Create documentation section
   */
  private createDocumentation(): any {
    return {
      overview: {
        resourceType: this.config.resourceType,
        description: this.config.metadata.description,
        category: this.config.metadata.category,
        version: this.config.metadata.version
      },
      fields: this.config.fields.map(field => ({
        name: field.name,
        type: field.type,
        required: field.required,
        description: field.description,
        example: field.example,
        validation: field.validation
      })),
      usage: {
        description: 'This template can be used to import/export data for the network CMDB',
        notes: [
          'All required fields must be provided',
          'Field values must match the specified validation rules',
          'Use the sample data as a reference for correct formatting'
        ]
      }
    };
  }

  /**
   * Create validation rules section
   */
  private createValidationRules(): any {
    const rules: any = {
      fieldValidation: {},
      crossFieldValidation: [],
      businessRules: []
    };

    // Field-level validation
    this.config.fields.forEach(field => {
      if (field.validation) {
        rules.fieldValidation[field.name] = {
          type: field.type,
          required: field.required,
          ...field.validation
        };
      }
    });

    // Add cross-field validation if configured
    if (this.config.validation?.relationships) {
      rules.crossFieldValidation = this.config.validation.relationships;
    }

    // Add custom validation rules if configured
    if (this.config.validation?.customValidators) {
      rules.businessRules = this.config.validation.customValidators.map(validator => ({
        field: validator.field,
        message: validator.message,
        description: `Custom validation for ${validator.field}`
      }));
    }

    return rules;
  }

  /**
   * Create sample data structure
   */
  private createSampleDataStructure(options: TemplateGenerationOptions): any {
    const sampleCount = options.maxSampleRecords || 5;
    const sampleRecords = this.generateSampleRecords(sampleCount);
    
    return {
      metadata: {
        resourceType: this.config.resourceType,
        version: this.config.metadata.version,
        generatedAt: new Date().toISOString(),
        totalRecords: sampleRecords.length
      },
      data: sampleRecords
    };
  }
}