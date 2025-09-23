/**
 * Report Formatters
 * Factory pattern for multi-format output generators with streaming support
 * Integrates with ReportTemplateEngine and ExportServiceBase
 */

import { ExportFormat, ExportOptions, ExportResult } from '../../types/export';
import { ReportTemplateEngine, TemplateRenderResult } from '../ReportTemplateEngine';
import { PDFGenerator } from '../generators/PDFGenerator';
import { ExcelGenerator } from '../generators/ExcelGenerator';
import { CSVGenerator } from '../generators/CSVGenerator';
import { EventEmitter } from 'events';
import winston from 'winston';

// Logger for formatters
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'ReportFormatters' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Common interfaces for all format generators
export interface FormatGeneratorOptions {
  templateData: TemplateRenderResult;
  exportOptions: ExportOptions;
  customOptions?: Record<string, any>;
  streamingEnabled?: boolean;
  progressCallback?: (progress: number, message: string) => void;
}

export interface FormatGeneratorResult {
  success: boolean;
  buffer: Buffer;
  metadata: {
    format: ExportFormat;
    size: number;
    mimeType: string;
    encoding?: string;
    pages?: number;
    sheets?: number;
    records?: number;
    generatedAt: Date;
    processingTime: number;
  };
  error?: string;
}

export interface FormatGeneratorConfig {
  maxFileSize?: number;
  compressionLevel?: number;
  quality?: number;
  encoding?: string;
  memoryLimit?: number;
  streamingThreshold?: number;
}

// Base interface for format generators
export interface IFormatGenerator extends EventEmitter {
  readonly format: ExportFormat;
  readonly supportedMimeTypes: string[];
  readonly defaultConfig: FormatGeneratorConfig;

  generate(options: FormatGeneratorOptions): Promise<FormatGeneratorResult>;
  validateOptions(options: FormatGeneratorOptions): void;
  estimateOutputSize(recordCount: number, fieldCount: number): number;
  supportsStreaming(): boolean;
  getCompressionOptions(): Record<string, any>;
}

// JSON Generator (built-in)
export class JSONGenerator extends EventEmitter implements IFormatGenerator {
  readonly format = ExportFormat.JSON;
  readonly supportedMimeTypes = ['application/json', 'text/json'];
  readonly defaultConfig: FormatGeneratorConfig = {
    encoding: 'utf8',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    streamingThreshold: 10000,
    compressionLevel: 6
  };

  async generate(options: FormatGeneratorOptions): Promise<FormatGeneratorResult> {
    const startTime = Date.now();

    try {
      this.validateOptions(options);

      this.emit('generation:started', { format: this.format });

      // Extract data from template result
      const data = options.templateData.context.data || [];

      // Create JSON output with metadata if requested
      const output = options.exportOptions.includeMetadata ? {
        metadata: {
          generatedAt: new Date().toISOString(),
          recordCount: Array.isArray(data) ? data.length : 1,
          template: options.templateData.templateId,
          format: this.format,
          exportOptions: options.exportOptions
        },
        data: data
      } : data;

      const jsonString = JSON.stringify(output, null, 2);
      const buffer = Buffer.from(jsonString, this.defaultConfig.encoding as BufferEncoding);

      const processingTime = Date.now() - startTime;

      this.emit('generation:completed', {
        format: this.format,
        size: buffer.length,
        processingTime
      });

      return {
        success: true,
        buffer,
        metadata: {
          format: this.format,
          size: buffer.length,
          mimeType: this.supportedMimeTypes[0],
          encoding: this.defaultConfig.encoding,
          records: Array.isArray(data) ? data.length : 1,
          generatedAt: new Date(),
          processingTime
        }
      };
    } catch (error) {
      this.emit('generation:failed', { format: this.format, error });

      return {
        success: false,
        buffer: Buffer.from(''),
        metadata: {
          format: this.format,
          size: 0,
          mimeType: this.supportedMimeTypes[0],
          generatedAt: new Date(),
          processingTime: Date.now() - startTime
        },
        error: error.message
      };
    }
  }

  validateOptions(options: FormatGeneratorOptions): void {
    if (!options.templateData) {
      throw new Error('Template data is required for JSON generation');
    }

    if (!options.exportOptions) {
      throw new Error('Export options are required');
    }
  }

