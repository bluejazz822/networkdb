/**
 * Excel Generator
 * Advanced Excel generation with streaming support, custom formatting,
 * charts, conditional formatting, and template-based structure
 */

import ExcelJS from 'exceljs';
import { EventEmitter } from 'events';
import { Readable, PassThrough } from 'stream';
import { ExportFormat } from '../../types/export';
import {
  IFormatGenerator,
  FormatGeneratorOptions,
  FormatGeneratorResult,
  FormatGeneratorConfig
} from '../formatters/ReportFormatters';
import winston from 'winston';

// Logger for Excel generation
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'ExcelGenerator' }),
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

export interface ExcelGeneratorOptions {
  workbookName?: string;
  sheetName?: string;
  includeCharts?: boolean;
  freezeHeader?: boolean;
  autoFilter?: boolean;
  columnWidths?: Record<string, number>;
  headerStyle?: Partial<ExcelJS.Style>;
  dataStyle?: Partial<ExcelJS.Style>;
  conditionalFormatting?: ExcelConditionalFormatting[];
  charts?: ExcelChartConfig[];
  templates?: ExcelTemplateConfig;
  formatting?: {
    currency?: string;
    dateFormat?: string;
    numberFormat?: string;
    percentFormat?: string;
  };
  protection?: {
    password?: string;
    lockStructure?: boolean;
    lockWindows?: boolean;
  };
  metadata?: {
    title?: string;
    subject?: string;
    author?: string;
    company?: string;
    category?: string;
  };
}

export interface ExcelConditionalFormatting {
  range: string;
  type: 'cellIs' | 'colorScale' | 'dataBar' | 'iconSet';
  operator?: 'equal' | 'greaterThan' | 'lessThan' | 'between' | 'notEqual';
  formula?: string;
  value?: any;
  style?: Partial<ExcelJS.Style>;
  colorScale?: {
    min: string;
    mid?: string;
    max: string;
  };
}

export interface ExcelChartConfig {
  type: 'column' | 'line' | 'pie' | 'bar' | 'area' | 'scatter';
  title: string;
  position: {
    row: number;
    col: number;
    width?: number;
    height?: number;
  };
  dataRange: string;
  categoryRange?: string;
  seriesName?: string;
  xAxisTitle?: string;
  yAxisTitle?: string;
}

export interface ExcelTemplateConfig {
  useTemplate?: boolean;
  templatePath?: string;
  templateSheetName?: string;
  dataStartRow?: number;
  dataStartCol?: number;
  preserveFormatting?: boolean;
}

export interface ExcelSheetData {
  name: string;
  data: any[];
  headers?: string[];
  options?: ExcelGeneratorOptions;
}

export class ExcelGenerator extends EventEmitter implements IFormatGenerator {
  readonly format = ExportFormat.EXCEL;
  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  readonly defaultConfig: FormatGeneratorConfig = {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    encoding: 'binary',
    memoryLimit: 1024 * 1024 * 1024, // 1GB
    streamingThreshold: 5000,
    compressionLevel: 6
  };

  private defaultOptions: ExcelGeneratorOptions;

  constructor() {
    super();

    this.defaultOptions = {
      workbookName: 'Report',
      sheetName: 'Data',
      includeCharts: false,
      freezeHeader: true,
      autoFilter: true,
      columnWidths: {},
      headerStyle: {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      },
      dataStyle: {
        font: { size: 11 },
        alignment: { vertical: 'middle' },
        border: {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        }
      },
      formatting: {
        currency: '$#,##0.00',
        dateFormat: 'mm/dd/yyyy',
        numberFormat: '#,##0.00',
        percentFormat: '0.00%'
      }
    };
  }

