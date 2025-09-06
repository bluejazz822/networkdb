/**
 * Base Template Generator
 * Abstract base class for all template generators
 */

import { Readable } from 'stream';
import { 
  TemplateConfig, 
  TemplateGenerationOptions, 
  TemplateGenerationResult,
  SampleDataConfig 
} from './types';
import { FileFormat, FieldDefinition } from '../file-processors/types';

export abstract class BaseTemplateGenerator {
  protected config: TemplateConfig;
  protected sampleDataConfig: SampleDataConfig;

  constructor(config: TemplateConfig, sampleDataConfig: SampleDataConfig = {}) {
    this.config = config;
    this.sampleDataConfig = {
      seed: 12345,
      locale: 'en',
      realistic: true,
      ...sampleDataConfig
    };
  }

  /**
   * Generate template buffer for the specified format
   */
  abstract generateTemplate(
    format: FileFormat,
    options: TemplateGenerationOptions
  ): Promise<TemplateGenerationResult>;

  /**
   * Generate sample data for a field
   */
  protected generateSampleValue(field: FieldDefinition, recordIndex: number = 0): any {
    const { type, example, validation } = field;

    // Use provided example if available
    if (example !== undefined) {
      return example;
    }

    // Use validation enum if available
    if (validation?.enum) {
      const enumIndex = recordIndex % validation.enum.length;
      return validation.enum[enumIndex];
    }

    // Generate based on field type
    switch (type) {
      case 'string':
        return this.generateStringValue(field, recordIndex);
      case 'number':
        return this.generateNumberValue(field, recordIndex);
      case 'boolean':
        return recordIndex % 2 === 0;
      case 'date':
        return this.generateDateValue(field, recordIndex);
      case 'email':
        return this.generateEmailValue(recordIndex);
      case 'ip':
        return this.generateIPValue(recordIndex);
      case 'mac':
        return this.generateMACValue(recordIndex);
      default:
        return this.generateStringValue(field, recordIndex);
    }
  }

  /**
   * Generate string values based on patterns and field names
   */
  private generateStringValue(field: FieldDefinition, recordIndex: number): string {
    const { name, validation } = field;
    
    // Handle specific patterns
    if (validation?.pattern) {
      return this.generateFromPattern(validation.pattern, recordIndex);
    }

    // Handle specific field names
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('id')) {
      return this.generateId(name, recordIndex);
    }
    
    if (lowerName.includes('name')) {
      return this.generateName(recordIndex);
    }
    
    if (lowerName.includes('description')) {
      return this.generateDescription(recordIndex);
    }
    
    if (lowerName.includes('region')) {
      return this.generateRegion(recordIndex);
    }
    
    if (lowerName.includes('state') || lowerName.includes('status')) {
      return this.generateState(recordIndex);
    }
    
    if (lowerName.includes('type')) {
      return this.generateType(name, recordIndex);
    }

