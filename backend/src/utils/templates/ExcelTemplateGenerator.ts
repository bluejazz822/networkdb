/**
 * Excel Template Generator
 * Generates Excel templates with headers, sample data, validation, and formatting
 */

import * as XLSX from 'xlsx';
import { BaseTemplateGenerator } from './BaseTemplateGenerator';
import { TemplateGenerationOptions, TemplateGenerationResult } from './types';
import { FileFormat } from '../file-processors/types';

export class ExcelTemplateGenerator extends BaseTemplateGenerator {
  /**
   * Generate Excel template
   */
  async generateTemplate(
    format: FileFormat,
    options: TemplateGenerationOptions
  ): Promise<TemplateGenerationResult> {
    this.validateConfig();
    
    if (format !== FileFormat.EXCEL) {
      throw new Error(`Excel generator cannot handle format: ${format}`);
    }

    try {
      const workbook = XLSX.utils.book_new();
      
      // Create main data sheet
      this.createDataSheet(workbook, options);
      
      // Create documentation sheet if descriptions are included
      if (options.includeDescriptions) {
        this.createDocumentationSheet(workbook);
      }
      
      // Create validation sheet if validation is included
      if (options.includeValidation) {
        this.createValidationSheet(workbook);
      }
      
      // Generate buffer
      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
        bookSST: false
      });
      
      return {
        success: true,
        buffer: Buffer.from(buffer),
        metadata: {
          format: FileFormat.EXCEL,
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
          format: FileFormat.EXCEL,
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
   * Create main data sheet
   */
  private createDataSheet(workbook: XLSX.WorkBook, options: TemplateGenerationOptions): void {
    const orderedFields = this.getOrderedFieldNames(options.fieldOrder);
    const sheetData: any[][] = [];
    
    // Create headers
    const headers = orderedFields.map(fieldName => {
      const field = this.config.fields.find(f => f.name === fieldName);
      let header = fieldName;
      
      if (field?.required) {
        header += ' *';
      }
      
      return header;
    });
    
    sheetData.push(headers);
    
    // Add sample data if requested
    if (options.includeSampleData) {
      const sampleCount = options.maxSampleRecords || 5;
      const sampleRecords = this.generateSampleRecords(sampleCount);
      
      sampleRecords.forEach(record => {
        const row = orderedFields.map(fieldName => record[fieldName] || '');
        sheetData.push(row);
      });
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Apply formatting
    this.applyWorksheetFormatting(worksheet, orderedFields, options);
    
    // Set column widths
    this.setColumnWidths(worksheet, orderedFields);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  }

  /**
   * Create documentation sheet
   */
  private createDocumentationSheet(workbook: XLSX.WorkBook): void {
    const docData: any[][] = [];
    
    // Template information
    docData.push(['Template Information']);
    docData.push(['Name', this.config.metadata.name]);
    docData.push(['Description', this.config.metadata.description]);
    docData.push(['Version', this.config.metadata.version]);
    docData.push(['Generated', new Date().toISOString()]);
    docData.push(['Resource Type', this.config.resourceType]);
    docData.push([]);
    
    // Field documentation
    docData.push(['Field Documentation']);
    docData.push(['Field Name', 'Type', 'Required', 'Description', 'Example', 'Validation']);
    
    this.config.fields.forEach(field => {
      const validation = this.formatValidationRules(field);
      
      docData.push([
        field.name,
        field.type,
        field.required ? 'Yes' : 'No',
        field.description || '',
        field.example || '',
        validation
      ]);
    });
    
    const worksheet = XLSX.utils.aoa_to_sheet(docData);
    
    // Apply documentation formatting
    this.applyDocumentationFormatting(worksheet);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Documentation');
  }

  /**
   * Create validation sheet with lookup tables
   */
  private createValidationSheet(workbook: XLSX.WorkBook): void {
    const validationData: any[][] = [];
    
    validationData.push(['Validation Rules and Lookup Tables']);
    validationData.push([]);
    
    // Create lookup tables for enum fields
    this.config.fields.forEach(field => {
      if (field.validation?.enum) {
        validationData.push([`${field.name} - Allowed Values`]);
        field.validation.enum.forEach(value => {
          validationData.push([value]);
        });
        validationData.push([]);
      }
    });
    
    // Add validation patterns
    validationData.push(['Pattern Validation']);
    validationData.push(['Field', 'Pattern', 'Description']);
    
    this.config.fields.forEach(field => {
      if (field.validation?.pattern) {
        validationData.push([
          field.name,
          field.validation.pattern,
          this.getPatternDescription(field.validation.pattern)
        ]);
      }
    });
    
    if (validationData.length > 2) {
      const worksheet = XLSX.utils.aoa_to_sheet(validationData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Validation');
    }
  }

  /**
   * Apply worksheet formatting
   */
  private applyWorksheetFormatting(
    worksheet: XLSX.WorkSheet,
    orderedFields: string[],
    options: TemplateGenerationOptions
  ): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Format header row
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      
      const field = this.config.fields.find(f => f.name === orderedFields[col]);
      
      // Set cell style for headers
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: '000000' } },
        fill: { fgColor: { rgb: field?.required ? 'FFE6E6' : 'E6F3FF' } },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      // Add comments for field descriptions
      if (field?.description && options.includeDescriptions) {
        worksheet[cellAddress].c = [{
          t: field.description + (field.example ? `\n\nExample: ${field.example}` : ''),
          a: 'Template Generator'
        }];
      }
    }
    
    // Apply data validation for enum fields
    if (options.includeValidation) {
      this.applyDataValidation(worksheet, orderedFields);
    }
  }