  async generate(options: FormatGeneratorOptions): Promise<FormatGeneratorResult> {
    const startTime = Date.now();

    try {
      this.validateOptions(options);

      this.emit('generation:started', { format: this.format });

      // Extract data from template context
      const data = options.templateData.context.data || [];
      const excelOptions = this.mergeOptions(options.customOptions?.excel || {});

      // Determine if streaming is needed
      const useStreaming = options.streamingEnabled && data.length > this.defaultConfig.streamingThreshold!;

      let buffer: Buffer;
      let sheetsCount = 1;

      if (useStreaming) {
        buffer = await this.generateWithStreaming(data, excelOptions, options.progressCallback);
      } else {
        const result = await this.generateStandard(data, excelOptions, options.progressCallback);
        buffer = result.buffer;
        sheetsCount = result.sheetsCount;
      }

      const processingTime = Date.now() - startTime;

      this.emit('generation:completed', {
        format: this.format,
        size: buffer.length,
        sheets: sheetsCount,
        processingTime
      });

      return {
        success: true,
        buffer,
        metadata: {
          format: this.format,
          size: buffer.length,
          mimeType: this.supportedMimeTypes[0],
          sheets: sheetsCount,
          records: Array.isArray(data) ? data.length : 1,
          generatedAt: new Date(),
          processingTime
        }
      };
    } catch (error) {
      this.emit('generation:failed', { format: this.format, error });
      logger.error('Excel generation failed:', error);

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

  private async generateStandard(
    data: any[],
    options: ExcelGeneratorOptions,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<{ buffer: Buffer; sheetsCount: number }> {
    progressCallback?.(10, 'Creating Excel workbook...');

    const workbook = new ExcelJS.Workbook();
    this.setupWorkbookMetadata(workbook, options);

    // Determine data structure - check if multiple sheets needed
    const sheets = this.organizeDataIntoSheets(data);

    progressCallback?.(20, 'Processing data sheets...');

    let sheetIndex = 0;
    for (const sheetData of sheets) {
      sheetIndex++;
      const progressPercent = 20 + (sheetIndex / sheets.length) * 60;
      progressCallback?.(progressPercent, `Processing sheet: ${sheetData.name}`);

      await this.createWorksheet(workbook, sheetData, options);
    }

    progressCallback?.(90, 'Finalizing Excel file...');

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer() as Buffer;

    progressCallback?.(100, 'Excel generation completed');

    return { buffer, sheetsCount: sheets.length };
  }

  private async generateWithStreaming(
    data: any[],
    options: ExcelGeneratorOptions,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<Buffer> {
    progressCallback?.(10, 'Initializing streaming Excel generation...');

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      useStyles: true,
      useSharedStrings: true
    });

    this.setupWorkbookMetadata(workbook as any, options);

    // Create worksheet
    const worksheet = workbook.addWorksheet(options.sheetName || 'Data');

    // Setup headers and formatting
    await this.setupWorksheetStreaming(worksheet, data[0], options);

    progressCallback?.(20, 'Streaming data to Excel...');

    // Stream data in batches
    const batchSize = 1000;
    let processedRows = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, Math.min(i + batchSize, data.length));

      for (const record of batch) {
        const row = worksheet.addRow(this.extractRowValues(record, data[0]));
        this.applyRowFormatting(row, options.dataStyle!);
      }

      processedRows += batch.length;
      const progress = 20 + (processedRows / data.length) * 60;
      progressCallback?.(progress, `Processed ${processedRows} of ${data.length} rows`);

      // Commit rows to free memory
      await worksheet.commit();
    }

    progressCallback?.(90, 'Finalizing streaming Excel file...');

    // Finalize workbook
    await workbook.commit();

    // Get buffer from stream
    const buffers: Buffer[] = [];
    const stream = workbook.stream as PassThrough;

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => buffers.push(chunk));
      stream.on('end', () => {
        progressCallback?.(100, 'Streaming Excel generation completed');
        resolve(Buffer.concat(buffers));
      });
      stream.on('error', reject);
    });
  }

  private setupWorkbookMetadata(workbook: ExcelJS.Workbook, options: ExcelGeneratorOptions): void {
    workbook.creator = options.metadata?.author || 'Report Generator';
    workbook.lastModifiedBy = options.metadata?.author || 'Report Generator';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.title = options.metadata?.title || options.workbookName || 'Report';
    workbook.subject = options.metadata?.subject || 'Generated Report';
    workbook.company = options.metadata?.company || '';
    workbook.category = options.metadata?.category || 'Reports';
  }

  private organizeDataIntoSheets(data: any[]): ExcelSheetData[] {
    // For now, single sheet - could be extended to support multiple sheets based on data structure
    if (!Array.isArray(data) || data.length === 0) {
      return [{ name: 'Data', data: [], headers: [] }];
    }

    // Extract headers from first record
    const headers = Object.keys(data[0]);

    return [{
      name: 'Data',
      data,
      headers
    }];
  }

  private async createWorksheet(
    workbook: ExcelJS.Workbook,
    sheetData: ExcelSheetData,
    options: ExcelGeneratorOptions
  ): Promise<ExcelJS.Worksheet> {
    const worksheet = workbook.addWorksheet(sheetData.name);

    if (sheetData.data.length === 0) {
      return worksheet;
    }

    // Add headers
    const headers = sheetData.headers || Object.keys(sheetData.data[0]);
    const headerRow = worksheet.addRow(headers);

    // Apply header formatting
    this.applyRowFormatting(headerRow, options.headerStyle!);

    // Set column widths
    this.setupColumnWidths(worksheet, headers, options);

    // Add data rows
    for (const record of sheetData.data) {
      const values = this.extractRowValues(record, sheetData.data[0]);
      const row = worksheet.addRow(values);
      this.applyRowFormatting(row, options.dataStyle!);
    }

    // Apply formatting and features
    await this.applyWorksheetFeatures(worksheet, headers, sheetData.data, options);

    return worksheet;
  }

  private async setupWorksheetStreaming(
    worksheet: ExcelJS.stream.xlsx.WorksheetWriter,
    sampleRecord: any,
    options: ExcelGeneratorOptions
  ): Promise<void> {
    if (!sampleRecord) return;

    const headers = Object.keys(sampleRecord);

    // Add header row
    const headerRow = worksheet.addRow(headers);
    this.applyRowFormatting(headerRow as any, options.headerStyle!);

    // Set column widths
    this.setupColumnWidths(worksheet as any, headers, options);

    // Commit header
    await worksheet.commit();
  }

  private extractRowValues(record: any, sampleRecord: any): any[] {
    const headers = Object.keys(sampleRecord);
    return headers.map(header => {
      const value = record[header];

      // Format values based on type
      if (value instanceof Date) {
        return value;
      } else if (typeof value === 'number') {
        return value;
      } else if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      } else if (value === null || value === undefined) {
        return '';
      } else {
        return String(value);
      }
    });
  }

  private applyRowFormatting(row: ExcelJS.Row, style: Partial<ExcelJS.Style>): void {
    row.eachCell((cell) => {
      Object.assign(cell, style);
    });
  }

  private setupColumnWidths(
    worksheet: ExcelJS.Worksheet,
    headers: string[],
    options: ExcelGeneratorOptions
  ): void {
    headers.forEach((header, index) => {
      const colIndex = index + 1;
      const customWidth = options.columnWidths?.[header];

      if (customWidth) {
        worksheet.getColumn(colIndex).width = customWidth;
      } else {
        // Auto-size based on header length
        const autoWidth = Math.max(10, Math.min(30, header.length + 2));
        worksheet.getColumn(colIndex).width = autoWidth;
      }
    });
  }

  private async applyWorksheetFeatures(
    worksheet: ExcelJS.Worksheet,
    headers: string[],
    data: any[],
    options: ExcelGeneratorOptions
  ): Promise<void> {
    const dataRowCount = data.length;

    // Freeze header row
    if (options.freezeHeader) {
      worksheet.views = [{
        state: 'frozen',
        xSplit: 0,
        ySplit: 1
      }];
    }

    // Auto filter
    if (options.autoFilter && dataRowCount > 0) {
      const lastColumn = this.getColumnLetter(headers.length);
      worksheet.autoFilter = `A1:${lastColumn}${dataRowCount + 1}`;
    }

    // Apply conditional formatting
    if (options.conditionalFormatting) {
      for (const rule of options.conditionalFormatting) {
        await this.applyConditionalFormatting(worksheet, rule);
      }
    }

    // Add charts
    if (options.charts && options.includeCharts) {
      for (const chartConfig of options.charts) {
        await this.addChart(worksheet, chartConfig, dataRowCount);
      }
    }

    // Apply protection
    if (options.protection) {
      await worksheet.protect(options.protection.password, {
        selectLockedCells: true,
        selectUnlockedCells: true
      });
    }
  }

  private async applyConditionalFormatting(
    worksheet: ExcelJS.Worksheet,
    rule: ExcelConditionalFormatting
  ): Promise<void> {
    try {
      const conditionalFormatting: any = {
        ref: rule.range,
        rules: [{
          type: rule.type,
          style: rule.style
        }]
      };

      if (rule.type === 'cellIs' && rule.operator && rule.value !== undefined) {
        conditionalFormatting.rules[0].operator = rule.operator;
        conditionalFormatting.rules[0].formulae = [rule.value];
      }

      if (rule.type === 'colorScale' && rule.colorScale) {
        conditionalFormatting.rules[0].cfvo = [
          { type: 'min', value: 0, color: { argb: rule.colorScale.min } },
          { type: 'max', value: 0, color: { argb: rule.colorScale.max } }
        ];

        if (rule.colorScale.mid) {
          conditionalFormatting.rules[0].cfvo.splice(1, 0, {
            type: 'percentile',
            value: 50,
            color: { argb: rule.colorScale.mid }
          });
        }
      }

      worksheet.addConditionalFormatting(conditionalFormatting);
    } catch (error) {
      logger.warn('Failed to apply conditional formatting:', error);
    }
  }

  private async addChart(
    worksheet: ExcelJS.Worksheet,
    config: ExcelChartConfig,
    dataRowCount: number
  ): Promise<void> {
    try {
      // Note: ExcelJS chart support is limited in current version
      // This is a placeholder for future chart implementation
      logger.info(`Chart requested: ${config.type} at row ${config.position.row}, col ${config.position.col}`);
    } catch (error) {
      logger.warn('Failed to add chart:', error);
    }
  }

  private getColumnLetter(columnNumber: number): string {
    let columnLetter = '';
    while (columnNumber > 0) {
      const remainder = (columnNumber - 1) % 26;
      columnLetter = String.fromCharCode(65 + remainder) + columnLetter;
      columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return columnLetter;
  }

  private mergeOptions(customOptions: any): ExcelGeneratorOptions {
    return {
      ...this.defaultOptions,
      ...customOptions,
      headerStyle: { ...this.defaultOptions.headerStyle, ...customOptions.headerStyle },
      dataStyle: { ...this.defaultOptions.dataStyle, ...customOptions.dataStyle },
      formatting: { ...this.defaultOptions.formatting, ...customOptions.formatting }
    };
  }

  validateOptions(options: FormatGeneratorOptions): void {
    if (!options.templateData) {
      throw new Error('Template data is required for Excel generation');
    }

    if (!options.exportOptions) {
      throw new Error('Export options are required');
    }

    // Validate Excel-specific options
    const excelOptions = options.customOptions?.excel;
    if (excelOptions?.charts && !Array.isArray(excelOptions.charts)) {
      throw new Error('Charts must be an array');
    }

    if (excelOptions?.conditionalFormatting && !Array.isArray(excelOptions.conditionalFormatting)) {
      throw new Error('Conditional formatting must be an array');
    }
  }

  estimateOutputSize(recordCount: number, fieldCount: number): number {
    // Excel files have significant overhead due to XML structure and formatting
    const baseRecordSize = fieldCount * 20; // Average field size in Excel
    const xmlOverhead = 2.5; // XML structure overhead
    const fixedOverhead = 100 * 1024; // 100KB for workbook structure

    return Math.ceil((recordCount * baseRecordSize * xmlOverhead) + fixedOverhead);
  }

  supportsStreaming(): boolean {
    return true;
  }

  getCompressionOptions(): Record<string, any> {
    return {
      level: this.defaultConfig.compressionLevel,
      algorithm: 'zip' // Excel files are ZIP-based
    };
  }
}

export default ExcelGenerator;