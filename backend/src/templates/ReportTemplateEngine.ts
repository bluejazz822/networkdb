/**
 * Report Template Engine
 * Core template engine for dynamic report generation using Handlebars
 * Supports template inheritance, composition, data binding, and formatting
 */

import Handlebars from 'handlebars';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Logger for template engine
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'ReportTemplateEngine' }),
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

// Template metadata and structure
export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  format: 'HTML' | 'JSON' | 'TEXT' | 'MARKDOWN';
  category: string;
  parentTemplateId?: string;
  template: string;
  partials?: Record<string, string>;
  helpers?: Record<string, any>;
  metadata: {
    author?: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    isPublic: boolean;
    reportTypes: string[];
    defaultOptions?: Record<string, any>;
  };
  validation?: {
    requiredFields: string[];
    dataSchema?: any;
  };
}

export interface TemplateCompilationResult {
  templateId: string;
  compiled: HandlebarsTemplateDelegate<any>;
  partials: Record<string, HandlebarsTemplateDelegate<any>>;
  helpers: Record<string, Handlebars.HelperDelegate>;
  metadata: ReportTemplate['metadata'];
}

export interface TemplateRenderContext {
  data: any;
  options?: {
    timezone?: string;
    locale?: string;
    dateFormat?: string;
    numberFormat?: string;
    customHelpers?: Record<string, any>;
    theme?: string;
  };
  metadata?: {
    reportTitle?: string;
    reportDate?: Date;
    generatedBy?: string;
    version?: string;
  };
}

export interface TemplateRenderResult {
  output: string;
  metadata: {
    templateId: string;
    renderTime: number;
    dataSize: number;
    outputSize: number;
    timestamp: Date;
  };
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Report Template Engine
 *
 * Provides comprehensive template management with Handlebars integration,
 * template inheritance, custom helpers, and advanced formatting capabilities.
 */
export class ReportTemplateEngine extends EventEmitter {
  private compiledTemplates = new Map<string, TemplateCompilationResult>();
  private templateRegistry = new Map<string, ReportTemplate>();
  private isInitialized = false;

  constructor() {
    super();
    this.setupDefaultHelpers();
  }

  /**
   * Initialize the template engine
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Template engine already initialized');
      return;
    }

    try {
      logger.info('Initializing template engine...');

      // Register built-in partials and helpers
      this.registerBuiltInPartials();
      this.registerBuiltInHelpers();

      this.isInitialized = true;
      logger.info('Template engine initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize template engine', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  // ===================== TEMPLATE MANAGEMENT =====================

  /**
   * Register a new template
   */
  public registerTemplate(template: ReportTemplate): void {
    this.validateTemplate(template);

    // Store template
    this.templateRegistry.set(template.id, {
      ...template,
      metadata: {
        ...template.metadata,
        updatedAt: new Date(),
      },
    });

    // Clear compiled cache if exists
    this.compiledTemplates.delete(template.id);

    logger.debug('Template registered', {
      templateId: template.id,
      name: template.name,
      format: template.format,
    });
  }

  /**
   * Get template by ID
   */
  public getTemplate(templateId: string): ReportTemplate | null {
    return this.templateRegistry.get(templateId) || null;
  }

  /**
   * Get all templates
   */
  public getAllTemplates(): ReportTemplate[] {
    return Array.from(this.templateRegistry.values());
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: string): ReportTemplate[] {
    return this.getAllTemplates().filter(template => template.category === category);
  }

  /**
   * Get templates by format
   */
  public getTemplatesByFormat(format: ReportTemplate['format']): ReportTemplate[] {
    return this.getAllTemplates().filter(template => template.format === format);
  }

  /**
   * Update template
   */
  public updateTemplate(templateId: string, updates: Partial<ReportTemplate>): boolean {
    const existing = this.templateRegistry.get(templateId);
    if (!existing) {
      return false;
    }

    const updated: ReportTemplate = {
      ...existing,
      ...updates,
      id: templateId, // Prevent ID changes
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
      },
    };

