/**
 * Excel Exporter
 * Handles Excel export using ExcelJS with advanced formatting and styling capabilities
 */

import ExcelJS from 'exceljs';
import { ExportOptions, ExportFormat, ExportError } from '../types/export';

export interface ExcelExportOptions extends ExportOptions {
  sheetName?: string;
  includeAutoFilter?: boolean;
  freezePanes?: { row: number; column: number };
  columnWidths?: Record<string, number>;
  formatting?: {
    headerStyle?: Partial<ExcelJS.Style>;
    dataStyle?: Partial<ExcelJS.Style>;
    alternatingRowStyle?: Partial<ExcelJS.Style>;
  };
  charts?: ExcelChartConfig[];
  summarySheet?: boolean;
  protectWorkbook?: boolean;
  password?: string;
}

export interface ExcelChartConfig {
  type: 'column' | 'line' | 'pie' | 'bar';
  title: string;
  dataRange: string;
  position: { row: number; column: number };
  size: { width: number; height: number };
}

export interface ExcelColumnConfig {
  key: string;
  header: string;
  width?: number;
  style?: Partial<ExcelJS.Style>;
  type?: 'string' | 'number' | 'date' | 'boolean';
}

export class ExcelExporter {
  private workbook: ExcelJS.Workbook;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.initializeWorkbook();
  }

  /**
   * Initialize workbook with metadata
   */
  private initializeWorkbook(): void {
    this.workbook.creator = 'Network CMDB Export Service';
    this.workbook.lastModifiedBy = 'Network CMDB Export Service';
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
    this.workbook.lastPrinted = new Date();
  }

  /**
   * Export data to Excel format
   */
  async exportToExcel(data: any[], options: ExcelExportOptions): Promise<Buffer> {
    try {
      if (!data || data.length === 0) {
        throw new ExportError('No data provided for Excel export', 'EXCEL_NO_DATA');
      }

      // Reset workbook for fresh export
      this.workbook = new ExcelJS.Workbook();
      this.initializeWorkbook();

      // Create summary sheet if requested
      if (options.summarySheet) {
        await this.createSummarySheet(data, options);
      }

      // Create main data sheet
      await this.createDataSheet(data, options);

      // Protect workbook if requested (note: ExcelJS doesn't support workbook-level protection)
      // This would need to be implemented at the worksheet level
      if (options.protectWorkbook && options.password) {
        // ExcelJS doesn't support workbook protection directly
        console.warn('Workbook protection is not supported by ExcelJS');
      }

      // Generate buffer
      const buffer = await this.workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);

    } catch (error) {
      throw new ExportError(
        `Excel export failed: ${error.message}`,
        'EXCEL_EXPORT_ERROR',
        undefined,
        {
          error: error.message,
          options: {
            sheetName: options.sheetName,
            includeAutoFilter: options.includeAutoFilter,
            summarySheet: options.summarySheet
          }
        }
      );
    }
  }

  /**
   * Create summary sheet with statistics and metadata
   */
  private async createSummarySheet(data: any[], options: ExcelExportOptions): Promise<void> {
    const worksheet = this.workbook.addWorksheet('Summary', {
      properties: {
        tabColor: { argb: 'FF3498DB' }
      }
    });

    // Summary statistics
    const stats = this.calculateSummaryStats(data, options);

    // Add title
    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Export Summary';
    titleCell.style = {
      font: { bold: true, size: 16, color: { argb: 'FF2C3E50' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF0F1' } }
    };

    // Add export metadata
    let currentRow = 3;
    const metadata = [
      ['Export Date', new Date().toLocaleString()],
      ['Resource Type', options.resourceType || 'Unknown'],
      ['Total Records', data.length],
      ['Fields Exported', stats.fieldCount],
      ['File Format', 'Excel (.xlsx)']
    ];

    if (options.filters && Object.keys(options.filters).length > 0) {
      metadata.push(['Filters Applied', this.formatFiltersForDisplay(options.filters)]);
    }

    metadata.forEach(([label, value], index) => {
      const labelCell = worksheet.getCell(`A${currentRow + index}`);
      const valueCell = worksheet.getCell(`B${currentRow + index}`);

      labelCell.value = label;
      labelCell.style = {
        font: { bold: true, color: { argb: 'FF2C3E50' } },
        alignment: { horizontal: 'left' }
      };

      valueCell.value = value;
      valueCell.style = {
        alignment: { horizontal: 'left' }
      };
    });

    currentRow += metadata.length + 2;

    // Add field statistics if available
    if (stats.fieldStats.length > 0) {
      const fieldStatsHeader = worksheet.getCell(`A${currentRow}`);
      fieldStatsHeader.value = 'Field Statistics';
      fieldStatsHeader.style = {
        font: { bold: true, size: 14, color: { argb: 'FF2C3E50' } }
      };

      currentRow += 2;

      // Field stats table headers
      const headers = ['Field', 'Type', 'Non-Empty', 'Unique Values'];
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.style = this.getHeaderStyle();
      });

      currentRow++;

      // Field stats data
      stats.fieldStats.forEach((stat, index) => {
        const rowData = [stat.field, stat.type, stat.nonEmptyCount, stat.uniqueCount];
        rowData.forEach((value, colIndex) => {
          const cell = worksheet.getCell(currentRow + index, colIndex + 1);
          cell.value = value;
          cell.style = index % 2 === 0 ? this.getDataStyle() : this.getAlternatingRowStyle();
        });
      });
    }

    // Auto-fit columns
    worksheet.columns = [
      { width: 20 },
      { width: 25 },
      { width: 15 },
      { width: 15 }
    ];
  }

  /**
   * Create main data sheet
   */
  private async createDataSheet(data: any[], options: ExcelExportOptions): Promise<void> {
    const sheetName = options.sheetName || 'Data';
    const worksheet = this.workbook.addWorksheet(sheetName);

    // Configure columns
    const columns = this.configureColumns(data, options);
    worksheet.columns = columns;

    // Add data rows
    const formattedData = this.formatDataForExcel(data, options);
    formattedData.forEach((row, index) => {
      const excelRow = worksheet.addRow(row);

      // Apply alternating row style
      if (index % 2 === 1 && options.formatting?.alternatingRowStyle) {
        excelRow.eachCell((cell) => {
          cell.style = { ...cell.style, ...options.formatting!.alternatingRowStyle };
        });
      }
    });

    // Style header row
    const headerRow = worksheet.getRow(1);
    const headerStyle = options.formatting?.headerStyle || this.getHeaderStyle();
    headerRow.eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Apply auto filter if requested
    if (options.includeAutoFilter) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: data.length + 1, column: columns.length }
      };
    }

    // Apply freeze panes if specified
    if (options.freezePanes) {
      worksheet.views = [{
        state: 'frozen',
        xSplit: options.freezePanes.column - 1,
        ySplit: options.freezePanes.row - 1
      }];
    } else {
      // Default: freeze header row
      worksheet.views = [{
        state: 'frozen',
        ySplit: 1
      }];
    }

    // Auto-fit columns with minimum and maximum widths
    this.autoFitColumns(worksheet, options);

    // Add charts if specified
    if (options.charts && options.charts.length > 0) {
      await this.addCharts(worksheet, options.charts, data);
    }
  }

  /**
   * Configure Excel columns based on data structure
   */
  private configureColumns(data: any[], options: ExcelExportOptions): Partial<ExcelJS.Column>[] {
    if (data.length === 0) return [];

    const firstRecord = data[0];
    let fields = options.fields || Object.keys(firstRecord);

    return fields.map(field => {
      const column: Partial<ExcelJS.Column> = {
        key: field,
        header: this.formatHeaderName(field),
        width: options.columnWidths?.[field] || this.calculateColumnWidth(field, data)
      };

      // Apply custom styling if provided
      if (options.formatting?.dataStyle) {
        column.style = options.formatting.dataStyle;
      }

      return column;
    });
  }

  /**
   * Format data for Excel output
   */
  private formatDataForExcel(data: any[], options: ExcelExportOptions): any[][] {
    const fields = options.fields || (data.length > 0 ? Object.keys(data[0]) : []);

    return data.map(record => {
      return fields.map(field => {
        const value = record[field];
        return this.formatCellValue(value, field);
      });
    });
  }

  /**
   * Format individual cell values based on type
   */
  private formatCellValue(value: any, fieldName: string): any {
    if (value === null || value === undefined) {
      return '';
    }

    // Handle dates
    if (value instanceof Date) {
      return value;
    }

    // Handle date strings
    if (typeof value === 'string' && this.isDateString(value)) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date;
    }

    // Handle numbers
    if (typeof value === 'number') {
      return value;
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return value;
    }

    // Handle arrays and objects
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Check if string is a valid date
   */
  private isDateString(value: string): boolean {
    // Simple date pattern matching
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO date
      /^\d{2}\/\d{2}\/\d{4}$/ // MM/DD/YYYY
    ];

    return datePatterns.some(pattern => pattern.test(value));
  }

  /**
   * Calculate appropriate column width
   */
  private calculateColumnWidth(field: string, data: any[]): number {
    // Base width on header length
    let maxWidth = Math.max(field.length, 8);

    // Sample first few records to estimate content width
    const sampleSize = Math.min(data.length, 100);
    for (let i = 0; i < sampleSize; i++) {
      const value = data[i][field];
      if (value !== null && value !== undefined) {
        const stringValue = String(value);
        maxWidth = Math.max(maxWidth, stringValue.length);
      }
    }

    // Apply limits: minimum 8, maximum 50
    return Math.min(Math.max(maxWidth + 2, 8), 50);
  }

  /**
   * Auto-fit columns with constraints
   */
  private autoFitColumns(worksheet: ExcelJS.Worksheet, options: ExcelExportOptions): void {
    worksheet.columns.forEach((column, index) => {
      if (column.key && options.columnWidths?.[column.key]) {
        column.width = options.columnWidths[column.key];
      } else if (!column.width) {
        // Calculate width based on content
        let maxWidth = 8;
        worksheet.eachRow((row, rowNumber) => {
          const cell = row.getCell(index + 1);
          if (cell.value) {
            const valueLength = String(cell.value).length;
            maxWidth = Math.max(maxWidth, valueLength);
          }
        });
        column.width = Math.min(maxWidth + 2, 50);
      }
    });
  }

  /**
   * Add charts to worksheet
   */
  private async addCharts(worksheet: ExcelJS.Worksheet, charts: ExcelChartConfig[], data: any[]): Promise<void> {
    // Note: ExcelJS has limited chart support, this is a basic implementation
    // For full chart functionality, you might need to use a different library or approach

    charts.forEach((chartConfig, index) => {
      try {
        // Create a simple text placeholder for charts
        // In a full implementation, you would create actual Excel charts
        const chartCell = worksheet.getCell(chartConfig.position.row, chartConfig.position.column);
        chartCell.value = `[Chart: ${chartConfig.title}]`;
        chartCell.style = {
          font: { bold: true, color: { argb: 'FF3498DB' } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF0F1' } },
          border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
      } catch (error) {
        // Skip chart creation if it fails
        console.warn(`Failed to create chart ${index + 1}: ${error.message}`);
      }
    });
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummaryStats(data: any[], options: ExcelExportOptions): {
    fieldCount: number;
    fieldStats: Array<{
      field: string;
      type: string;
      nonEmptyCount: number;
      uniqueCount: number;
    }>;
  } {
    if (data.length === 0) {
      return { fieldCount: 0, fieldStats: [] };
    }

    const fields = options.fields || Object.keys(data[0]);
    const fieldStats = fields.map(field => {
      const values = data.map(record => record[field]).filter(v => v !== null && v !== undefined && v !== '');
      const uniqueValues = new Set(values);

      let type = 'string';
      if (values.length > 0) {
        const firstValue = values[0];
        if (typeof firstValue === 'number') type = 'number';
        else if (typeof firstValue === 'boolean') type = 'boolean';
        else if (firstValue instanceof Date) type = 'date';
        else if (typeof firstValue === 'string' && this.isDateString(firstValue)) type = 'date';
      }

      return {
        field,
        type,
        nonEmptyCount: values.length,
        uniqueCount: uniqueValues.size
      };
    });

    return {
      fieldCount: fields.length,
      fieldStats
    };
  }

  /**
   * Format header name for display
   */
  private formatHeaderName(field: string): string {
    // Convert camelCase or snake_case to Title Case
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * Format filters for display in summary
   */
  private formatFiltersForDisplay(filters: Record<string, any>): string {
    return Object.entries(filters)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
  }

  /**
   * Get default header style
   */
  private getHeaderStyle(): Partial<ExcelJS.Style> {
    return {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };
  }

  /**
   * Get default data style
   */
  private getDataStyle(): Partial<ExcelJS.Style> {
    return {
      alignment: { vertical: 'middle' },
      border: {
        top: { style: 'thin', color: { argb: 'FFECF0F1' } },
        left: { style: 'thin', color: { argb: 'FFECF0F1' } },
        bottom: { style: 'thin', color: { argb: 'FFECF0F1' } },
        right: { style: 'thin', color: { argb: 'FFECF0F1' } }
      }
    };
  }

  /**
   * Get alternating row style
   */
  private getAlternatingRowStyle(): Partial<ExcelJS.Style> {
    return {
      ...this.getDataStyle(),
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }
    };
  }

  /**
   * Create a template for future exports
   */
  async createTemplate(name: string, options: ExcelExportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Network CMDB Export Service';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(options.sheetName || 'Template');

    // Add sample headers if fields are provided
    if (options.fields && options.fields.length > 0) {
      const headers = options.fields.map(field => this.formatHeaderName(field));
      worksheet.addRow(headers);

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.style = this.getHeaderStyle();
      });

      // Auto-fit columns
      worksheet.columns = options.fields.map(field => ({
        key: field,
        header: this.formatHeaderName(field),
        width: options.columnWidths?.[field] || 15
      }));
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Validate Excel export options
   */
  validateOptions(options: ExcelExportOptions): void {
    if (options.charts) {
      options.charts.forEach((chart, index) => {
        if (!chart.type || !chart.title) {
          throw new ExportError(
            `Chart ${index + 1} is missing required type or title`,
            'EXCEL_INVALID_CHART_CONFIG'
          );
        }

        if (!chart.position || chart.position.row < 1 || chart.position.column < 1) {
          throw new ExportError(
            `Chart ${index + 1} has invalid position`,
            'EXCEL_INVALID_CHART_POSITION'
          );
        }
      });
    }

    if (options.protectWorkbook && !options.password) {
      throw new ExportError(
        'Password is required when workbook protection is enabled',
        'EXCEL_MISSING_PASSWORD'
      );
    }
  }
}