  /**
   * Apply data validation to fields with enum values
   */
  private applyDataValidation(worksheet: XLSX.WorkSheet, orderedFields: string[]): void {
    orderedFields.forEach((fieldName, colIndex) => {
      const field = this.config.fields.find(f => f.name === fieldName);
      
      if (field?.validation?.enum) {
        const column = XLSX.utils.encode_col(colIndex);
        const validation = {
          type: 'list',
          allowBlank: !field.required,
          showInputMessage: true,
          inputTitle: `${field.name} Values`,
          inputMessage: `Select from: ${field.validation.enum.join(', ')}`,
          showErrorMessage: true,
          errorTitle: 'Invalid Value',
          errorMessage: `Value must be one of: ${field.validation.enum.join(', ')}`,
          formula1: `"${field.validation.enum.join(',')}"`
        };
        
        // Apply validation to data rows (rows 2+)
        const range = `${column}2:${column}1000`;
        worksheet['!dataValidation'] = worksheet['!dataValidation'] || {};
        worksheet['!dataValidation'][range] = validation;
      }
    });
  }

  /**
   * Set column widths based on content
   */
  private setColumnWidths(worksheet: XLSX.WorkSheet, orderedFields: string[]): void {
    const colWidths = orderedFields.map(fieldName => {
      const field = this.config.fields.find(f => f.name === fieldName);
      let width = fieldName.length;
      
      if (field?.description && field.description.length > width) {
        width = Math.min(field.description.length, 50);
      }
      
      if (field?.example && String(field.example).length > width) {
        width = Math.min(String(field.example).length, 50);
      }
      
      return { wch: Math.max(width + 2, 12) };
    });
    
    worksheet['!cols'] = colWidths;
  }

  /**
   * Apply documentation sheet formatting
   */
  private applyDocumentationFormatting(worksheet: XLSX.WorkSheet): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Format headers
    for (let row = 0; row <= range.e.r; row++) {
      for (let col = 0; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) continue;
        
        const cellValue = worksheet[cellAddress].v;
        
        // Style section headers
        if (cellValue === 'Template Information' || 
            cellValue === 'Field Documentation' ||
            cellValue === 'Field Name') {
          worksheet[cellAddress].s = {
            font: { bold: true, size: 12 },
            fill: { fgColor: { rgb: 'D9EAD3' } }
          };
        }
      }
    }
  }

  /**
   * Format validation rules for display
   */
  private formatValidationRules(field: any): string {
    const rules: string[] = [];
    
    if (field.validation) {
      if (field.validation.pattern) {
        rules.push(`Pattern: ${field.validation.pattern}`);
      }
      
      if (field.validation.min !== undefined) {
        rules.push(`Min: ${field.validation.min}`);
      }
      
      if (field.validation.max !== undefined) {
        rules.push(`Max: ${field.validation.max}`);
      }
      
      if (field.validation.enum) {
        rules.push(`Values: ${field.validation.enum.join(', ')}`);
      }
    }
    
    return rules.join('; ');
  }

  /**
   * Get pattern description
   */
  private getPatternDescription(pattern: string): string {
    const descriptions: Record<string, string> = {
      '^vpc-[0-9a-f]{8,17}$': 'VPC ID format (vpc-xxxxxxxx)',
      '^tgw-[0-9a-f]{8,17}$': 'Transit Gateway ID format (tgw-xxxxxxxx)',
      '^cgw-[0-9a-f]{8,17}$': 'Customer Gateway ID format (cgw-xxxxxxxx)',
      '^vpce-[0-9a-f]{8,17}$': 'VPC Endpoint ID format (vpce-xxxxxxxx)',
      '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/\\d{1,2}$': 'CIDR block format (x.x.x.x/x)',
      '^[a-z]{2}-[a-z]+-\\d{1}$': 'AWS region format (us-east-1)'
    };
    
    return descriptions[pattern] || 'Custom pattern validation';
  }
}