    this.validateTemplate(updated);
    this.templateRegistry.set(templateId, updated);
    this.compiledTemplates.delete(templateId);

    logger.debug('Template updated', { templateId, updates: Object.keys(updates) });
    return true;
  }

  /**
   * Remove template
   */
  public removeTemplate(templateId: string): boolean {
    const removed = this.templateRegistry.delete(templateId);
    this.compiledTemplates.delete(templateId);

    if (removed) {
      logger.debug('Template removed', { templateId });
    }

    return removed;
  }

  // ===================== TEMPLATE COMPILATION =====================

  /**
   * Compile template for rendering
   */
  public async compileTemplate(templateId: string): Promise<TemplateCompilationResult> {
    // Check cache first
    const cached = this.compiledTemplates.get(templateId);
    if (cached) {
      return cached;
    }

    const template = this.templateRegistry.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    try {
      // Handle template inheritance
      const resolvedTemplate = await this.resolveTemplateInheritance(template);

      // Compile main template
      const compiled = Handlebars.compile(resolvedTemplate.template, {
        noEscape: template.format === 'HTML' ? false : true,
        strict: false,
      });

      // Compile partials
      const partials: Record<string, HandlebarsTemplateDelegate<any>> = {};
      if (resolvedTemplate.partials) {
        for (const [name, partial] of Object.entries(resolvedTemplate.partials)) {
          partials[name] = Handlebars.compile(partial);
        }
      }

      // Prepare helpers (merge template helpers with global ones)
      const helpers: Record<string, Handlebars.HelperDelegate> = {
        ...resolvedTemplate.helpers || {},
      };

      const result: TemplateCompilationResult = {
        templateId,
        compiled,
        partials,
        helpers,
        metadata: template.metadata,
      };

      // Cache the result
      this.compiledTemplates.set(templateId, result);

      logger.debug('Template compiled successfully', { templateId });
      return result;

    } catch (error) {
      logger.error('Template compilation failed', {
        templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to compile template ${templateId}: ${error.message}`);
    }
  }

  // ===================== TEMPLATE RENDERING =====================

  /**
   * Render template with data
   */
  public async renderTemplate(
    templateId: string,
    context: TemplateRenderContext
  ): Promise<TemplateRenderResult> {
    const startTime = Date.now();

    try {
      // Compile template
      const compilation = await this.compileTemplate(templateId);

      // Register template-specific partials and helpers
      this.registerTemplatePartials(compilation.partials);
      this.registerTemplateHelpers(compilation.helpers);

      // Prepare render context
      const renderContext = this.prepareRenderContext(context, compilation.metadata);

      // Render template
      const output = compilation.compiled(renderContext);

      const renderTime = Date.now() - startTime;
      const result: TemplateRenderResult = {
        output,
        metadata: {
          templateId,
          renderTime,
          dataSize: JSON.stringify(context.data).length,
          outputSize: output.length,
          timestamp: new Date(),
        },
      };

      logger.debug('Template rendered successfully', {
        templateId,
        renderTime,
        outputSize: result.metadata.outputSize,
      });

      return result;

    } catch (error) {
      logger.error('Template rendering failed', {
        templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
        renderTime: Date.now() - startTime,
      });
      throw new Error(`Failed to render template ${templateId}: ${error.message}`);
    }
  }

  // ===================== TEMPLATE VALIDATION =====================

  /**
   * Validate template syntax and structure
   */
  public validateTemplate(template: ReportTemplate): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!template.id || template.id.trim() === '') {
      errors.push('Template ID is required');
    }

    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required');
    }

    if (!template.template || template.template.trim() === '') {
      errors.push('Template content is required');
    }

    if (!template.format) {
      errors.push('Template format is required');
    }

    // Syntax validation
    if (template.template) {
      try {
        Handlebars.compile(template.template);
      } catch (error) {
        errors.push(`Template syntax error: ${error.message}`);
      }
    }

    // Validate partials
    if (template.partials) {
      for (const [name, partial] of Object.entries(template.partials)) {
        try {
          Handlebars.compile(partial);
        } catch (error) {
          errors.push(`Partial "${name}" syntax error: ${error.message}`);
        }
      }
    }

    // Inheritance validation
    if (template.parentTemplateId) {
      const parent = this.templateRegistry.get(template.parentTemplateId);
      if (!parent) {
        errors.push(`Parent template not found: ${template.parentTemplateId}`);
      } else if (parent.format !== template.format) {
        warnings.push('Parent template has different format');
      }
    }

    // Performance suggestions
    if (template.template.length > 50000) {
      suggestions.push('Template is very large, consider breaking into partials');
    }

    const complexHelpers = template.template.match(/\{\{#.*?\}\}/g);
    if (complexHelpers && complexHelpers.length > 20) {
      suggestions.push('Template has many helpers, consider optimizing for performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate template data against expected schema
   */
  public validateTemplateData(templateId: string, data: any): TemplateValidationResult {
    const template = this.templateRegistry.get(templateId);
    if (!template) {
      return {
        isValid: false,
        errors: [`Template not found: ${templateId}`],
        warnings: [],
        suggestions: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check required fields
    if (template.validation?.requiredFields) {
      for (const field of template.validation.requiredFields) {
        if (data[field] === undefined || data[field] === null) {
          errors.push(`Required field missing: ${field}`);
        }
      }
    }

    // Data type validation
    if (typeof data !== 'object' || data === null) {
      errors.push('Template data must be an object');
    }

    // Size warnings
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 1000000) { // 1MB
      warnings.push('Data is very large, rendering may be slow');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  // ===================== TEMPLATE INHERITANCE =====================

  /**
   * Resolve template inheritance chain
   */
  private async resolveTemplateInheritance(template: ReportTemplate): Promise<ReportTemplate> {
    if (!template.parentTemplateId) {
      return template;
    }

    const parent = this.templateRegistry.get(template.parentTemplateId);
    if (!parent) {
      throw new Error(`Parent template not found: ${template.parentTemplateId}`);
    }

    // Recursively resolve parent inheritance
    const resolvedParent = await this.resolveTemplateInheritance(parent);

    // Merge templates (child overrides parent)
    return {
      ...resolvedParent,
      ...template,
      partials: {
        ...resolvedParent.partials || {},
        ...template.partials || {},
      },
      helpers: {
        ...resolvedParent.helpers || {},
        ...template.helpers || {},
      },
      metadata: {
        ...resolvedParent.metadata,
        ...template.metadata,
      },
    };
  }

  // ===================== HELPER MANAGEMENT =====================

  /**
   * Register built-in Handlebars helpers
   */
  private registerBuiltInHelpers(): void {
    // Date formatting helpers
    Handlebars.registerHelper('formatDate', (date: Date | string, format = 'YYYY-MM-DD') => {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (!d || isNaN(d.getTime())) return '';

      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    });

    Handlebars.registerHelper('formatDateTime', (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (!d || isNaN(d.getTime())) return '';

      return d.toLocaleString();
    });

    // Number formatting helpers
    Handlebars.registerHelper('formatNumber', (num: number, decimals = 2) => {
      if (typeof num !== 'number' || isNaN(num)) return '0';
      return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    });

    Handlebars.registerHelper('formatCurrency', (amount: number, currency = 'USD') => {
      if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    });

    // String helpers
    Handlebars.registerHelper('uppercase', (str: string) => {
      return typeof str === 'string' ? str.toUpperCase() : '';
    });

    Handlebars.registerHelper('lowercase', (str: string) => {
      return typeof str === 'string' ? str.toLowerCase() : '';
    });

    Handlebars.registerHelper('truncate', (str: string, length = 50) => {
      if (typeof str !== 'string') return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });

    // Comparison helpers
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    Handlebars.registerHelper('gte', (a: any, b: any) => a >= b);
    Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    Handlebars.registerHelper('lte', (a: any, b: any) => a <= b);

    // Array helpers
    Handlebars.registerHelper('length', (array: any[]) => {
      return Array.isArray(array) ? array.length : 0;
    });

    Handlebars.registerHelper('sum', (array: number[]) => {
      if (!Array.isArray(array)) return 0;
      return array.reduce((sum, num) => sum + (typeof num === 'number' ? num : 0), 0);
    });

    Handlebars.registerHelper('avg', (array: number[]) => {
      if (!Array.isArray(array) || array.length === 0) return 0;
      const sum = array.reduce((sum, num) => sum + (typeof num === 'number' ? num : 0), 0);
      return sum / array.length;
    });

    // Conditional helpers
    Handlebars.registerHelper('ifCond', function(v1: any, operator: string, v2: any, options: any) {
      switch (operator) {
        case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        default: return options.inverse(this);
      }
    });
  }

  /**
   * Register built-in partials
   */
  private registerBuiltInPartials(): void {
    // Table header partial
    Handlebars.registerPartial('tableHeader', `
      <thead>
        <tr>
          {{#each columns}}
            <th>{{this}}</th>
          {{/each}}
        </tr>
      </thead>
    `);

    // Table row partial
    Handlebars.registerPartial('tableRow', `
      <tr>
        {{#each this}}
          <td>{{this}}</td>
        {{/each}}
      </tr>
    `);

    // Report metadata partial
    Handlebars.registerPartial('reportMetadata', `
      <div class="report-metadata">
        <h1>{{reportTitle}}</h1>
        <p>Generated on: {{formatDateTime reportDate}}</p>
        {{#if generatedBy}}<p>Generated by: {{generatedBy}}</p>{{/if}}
        {{#if version}}<p>Version: {{version}}</p>{{/if}}
      </div>
    `);
  }

  // ===================== UTILITY METHODS =====================

  /**
   * Setup default configuration
   */
  private setupDefaultHelpers(): void {
    // This will be called during construction
    // Additional setup can be done here
  }

  /**
   * Register template-specific partials
   */
  private registerTemplatePartials(partials: Record<string, HandlebarsTemplateDelegate<any>>): void {
    for (const [name, template] of Object.entries(partials)) {
      Handlebars.registerPartial(name, template);
    }
  }

  /**
   * Register template-specific helpers
   */
  private registerTemplateHelpers(helpers: Record<string, Handlebars.HelperDelegate>): void {
    for (const [name, helper] of Object.entries(helpers)) {
      Handlebars.registerHelper(name, helper);
    }
  }

  /**
   * Prepare render context with metadata and options
   */
  private prepareRenderContext(context: TemplateRenderContext, templateMetadata: ReportTemplate['metadata']): any {
    return {
      ...context.data,
      _meta: {
        reportTitle: context.metadata?.reportTitle || 'Report',
        reportDate: context.metadata?.reportDate || new Date(),
        generatedBy: context.metadata?.generatedBy || 'System',
        version: context.metadata?.version || templateMetadata.tags.join(', '),
        timezone: context.options?.timezone || 'UTC',
        locale: context.options?.locale || 'en-US',
        theme: context.options?.theme || 'default',
      },
      _options: context.options || {},
    };
  }

  /**
   * Get engine statistics
   */
  public getStatistics(): {
    registeredTemplates: number;
    compiledTemplates: number;
    categories: string[];
    formats: string[];
  } {
    const templates = this.getAllTemplates();

    return {
      registeredTemplates: templates.length,
      compiledTemplates: this.compiledTemplates.size,
      categories: [...new Set(templates.map(t => t.category))],
      formats: [...new Set(templates.map(t => t.format))],
    };
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.compiledTemplates.clear();
    logger.debug('Template cache cleared');
  }

  /**
   * Shutdown the engine
   */
  public async shutdown(): Promise<void> {
    this.clearCache();
    this.templateRegistry.clear();
    this.isInitialized = false;
    logger.info('Template engine shutdown complete');
  }
}

// Export singleton instance
export const reportTemplateEngine = new ReportTemplateEngine();

// Convenience functions
export const initializeTemplateEngine = async (): Promise<void> => {
  return reportTemplateEngine.initialize();
};

export const getTemplateEngine = (): ReportTemplateEngine => {
  return reportTemplateEngine;
};