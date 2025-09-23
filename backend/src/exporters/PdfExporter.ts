/**
 * PDF Exporter
 * Handles PDF generation using Puppeteer with template system and optimization
 */

import puppeteer, { Browser, Page, PDFOptions } from 'puppeteer';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ExportOptions, ExportFormat, ExportError } from '../types/export';

export interface PdfExportOptions extends ExportOptions {
  template?: string;
  orientation?: 'portrait' | 'landscape';
  pageFormat?: string;
  includeHeaders?: boolean;
  includeFooters?: boolean;
  margins?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  printBackground?: boolean;
  scale?: number;
  pageRanges?: string;
  preferCSSPageSize?: boolean;
}

export interface PdfTemplateData {
  title: string;
  exportDate: string;
  recordCount: number;
  data: any[];
  headers?: string[];
  showSummary?: boolean;
  isTableFormat?: boolean;
  filters?: string;
  cssPath: string;
  [key: string]: any;
}

export class PdfExporter {
  private browser: Browser | null = null;
  private readonly templatePath: string;
  private readonly cssPath: string;

  constructor() {
    this.templatePath = path.join(__dirname, '../templates/export/pdf');
    this.cssPath = path.join(this.templatePath, 'report.css');
  }

  /**
   * Initialize Puppeteer browser with optimized settings
   */
  private async initializeBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        timeout: 30000,
        protocolTimeout: 30000
      });

      return this.browser;
    } catch (error) {
      throw new ExportError(
        `Failed to initialize PDF browser: ${error.message}`,
        'PDF_BROWSER_INIT_ERROR',
        undefined,
        { error: error.message }
      );
    }
  }

  /**
   * Export data to PDF format
   */
  async exportToPdf(data: any[], options: PdfExportOptions): Promise<Buffer> {
    let page: Page | null = null;

    try {
      if (!data || data.length === 0) {
        throw new ExportError('No data provided for PDF export', 'PDF_NO_DATA');
      }

      const browser = await this.initializeBrowser();
      page = await browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 1
      });

      // Generate HTML content
      const htmlContent = await this.generateHtmlContent(data, options);

      // Set content and wait for network idle
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Configure PDF options
      const pdfOptions = this.configurePdfOptions(options);

      // Generate PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      return Buffer.from(pdfBuffer);

    } catch (error) {
      throw new ExportError(
        `PDF export failed: ${error.message}`,
        'PDF_EXPORT_ERROR',
        undefined,
        {
          error: error.message,
          options: {
            template: options.template,
            orientation: options.orientation,
            pageFormat: options.pageFormat
          }
        }
      );
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Generate HTML content from template and data
   */
  private async generateHtmlContent(data: any[], options: PdfExportOptions): Promise<string> {
    try {
      const templateName = options.template || 'default';
      const templateFilePath = path.join(this.templatePath, `${templateName}.html`);

      // Check if template exists
      let templateContent: string;
      try {
        templateContent = await fs.readFile(templateFilePath, 'utf-8');
      } catch (error) {
        // Fall back to default template if custom template not found
        const defaultTemplatePath = path.join(this.templatePath, 'default.html');
        templateContent = await fs.readFile(defaultTemplatePath, 'utf-8');
      }

      // Read CSS content
      const cssContent = await fs.readFile(this.cssPath, 'utf-8');

      // Prepare template data
      const templateData = this.prepareTemplateData(data, options);

      // Process template with simple string replacement (you could use a template engine like Handlebars here)
      let processedHtml = this.processTemplate(templateContent, templateData);

      // Inline CSS for better PDF rendering
      processedHtml = processedHtml.replace('{{cssPath}}', `<style>${cssContent}</style>`);

      return processedHtml;

    } catch (error) {
      throw new ExportError(
        `Failed to generate HTML content: ${error.message}`,
        'PDF_HTML_GENERATION_ERROR',
        undefined,
        { template: options.template }
      );
    }
  }

  /**
   * Prepare data for template rendering
   */
  private prepareTemplateData(data: any[], options: PdfExportOptions): PdfTemplateData {
    // Determine if we should use table or card format
    const isTableFormat = this.shouldUseTableFormat(data, options);

    // Extract headers if using table format
    let headers: string[] = [];
    if (isTableFormat && data.length > 0) {
      if (options.fields && options.fields.length > 0) {
        headers = options.fields;
      } else {
        headers = Object.keys(data[0]);
      }
    }

    // Format data for display
    const formattedData = this.formatDataForDisplay(data, options, isTableFormat);

    // Generate filters summary
    const filtersText = this.generateFiltersText(options.filters);

    return {
      title: this.generateTitle(options),
      exportDate: new Date().toLocaleString(),
      recordCount: data.length,
      data: formattedData,
      headers,
      showSummary: options.includeMetadata !== false,
      isTableFormat,
      filters: filtersText,
      cssPath: 'PLACEHOLDER_FOR_CSS' // Will be replaced with actual CSS
    };
  }

  /**
   * Simple template processing (replace placeholders)
   */
  private processTemplate(template: string, data: PdfTemplateData): string {
    let processed = template;

    // Replace simple variables
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'string' || typeof data[key] === 'number' || typeof data[key] === 'boolean') {
        const regex = new RegExp(`{{${key}}}`, 'g');
        processed = processed.replace(regex, String(data[key]));
      }
    });

    // Handle conditional blocks
    processed = this.processConditionals(processed, data);

    // Handle loops
    processed = this.processLoops(processed, data);

    return processed;
  }

  /**
   * Process conditional blocks in template
   */
  private processConditionals(template: string, data: PdfTemplateData): string {
    let processed = template;

    // Process {{#if condition}} blocks
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    processed = processed.replace(ifRegex, (match, condition, content) => {
      if (data[condition]) {
        return content;
      }
      return '';
    });

    return processed;
  }

  /**
   * Process loop blocks in template
   */
  private processLoops(template: string, data: PdfTemplateData): string {
    let processed = template;

    // Process {{#each array}} blocks for headers
    if (data.headers) {
      const headersRegex = /{{#each\s+headers}}([\s\S]*?){{\/each}}/g;
      processed = processed.replace(headersRegex, (match, content) => {
        return data.headers!.map(header => content.replace(/{{this}}/g, header)).join('');
      });
    }

    // Process {{#each data}} blocks
    const dataRegex = /{{#each\s+data}}([\s\S]*?){{\/each}}/g;
    processed = processed.replace(dataRegex, (match, content) => {
      return data.data.map((item, index) => {
        let itemContent = content;

        // Replace {{this}} for simple arrays
        if (Array.isArray(item)) {
          const thisRegex = /{{#each\s+this}}([\s\S]*?){{\/each}}/g;
          itemContent = itemContent.replace(thisRegex, (innerMatch, innerContent) => {
            return item.map(value => innerContent.replace(/{{this}}/g, this.escapeHtml(value))).join('');
          });
        } else if (typeof item === 'object') {
          // Replace {{#each this}} for objects
          const thisRegex = /{{#each\s+this}}([\s\S]*?){{\/each}}/g;
          itemContent = itemContent.replace(thisRegex, (innerMatch, innerContent) => {
            return Object.entries(item).map(([key, value]) => {
              return innerContent
                .replace(/{{@key}}/g, key)
                .replace(/{{this}}/g, this.escapeHtml(value));
            }).join('');
          });
        }

        return itemContent;
      }).join('');
    });

    return processed;
  }

  /**
   * Determine if table format is appropriate
   */
  private shouldUseTableFormat(data: any[], options: PdfExportOptions): boolean {
    if (data.length === 0) return false;

    // Check if custom option is set
    if (options.customOptions?.layout === 'cards') return false;
    if (options.customOptions?.layout === 'table') return true;

    // Auto-determine based on data structure
    const firstRecord = data[0];
    const fieldCount = Object.keys(firstRecord).length;

    // Use table format for records with fewer fields (better fit)
    return fieldCount <= 8;
  }

  /**
   * Format data for display based on format type
   */
  private formatDataForDisplay(data: any[], options: PdfExportOptions, isTableFormat: boolean): any[] {
    if (isTableFormat) {
      // For table format, convert to array of arrays
      const headers = options.fields || (data.length > 0 ? Object.keys(data[0]) : []);
      return data.map(record =>
        headers.map(field => this.formatFieldValue(record[field]))
      );
    } else {
      // For card format, keep as objects but format values
      return data.map(record => {
        const formatted: any = {};
        Object.entries(record).forEach(([key, value]) => {
          formatted[key] = this.formatFieldValue(value);
        });
        return formatted;
      });
    }
  }

  /**
   * Format individual field values for display
   */
  private formatFieldValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toLocaleDateString();
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
      return value.toLocaleString();
    }

    return String(value);
  }

  /**
   * Generate filters summary text
   */
  private generateFiltersText(filters?: Record<string, any>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'None';
    }

    return Object.entries(filters)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }

  /**
   * Generate document title
   */
  private generateTitle(options: PdfExportOptions): string {
    if (options.customOptions?.title) {
      return options.customOptions.title;
    }

    const resourceType = options.resourceType || 'Data';
    return `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} Export Report`;
  }

  /**
   * Configure PDF generation options
   */
  private configurePdfOptions(options: PdfExportOptions): PDFOptions {
    const pdfOptions: PDFOptions = {
      format: (options.pageFormat as any) || 'A4',
      landscape: options.orientation === 'landscape',
      printBackground: options.printBackground !== false,
      margin: options.margins || {
        top: '2cm',
        right: '1.5cm',
        bottom: '2cm',
        left: '1.5cm'
      },
      displayHeaderFooter: options.displayHeaderFooter || false,
      preferCSSPageSize: options.preferCSSPageSize || false,
      timeout: 30000
    };

    if (options.scale && options.scale >= 0.1 && options.scale <= 2) {
      pdfOptions.scale = options.scale;
    }

    if (options.pageRanges) {
      pdfOptions.pageRanges = options.pageRanges;
    }

    return pdfOptions;
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: any): string {
    if (typeof text !== 'string') {
      text = String(text);
    }

    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, (m: string) => map[m]);
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
      } catch (error) {
        // Browser might already be closed
      }
    }
  }

  /**
   * Health check for browser
   */
  async healthCheck(): Promise<boolean> {
    try {
      const browser = await this.initializeBrowser();
      const page = await browser.newPage();
      await page.close();
      return true;
    } catch (error) {
      return false;
    }
  }
}