/**
 * CSV Template Generator
 * Generates CSV templates with headers, sample data, and validation comments
 */

import { stringify } from 'csv-stringify';
import { BaseTemplateGenerator } from './BaseTemplateGenerator';
import { TemplateGenerationOptions, TemplateGenerationResult } from './types';
import { FileFormat } from '../file-processors/types';

export class CsvTemplateGenerator extends BaseTemplateGenerator {
  /**
   * Generate CSV template
   */
  async generateTemplate(
    format: FileFormat,
    options: TemplateGenerationOptions
  ): Promise<TemplateGenerationResult> {
    this.validateConfig();
    
    if (format !== FileFormat.CSV) {
      throw new Error(`CSV generator cannot handle format: ${format}`);
    }

    try {
      const startTime = Date.now();
      const csvData: string[][] = [];
      
      // Add headers
      const headers = this.createHeaders(options);
      csvData.push(headers);
      
      // Add sample data if requested
      if (options.includeSampleData) {
        const sampleCount = options.maxSampleRecords || 5;
        const sampleRecords = this.generateSampleRecords(sampleCount);
        const orderedFields = this.getOrderedFieldNames(options.fieldOrder);
        
        sampleRecords.forEach(record => {
          const row = orderedFields.map(fieldName => {
            const value = record[fieldName];
            return value !== undefined && value !== null ? String(value) : '';
          });
          csvData.push(row);
        });
      }
      
      // Generate CSV string
      const csvString = await this.stringifyCSV(csvData, options);
      
      // Add comments if descriptions are included
      let finalContent = csvString;
      if (options.includeDescriptions) {
        const comments = this.createFieldComments();
        finalContent = comments + '\n' + csvString;
      }
      
      const buffer = Buffer.from(finalContent, 'utf-8');
      
      return {
        success: true,
        buffer,
        metadata: {
          format: FileFormat.CSV,
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
          format: FileFormat.CSV,
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
   * Create CSV headers
   */
  private createHeaders(options: TemplateGenerationOptions): string[] {
    const orderedFields = this.getOrderedFieldNames(options.fieldOrder);
    
    if (options.includeDescriptions) {
      return orderedFields.map(fieldName => {
        const field = this.config.fields.find(f => f.name === fieldName);
        if (!field) return fieldName;
        
        let header = fieldName;
        
        if (field.description) {
          header += ` (${field.description})`;
        }
        
        if (field.required) {
          header += ' *';
        }
        
        if (field.example !== undefined) {
          header += ` [Example: ${field.example}]`;
        }
        
        return header;
      });
    }
    
    return orderedFields;
  }

  /**
   * Create field comments for CSV header
   */
  private createFieldComments(): string {
    const comments: string[] = [];
    
    comments.push(`# ${this.config.metadata.name} - ${this.config.metadata.description}`);
    comments.push(`# Generated on: ${new Date().toISOString()}`);
    comments.push(`# Version: ${this.config.metadata.version}`);
    comments.push('#');
    comments.push('# Field Descriptions:');
    
    this.config.fields.forEach(field => {
      let comment = `# ${field.name}`;
      
      if (field.type) {
        comment += ` (${field.type})`;
      }
      
      if (field.required) {
        comment += ' - REQUIRED';
      }
      
      if (field.description) {
        comment += ` - ${field.description}`;
      }
      
      if (field.example !== undefined) {
        comment += ` [Example: ${field.example}]`;
      }
      
      if (field.validation) {
        const validationNotes: string[] = [];
        
        if (field.validation.pattern) {
          validationNotes.push(`Pattern: ${field.validation.pattern}`);
        }
        
        if (field.validation.min !== undefined) {
          validationNotes.push(`Min: ${field.validation.min}`);
        }
        
        if (field.validation.max !== undefined) {
          validationNotes.push(`Max: ${field.validation.max}`);
        }
        
        if (field.validation.enum) {
          validationNotes.push(`Allowed values: ${field.validation.enum.join(', ')}`);
        }
        
        if (validationNotes.length > 0) {
          comment += ` [${validationNotes.join(', ')}]`;
        }
      }
      
      comments.push(comment);
    });
    
    comments.push('#');
    
    return comments.join('\n');
  }

  /**
   * Convert data to CSV string
   */
  private stringifyCSV(data: string[][], options: TemplateGenerationOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const csvOptions = {
        header: false,
        delimiter: ',',
        quote: '"',
        escape: '"',
        record_delimiter: '\n'
      };
      
      stringify(data, csvOptions, (err, output) => {
        if (err) {
          reject(err);
        } else {
          resolve(output);
        }
      });
    });
  }
}