  estimateOutputSize(recordCount: number, fieldCount: number): number {
    // Rough estimate: JSON overhead + data size
    // Assuming average field size of 50 characters
    const avgRecordSize = fieldCount * 50 * 1.2; // 20% JSON overhead
    return Math.ceil(recordCount * avgRecordSize);
  }

  supportsStreaming(): boolean {
    return true;
  }

  getCompressionOptions(): Record<string, any> {
    return {
      level: this.defaultConfig.compressionLevel,
      algorithm: 'gzip'
    };
  }
}

// HTML Generator (built-in for template previews)
export class HTMLGenerator extends EventEmitter implements IFormatGenerator {
  readonly format = ExportFormat.PDF; // Use PDF format enum but generate HTML
  readonly supportedMimeTypes = ['text/html', 'application/xhtml+xml'];
  readonly defaultConfig: FormatGeneratorConfig = {
    encoding: 'utf8',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    streamingThreshold: 5000,
    compressionLevel: 6
  };

  async generate(options: FormatGeneratorOptions): Promise<FormatGeneratorResult> {
    const startTime = Date.now();

    try {
      this.validateOptions(options);

      this.emit('generation:started', { format: 'HTML' });

      // Use the rendered HTML from template engine
      let htmlContent = options.templateData.output;

      // Add metadata if requested
      if (options.exportOptions.includeMetadata) {
        const metadata = `
<!-- Export Metadata -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- Template: ${options.templateData.templateId} -->
<!-- Records: ${Array.isArray(options.templateData.context.data) ? options.templateData.context.data.length : 1} -->
<!-- Options: ${JSON.stringify(options.exportOptions)} -->
`;
        htmlContent = metadata + htmlContent;
      }

      const buffer = Buffer.from(htmlContent, this.defaultConfig.encoding as BufferEncoding);
      const processingTime = Date.now() - startTime;

      this.emit('generation:completed', {
        format: 'HTML',
        size: buffer.length,
        processingTime
      });

      return {
        success: true,
        buffer,
        metadata: {
          format: this.format,
          size: buffer.length,
          mimeType: this.supportedMimeTypes[0],
          encoding: this.defaultConfig.encoding,
          records: Array.isArray(options.templateData.context.data) ? options.templateData.context.data.length : 1,
          generatedAt: new Date(),
          processingTime
        }
      };
    } catch (error) {
      this.emit('generation:failed', { format: 'HTML', error });

      return {
        success: false,
        buffer: Buffer.from(''),
        metadata: {
          format: this.format,
          size: 0,
          mimeType: this.supportedMimeTypes[0],
          generatedAt: new Date(),
          processingTime: Date.now() - startTime
        },
        error: error.message
      };
    }
  }

  validateOptions(options: FormatGeneratorOptions): void {
    if (!options.templateData || !options.templateData.output) {
      throw new Error('Template data with HTML output is required');
    }

    if (!options.exportOptions) {
      throw new Error('Export options are required');
    }
  }

  estimateOutputSize(recordCount: number, fieldCount: number): number {
    // HTML has significant overhead due to markup
    const avgRecordSize = fieldCount * 80 * 1.5; // 50% HTML markup overhead
    return Math.ceil(recordCount * avgRecordSize);
  }

  supportsStreaming(): boolean {
    return false; // HTML templates are rendered as complete documents
  }

  getCompressionOptions(): Record<string, any> {
    return {
      level: this.defaultConfig.compressionLevel,
      algorithm: 'gzip'
    };
  }
}

// Format Generator Factory
export class ReportFormatterFactory {
  private static instance: ReportFormatterFactory;
  private generators = new Map<ExportFormat, IFormatGenerator>();
  private templateEngine: ReportTemplateEngine;

  constructor(templateEngine: ReportTemplateEngine) {
    this.templateEngine = templateEngine;
    this.initializeBuiltinGenerators();
  }

  static getInstance(templateEngine: ReportTemplateEngine): ReportFormatterFactory {
    if (!ReportFormatterFactory.instance) {
      ReportFormatterFactory.instance = new ReportFormatterFactory(templateEngine);
    }
    return ReportFormatterFactory.instance;
  }

  private initializeBuiltinGenerators(): void {
    // Register built-in generators
    this.registerGenerator(ExportFormat.JSON, new JSONGenerator());

    // HTML generator for preview and PDF source
    const htmlGenerator = new HTMLGenerator();
    this.registerGenerator(ExportFormat.PDF, htmlGenerator); // Will be overridden by PDFGenerator
  }

