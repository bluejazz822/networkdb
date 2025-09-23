/**
 * PDF Generator
 * Template-based PDF generation using Puppeteer with advanced formatting,
 * custom styling, and optimized rendering for reports
 */

import puppeteer, { Browser, Page, PDFOptions } from 'puppeteer';
import { EventEmitter } from 'events';
import { ExportFormat } from '../../types/export';
import {
  IFormatGenerator,
  FormatGeneratorOptions,
  FormatGeneratorResult,
  FormatGeneratorConfig
} from '../formatters/ReportFormatters';
import winston from 'winston';
import path from 'path';
import { promises as fs } from 'fs';

// Logger for PDF generation
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'PDFGenerator' }),
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

export interface PDFGeneratorOptions {
  format?: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  headerTemplate?: string;
  footerTemplate?: string;
  displayHeaderFooter?: boolean;
  printBackground?: boolean;
  scale?: number;
  quality?: number;
  preferCSSPageSize?: boolean;
  timeout?: number;
  waitForSelector?: string;
  waitForTimeout?: number;
  customCSS?: string;
  pageBreaks?: {
    avoid?: string[];
    before?: string[];
    after?: string[];
  };
  watermark?: {
    text?: string;
    image?: string;
    opacity?: number;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  };
}

export interface PDFRenderContext {
  html: string;
  css?: string;
  data?: any;
  options: PDFGeneratorOptions;
}

export class PDFGenerator extends EventEmitter implements IFormatGenerator {
  readonly format = ExportFormat.PDF;
  readonly supportedMimeTypes = ['application/pdf'];
  readonly defaultConfig: FormatGeneratorConfig = {
    maxFileSize: 200 * 1024 * 1024, // 200MB
    quality: 80,
    encoding: 'binary',
    memoryLimit: 512 * 1024 * 1024, // 512MB
    streamingThreshold: 1000,
    compressionLevel: 6
  };

  private browser?: Browser;
  private browserInitPromise?: Promise<Browser>;
  private defaultPDFOptions: PDFOptions;
  private defaultPDFGeneratorOptions: PDFGeneratorOptions;

  constructor() {
    super();

    this.defaultPDFOptions = {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    };

    this.defaultPDFGeneratorOptions = {
      format: 'A4',
      orientation: 'portrait',
      printBackground: true,
      scale: 1.0,
      quality: 80,
      timeout: 30000,
      waitForTimeout: 2000,
      displayHeaderFooter: false
    };

    // Initialize browser lazily
    this.initializeBrowser();
  }

