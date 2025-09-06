/**
 * Export Service
 * Handles exporting reports in various formats (PDF, Excel, CSV, JSON)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Workbook } from 'exceljs';
import puppeteer from 'puppeteer';
import {
  ExportFormat,
  ReportExportOptions,
  ReportApiResponse
} from '../../types/reports';

export class ExportService {
  private exportPath: string;

  constructor(exportPath: string = './exports') {
    this.exportPath = exportPath;
    this.ensureExportDirectory();
  }

  /**
   * Export data in specified format
   */
  async exportData(
    data: any[],
    format: ExportFormat,
    options: ReportExportOptions = { format },
    metadata?: any
  ): Promise<ReportApiResponse<{ filePath: string; fileName: string; size: number }>> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `report_${timestamp}.${format}`;
      const filePath = path.join(this.exportPath, fileName);

      let size = 0;

      switch (format) {
        case 'csv':
          size = await this.exportToCSV(data, filePath, options);
          break;
        case 'excel':
          size = await this.exportToExcel(data, filePath, options);
          break;
        case 'json':
          size = await this.exportToJSON(data, filePath, options, metadata);
          break;
        case 'pdf':
          size = await this.exportToPDF(data, filePath, options, metadata);
          break;
        case 'html':
          size = await this.exportToHTML(data, filePath, options, metadata);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        data: {
          filePath,
          fileName,
          size
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: 'EXPORT_ERROR',
          message: `Failed to export data: ${error.message}`
        }]
      };
    }
  }

  /**
   * Export to CSV format
   */
  private async exportToCSV(data: any[], filePath: string, options: ReportExportOptions): Promise<number> {
    if (data.length === 0) {
      fs.writeFileSync(filePath, '');
      return 0;
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);
    const headerRow = headers.join(',');

    // Convert data rows
    const dataRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',');
    });

    const csvContent = [headerRow, ...dataRows].join('\n');
    fs.writeFileSync(filePath, csvContent);
    
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * Export to Excel format
   */
  private async exportToExcel(data: any[], filePath: string, options: ReportExportOptions): Promise<number> {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Report Data');

    if (data.length === 0) {
      await workbook.xlsx.writeFile(filePath);
      const stats = fs.statSync(filePath);
      return stats.size;
    }

    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    data.forEach(row => {
      const rowData = headers.map(header => row[header]);
      worksheet.addRow(rowData);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    await workbook.xlsx.writeFile(filePath);
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(
    data: any[], 
    filePath: string, 
    options: ReportExportOptions, 
    metadata?: any
  ): Promise<number> {
    const jsonData = {
      metadata: options.includeMetadata ? {
        exportedAt: new Date().toISOString(),
        totalRecords: data.length,
        format: 'json',
        ...metadata
      } : undefined,
      data
    };

    const jsonContent = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(filePath, jsonContent);
    
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * Export to PDF format
   */
  private async exportToPDF(
    data: any[], 
    filePath: string, 
    options: ReportExportOptions, 
    metadata?: any
  ): Promise<number> {
    // Generate HTML content first
    const htmlContent = this.generateHTMLContent(data, metadata);
    
    let browser;
    try {
      browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent);
      
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm'
        }
      });
      
      const stats = fs.statSync(filePath);
      return stats.size;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Export to HTML format
   */
  private async exportToHTML(
    data: any[], 
    filePath: string, 
    options: ReportExportOptions, 
    metadata?: any
  ): Promise<number> {
    const htmlContent = this.generateHTMLContent(data, metadata);
    fs.writeFileSync(filePath, htmlContent);
    
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * Generate HTML content for reports
   */
  private generateHTMLContent(data: any[], metadata?: any): string {
    const title = metadata?.title || 'Network CMDB Report';
    const generatedAt = new Date().toLocaleString();
    
    if (data.length === 0) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .no-data { text-align: center; color: #666; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>Generated: ${generatedAt}</p>
          </div>
          <div class="no-data">No data available</div>
        </body>
        </html>
      `;
    }

    const headers = Object.keys(data[0]);
    const tableHeaders = headers.map(h => `<th>${h}</th>`).join('');
    const tableRows = data.map(row => {
      const cells = headers.map(header => `<td>${row[header] || ''}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            font-size: 12px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left;
            font-size: 11px;
          }
          th { 
            background-color: #f2f2f2; 
            font-weight: bold;
          }
          tr:nth-child(even) { 
            background-color: #f9f9f9; 
          }
          .metadata {
            margin-top: 30px;
            padding: 20px;
            background-color: #f5f5f5;
            border-radius: 5px;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>Generated: ${generatedAt}</p>
          <p>Total Records: ${data.length}</p>
        </div>
        
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        ${metadata ? `
          <div class="metadata">
            <h3>Report Metadata</h3>
            <pre>${JSON.stringify(metadata, null, 2)}</pre>
          </div>
        ` : ''}
      </body>
      </html>
    `;
  }

  /**
   * Ensure export directory exists
   */
  private ensureExportDirectory(): void {
    if (!fs.existsSync(this.exportPath)) {
      fs.mkdirSync(this.exportPath, { recursive: true });
    }
  }

  /**
   * Clean up old export files
   */
  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = fs.readdirSync(this.exportPath);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.exportPath, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old export files:', error);
    }
  }

  /**
   * Get file download stream
   */
  getFileStream(fileName: string): fs.ReadStream | null {
    const filePath = path.join(this.exportPath, fileName);
    
    if (fs.existsSync(filePath)) {
      return fs.createReadStream(filePath);
    }
    
    return null;
  }

  /**
   * Delete export file
   */
  deleteFile(fileName: string): boolean {
    try {
      const filePath = path.join(this.exportPath, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}