  registerGenerator(format: ExportFormat, generator: IFormatGenerator): void {
    if (this.generators.has(format)) {
      logger.warn(`Overriding existing generator for format: ${format}`);
    }

    this.generators.set(format, generator);
    logger.info(`Registered format generator for: ${format}`);
  }

  getGenerator(format: ExportFormat): IFormatGenerator | null {
    return this.generators.get(format) || null;
  }

  getSupportedFormats(): ExportFormat[] {
    return Array.from(this.generators.keys());
  }

  async generateReport(
    templateId: string,
    context: Record<string, any>,
    format: ExportFormat,
    exportOptions: ExportOptions,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<FormatGeneratorResult> {
    try {
      // Get the appropriate generator
      const generator = this.getGenerator(format);
      if (!generator) {
        throw new Error(`No generator registered for format: ${format}`);
      }

      // Render template first
      progressCallback?.(10, 'Rendering template...');
      const templateResult = await this.templateEngine.renderTemplate(templateId, context);

      if (!templateResult.success) {
        throw new Error(`Template rendering failed: ${templateResult.error}`);
      }

      // Generate format-specific output
      progressCallback?.(30, `Generating ${format.toUpperCase()} output...`);

      const generatorOptions: FormatGeneratorOptions = {
        templateData: templateResult,
        exportOptions,
        customOptions: exportOptions.customOptions,
        streamingEnabled: generator.supportsStreaming() && (context.data?.length || 0) > generator.defaultConfig.streamingThreshold!,
        progressCallback: (progress: number, message: string) => {
          // Scale generator progress to 30-90% range
          const scaledProgress = 30 + (progress * 0.6);
          progressCallback?.(scaledProgress, message);
        }
      };

      const result = await generator.generate(generatorOptions);

      progressCallback?.(100, 'Report generation completed');

      return result;
    } catch (error) {
      logger.error('Report generation failed:', error);
      throw error;
    }
  }

  async estimateOutputSize(format: ExportFormat, recordCount: number, fieldCount: number): Promise<number> {
    const generator = this.getGenerator(format);
    if (!generator) {
      throw new Error(`No generator registered for format: ${format}`);
    }

    return generator.estimateOutputSize(recordCount, fieldCount);
  }

  validateFormatOptions(format: ExportFormat, options: FormatGeneratorOptions): void {
    const generator = this.getGenerator(format);
    if (!generator) {
      throw new Error(`No generator registered for format: ${format}`);
    }

    generator.validateOptions(options);
  }

  getFormatCapabilities(format: ExportFormat): {
    supportsStreaming: boolean;
    maxFileSize: number;
    supportedMimeTypes: string[];
    compressionOptions: Record<string, any>;
  } | null {
    const generator = this.getGenerator(format);
    if (!generator) {
      return null;
    }

    return {
      supportsStreaming: generator.supportsStreaming(),
      maxFileSize: generator.defaultConfig.maxFileSize || 0,
      supportedMimeTypes: generator.supportedMimeTypes,
      compressionOptions: generator.getCompressionOptions()
    };
  }

  // Lazy loading for external generators
  async loadExternalGenerators(): Promise<void> {
    try {
      // Load PDF Generator
      const { PDFGenerator } = await import('../generators/PDFGenerator');
      this.registerGenerator(ExportFormat.PDF, new PDFGenerator());

      // Load Excel Generator
      const { ExcelGenerator } = await import('../generators/ExcelGenerator');
      this.registerGenerator(ExportFormat.EXCEL, new ExcelGenerator());

      // Load CSV Generator
      const { CSVGenerator } = await import('../generators/CSVGenerator');
      this.registerGenerator(ExportFormat.CSV, new CSVGenerator());

      logger.info('All external format generators loaded successfully');
    } catch (error) {
      logger.error('Failed to load external generators:', error);
      throw error;
    }
  }
}

// Export factory instance creator
export const createReportFormatterFactory = (templateEngine: ReportTemplateEngine): ReportFormatterFactory => {
  return ReportFormatterFactory.getInstance(templateEngine);
};

// Export interfaces and types for external use
export {
  IFormatGenerator,
  FormatGeneratorOptions,
  FormatGeneratorResult,
  FormatGeneratorConfig
};