  async generate(options: FormatGeneratorOptions): Promise<FormatGeneratorResult> {
    const startTime = Date.now();

    try {
      this.validateOptions(options);

      this.emit('generation:started', { format: this.format });

      // Extract HTML content from template
      const htmlContent = options.templateData.output;
      if (!htmlContent) {
        throw new Error('No HTML content available for PDF generation');
      }

      // Merge PDF options
      const pdfOptions = this.mergePDFOptions(options.customOptions?.pdf || {});

      // Build complete HTML document
      const renderContext: PDFRenderContext = {
        html: htmlContent,
        css: options.customOptions?.css,
        data: options.templateData.context.data,
        options: pdfOptions
      };

      // Generate PDF
      options.progressCallback?.(20, 'Initializing PDF renderer...');
      const pdf = await this.renderPDF(renderContext, options.progressCallback);

      const processingTime = Date.now() - startTime;

      this.emit('generation:completed', {
        format: this.format,
        size: pdf.length,
        pages: await this.extractPDFMetadata(pdf),
        processingTime
      });

      return {
        success: true,
        buffer: pdf,
        metadata: {
          format: this.format,
          size: pdf.length,
          mimeType: this.supportedMimeTypes[0],
          pages: await this.extractPDFMetadata(pdf),
          records: Array.isArray(options.templateData.context.data) ? options.templateData.context.data.length : 1,
          generatedAt: new Date(),
          processingTime
        }
      };
    } catch (error) {
      this.emit('generation:failed', { format: this.format, error });
      logger.error('PDF generation failed:', error);

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

  private async renderPDF(context: PDFRenderContext, progressCallback?: (progress: number, message: string) => void): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      progressCallback?.(30, 'Setting up PDF page...');

      // Set viewport for consistent rendering
      await page.setViewport({
        width: context.options.format === 'A4' ? 794 : 816,
        height: context.options.format === 'A4' ? 1123 : 1056,
        deviceScaleFactor: context.options.scale || 1
      });

      // Build complete HTML document
      const completeHTML = this.buildCompleteHTML(context);

      progressCallback?.(50, 'Loading content into browser...');

      // Load HTML content
      await page.setContent(completeHTML, {
        waitUntil: 'networkidle0',
        timeout: context.options.timeout || 30000
      });

      // Wait for any dynamic content
      if (context.options.waitForSelector) {
        progressCallback?.(60, 'Waiting for dynamic content...');
        await page.waitForSelector(context.options.waitForSelector, {
          timeout: context.options.timeout || 30000
        });
      } else if (context.options.waitForTimeout) {
        await page.waitForTimeout(context.options.waitForTimeout);
      }

      progressCallback?.(80, 'Generating PDF...');

      // Generate PDF with merged options
      const pdfBuffer = await page.pdf({
        ...this.defaultPDFOptions,
        format: context.options.format as any,
        landscape: context.options.orientation === 'landscape',
        margin: context.options.margin || this.defaultPDFOptions.margin,
        printBackground: context.options.printBackground ?? true,
        preferCSSPageSize: context.options.preferCSSPageSize ?? false,
        displayHeaderFooter: context.options.displayHeaderFooter ?? false,
        headerTemplate: context.options.headerTemplate || '',
        footerTemplate: context.options.footerTemplate || ''
      });

      progressCallback?.(100, 'PDF generation completed');

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  private buildCompleteHTML(context: PDFRenderContext): string {
    // Build CSS
    let styles = this.getDefaultCSS();

    if (context.css) {
      styles += `\n${context.css}`;
    }

    if (context.options.customCSS) {
      styles += `\n${context.options.customCSS}`;
    }

    // Add page break styles
    if (context.options.pageBreaks) {
      styles += this.buildPageBreakCSS(context.options.pageBreaks);
    }

    // Add watermark styles
    if (context.options.watermark) {
      styles += this.buildWatermarkCSS(context.options.watermark);
    }

    // Build complete HTML document
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report</title>
    <style>
        ${styles}
    </style>
</head>
<body>
    ${context.options.watermark ? this.buildWatermarkHTML(context.options.watermark) : ''}
    <div class="report-content">
        ${context.html}
    </div>
</body>
</html>`;

    return html;
  }

  private getDefaultCSS(): string {
    return `
        /* Default PDF styles */
        * {
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 0;
            background: #fff;
        }

        .report-content {
            position: relative;
            z-index: 1;
        }

        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }

        h1 { font-size: 24px; }
        h2 { font-size: 20px; }
        h3 { font-size: 16px; }
        h4 { font-size: 14px; }
        h5 { font-size: 12px; }
        h6 { font-size: 11px; }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1em;
            page-break-inside: avoid;
        }

        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }

        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }

        tr:nth-child(even) {
            background-color: #f8f9fa;
        }

        .page-break {
            page-break-before: always;
        }

        .avoid-break {
            page-break-inside: avoid;
        }

        .chart-container {
            page-break-inside: avoid;
            margin: 1em 0;
        }

        .metadata {
            font-size: 10px;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
            padding-top: 0.5em;
            margin-top: 2em;
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    `;
  }

  private buildPageBreakCSS(pageBreaks: PDFGeneratorOptions['pageBreaks']): string {
    let css = '';

    if (pageBreaks?.avoid) {
      pageBreaks.avoid.forEach(selector => {
        css += `\n${selector} { page-break-inside: avoid; }`;
      });
    }

    if (pageBreaks?.before) {
      pageBreaks.before.forEach(selector => {
        css += `\n${selector} { page-break-before: always; }`;
      });
    }

    if (pageBreaks?.after) {
      pageBreaks.after.forEach(selector => {
        css += `\n${selector} { page-break-after: always; }`;
      });
    }

    return css;
  }

  private buildWatermarkCSS(watermark: PDFGeneratorOptions['watermark']): string {
    const opacity = watermark?.opacity || 0.1;
    const position = watermark?.position || 'center';

    let positionCSS = 'top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg);';

    switch (position) {
      case 'top-left':
        positionCSS = 'top: 20px; left: 20px; transform: rotate(-45deg);';
        break;
      case 'top-right':
        positionCSS = 'top: 20px; right: 20px; transform: rotate(-45deg);';
        break;
      case 'bottom-left':
        positionCSS = 'bottom: 20px; left: 20px; transform: rotate(-45deg);';
        break;
      case 'bottom-right':
        positionCSS = 'bottom: 20px; right: 20px; transform: rotate(-45deg);';
        break;
    }

    return `
        .watermark {
            position: fixed;
            ${positionCSS}
            opacity: ${opacity};
            font-size: 48px;
            font-weight: bold;
            color: #ccc;
            z-index: 0;
            pointer-events: none;
            user-select: none;
        }
    `;
  }

  private buildWatermarkHTML(watermark: PDFGeneratorOptions['watermark']): string {
    if (watermark?.text) {
      return `<div class="watermark">${watermark.text}</div>`;
    }

    if (watermark?.image) {
      return `<div class="watermark"><img src="${watermark.image}" alt="Watermark" style="max-width: 200px; max-height: 200px;"></div>`;
    }

    return '';
  }

  private mergePDFOptions(customOptions: any): PDFGeneratorOptions {
    return {
      ...this.defaultPDFGeneratorOptions,
      ...customOptions
    };
  }

  private async extractPDFMetadata(pdfBuffer: Buffer): Promise<number> {
    // Simple page count extraction - count page objects in PDF
    const pdfString = pdfBuffer.toString('binary');
    const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
    return pageMatches ? pageMatches.length : 1;
  }

  private async initializeBrowser(): void {
    if (this.browserInitPromise) {
      return this.browserInitPromise;
    }

    this.browserInitPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    }).then(browser => {
      this.browser = browser;
      logger.info('PDF browser initialized');
      return browser;
    }).catch(error => {
      logger.error('Failed to initialize PDF browser:', error);
      throw error;
    });

    return this.browserInitPromise;
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      await this.initializeBrowser();
    }
    return this.browser!;
  }

  validateOptions(options: FormatGeneratorOptions): void {
    if (!options.templateData || !options.templateData.output) {
      throw new Error('Template data with HTML output is required for PDF generation');
    }

    if (!options.exportOptions) {
      throw new Error('Export options are required');
    }

    // Validate PDF-specific options
    const pdfOptions = options.customOptions?.pdf;
    if (pdfOptions?.format && !['A4', 'Letter', 'Legal', 'A3', 'A5'].includes(pdfOptions.format)) {
      throw new Error(`Invalid PDF format: ${pdfOptions.format}`);
    }

    if (pdfOptions?.orientation && !['portrait', 'landscape'].includes(pdfOptions.orientation)) {
      throw new Error(`Invalid PDF orientation: ${pdfOptions.orientation}`);
    }
  }

  estimateOutputSize(recordCount: number, fieldCount: number): number {
    // PDF files are typically 2-5x larger than HTML due to formatting and compression
    const baseSize = recordCount * fieldCount * 100; // Base HTML size estimate
    const pdfOverhead = 1.5; // PDF compression factor
    const fixedOverhead = 50 * 1024; // 50KB fixed overhead for PDF structure

    return Math.ceil((baseSize * pdfOverhead) + fixedOverhead);
  }

  supportsStreaming(): boolean {
    return false; // PDF generation requires complete HTML content
  }

  getCompressionOptions(): Record<string, any> {
    return {
      level: this.defaultConfig.compressionLevel,
      algorithm: 'deflate' // PDFs use internal compression
    };
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.browserInitPromise = undefined;
      logger.info('PDF browser shut down');
    }
  }
}

export default PDFGenerator;