    // Default string
    return `${name}-${recordIndex + 1}`;
  }

  /**
   * Generate number values
   */
  private generateNumberValue(field: FieldDefinition, recordIndex: number): number {
    const { validation } = field;
    const min = validation?.min ?? 1;
    const max = validation?.max ?? 1000;
    
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate date values
   */
  private generateDateValue(field: FieldDefinition, recordIndex: number): string {
    const now = new Date();
    const pastDays = Math.floor(Math.random() * 365);
    const date = new Date(now.getTime() - pastDays * 24 * 60 * 60 * 1000);
    return date.toISOString();
  }

  /**
   * Generate email values
   */
  private generateEmailValue(recordIndex: number): string {
    const domains = ['example.com', 'test.com', 'corp.local'];
    const domain = domains[recordIndex % domains.length];
    return `user${recordIndex + 1}@${domain}`;
  }

  /**
   * Generate IP address values
   */
  private generateIPValue(recordIndex: number): string {
    const base = 10;
    const subnet = (recordIndex % 254) + 1;
    const host = (recordIndex % 253) + 2;
    return `${base}.${subnet}.0.${host}`;
  }

  /**
   * Generate MAC address values
   */
  private generateMACValue(recordIndex: number): string {
    const hex = '0123456789abcdef';
    let mac = '00:50:56';
    
    for (let i = 0; i < 3; i++) {
      const octet = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      mac += ':' + octet;
    }
    
    return mac;
  }

  /**
   * Generate ID values based on patterns
   */
  private generateId(fieldName: string, recordIndex: number): string {
    const lowerName = fieldName.toLowerCase();
    
    if (lowerName.includes('vpc')) {
      return `vpc-${this.generateHex(8)}`;
    }
    
    if (lowerName.includes('tgw') || lowerName.includes('transit')) {
      return `tgw-${this.generateHex(8)}`;
    }
    
    if (lowerName.includes('cgw') || lowerName.includes('customer')) {
      return `cgw-${this.generateHex(8)}`;
    }
    
    if (lowerName.includes('vpce') || lowerName.includes('endpoint')) {
      return `vpce-${this.generateHex(8)}`;
    }
    
    return `id-${this.generateHex(8)}`;
  }

  /**
   * Generate hex strings
   */
  private generateHex(length: number): string {
    const hex = '0123456789abcdef';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += hex[Math.floor(Math.random() * hex.length)];
    }
    
    return result;
  }

  /**
   * Generate name values
   */
  private generateName(recordIndex: number): string {
    const prefixes = ['Production', 'Development', 'Staging', 'Test'];
    const suffixes = ['Main', 'Primary', 'Secondary', 'Backup'];
    
    const prefix = prefixes[recordIndex % prefixes.length];
    const suffix = suffixes[Math.floor(recordIndex / prefixes.length) % suffixes.length];
    
    return `${prefix} ${suffix}`;
  }

  /**
   * Generate description values
   */
  private generateDescription(recordIndex: number): string {
    const templates = [
      'Main network component for production workloads',
      'Development environment network resource',
      'Staging environment infrastructure component',
      'Test network setup for validation'
    ];
    
    return templates[recordIndex % templates.length];
  }

  /**
   * Generate region values
   */
  private generateRegion(recordIndex: number): string {
    const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
    return regions[recordIndex % regions.length];
  }

  /**
   * Generate state values
   */
  private generateState(recordIndex: number): string {
    const states = ['available', 'pending', 'active', 'inactive'];
    return states[recordIndex % states.length];
  }

  /**
   * Generate type values
   */
  private generateType(fieldName: string, recordIndex: number): string {
    const lowerName = fieldName.toLowerCase();
    
    if (lowerName.includes('device')) {
      const types = ['switch', 'router', 'firewall', 'server'];
      return types[recordIndex % types.length];
    }
    
    if (lowerName.includes('endpoint')) {
      const types = ['Interface', 'Gateway'];
      return types[recordIndex % types.length];
    }
    
    return `type-${recordIndex + 1}`;
  }

  /**
   * Generate value from regex pattern (simplified)
   */
  private generateFromPattern(pattern: string, recordIndex: number): string {
    // This is a simplified pattern matcher
    // In a real implementation, you might use a library like randexp
    
    if (pattern.includes('vpc-')) {
      return `vpc-${this.generateHex(8)}`;
    }
    
    if (pattern.includes('tgw-')) {
      return `tgw-${this.generateHex(8)}`;
    }
    
    if (pattern.includes('cgw-')) {
      return `cgw-${this.generateHex(8)}`;
    }
    
    if (pattern.includes('vpce-')) {
      return `vpce-${this.generateHex(8)}`;
    }
    
    // CIDR pattern
    if (pattern.includes('\\d{1,3}') && pattern.includes('/')) {
      return `10.${recordIndex % 255}.0.0/16`;
    }
    
    return `pattern-${recordIndex}`;
  }

  /**
   * Validate template configuration
   */
  protected validateConfig(): void {
    if (!this.config.resourceType) {
      throw new Error('Resource type is required in template config');
    }
    
    if (!this.config.fields || this.config.fields.length === 0) {
      throw new Error('At least one field is required in template config');
    }
    
    if (!this.config.metadata) {
      throw new Error('Template metadata is required');
    }
  }

  /**
   * Generate sample records
   */
  protected generateSampleRecords(count: number): any[] {
    const records: any[] = [];
    
    for (let i = 0; i < count; i++) {
      const record: any = {};
      
      this.config.fields.forEach(field => {
        record[field.name] = this.generateSampleValue(field, i);
      });
      
      records.push(record);
    }
    
    return records;
  }

  /**
   * Create field headers with descriptions
   */
  protected createFieldHeaders(): string[] {
    return this.config.fields.map(field => {
      let header = field.name;
      
      if (field.description) {
        header += ` (${field.description})`;
      }
      
      if (field.required) {
        header += ' *';
      }
      
      return header;
    });
  }

  /**
   * Get field names in specified order
   */
  protected getOrderedFieldNames(fieldOrder?: string[]): string[] {
    if (fieldOrder && fieldOrder.length > 0) {
      // Use specified order, adding any missing fields at the end
      const orderedFields = [...fieldOrder];
      const allFieldNames = this.config.fields.map(f => f.name);
      
      allFieldNames.forEach(name => {
        if (!orderedFields.includes(name)) {
          orderedFields.push(name);
        }
      });
      
      return orderedFields;
    }
    
    return this.config.fields.map(f => f.name);
  }
}