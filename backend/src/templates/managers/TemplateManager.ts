/**
 * Template Manager
 * Comprehensive template management system with CRUD operations,
 * inheritance handling, versioning, and metadata management
 */

import { BaseService, ServiceResponse, PaginatedResponse, QueryOptions } from '../../services/BaseService';
import { ReportTemplate, ReportTemplateEngine, TemplateValidationResult } from '../ReportTemplateEngine';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Logger for template manager
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'TemplateManager' }),
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

// Template management interfaces
export interface TemplateSearchFilters {
  category?: string;
  format?: ReportTemplate['format'];
  isPublic?: boolean;
  author?: string;
  tags?: string[];
  reportTypes?: string[];
  parentTemplateId?: string;
  namePattern?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface TemplateCreateInput {
  name: string;
  description: string;
  format: ReportTemplate['format'];
  category: string;
  template: string;
  partials?: Record<string, string>;
  helpers?: Record<string, any>;
  parentTemplateId?: string;
  metadata?: {
    author?: string;
    tags?: string[];
    isPublic?: boolean;
    reportTypes?: string[];
    defaultOptions?: Record<string, any>;
  };
  validation?: {
    requiredFields?: string[];
    dataSchema?: any;
  };
}

export interface TemplateUpdateInput {
  name?: string;
  description?: string;
  template?: string;
  partials?: Record<string, string>;
  helpers?: Record<string, any>;
  parentTemplateId?: string;
  metadata?: Partial<ReportTemplate['metadata']>;
  validation?: {
    requiredFields?: string[];
    dataSchema?: any;
  };
}

export interface TemplateCloneOptions {
  newName?: string;
  newCategory?: string;
  removeParentRelation?: boolean;
  updateAuthor?: string;
  makePrivate?: boolean;
}

export interface TemplateVersionInfo {
  templateId: string;
  version: string;
  checksum: string;
  createdAt: Date;
  author?: string;
  changeDescription?: string;
}

export interface TemplateInheritanceTree {
  template: ReportTemplate;
  children: TemplateInheritanceTree[];
  depth: number;
}

export interface TemplateUsageStats {
  templateId: string;
  usageCount: number;
  lastUsed?: Date;
  topUsers: { userId: string; count: number }[];
  recentUsage: { date: Date; count: number }[];
}

/**
 * Template Manager
 *
 * Comprehensive template management service providing CRUD operations,
 * inheritance management, versioning, and template organization.
 */
export class TemplateManager extends BaseService<ReportTemplate, any> {
  private templateEngine: ReportTemplateEngine;
  private isInitialized = false;
  private templateVersions = new Map<string, TemplateVersionInfo[]>();
  private templateUsage = new Map<string, TemplateUsageStats>();

  constructor(templateEngine: ReportTemplateEngine) {
    // TemplateManager doesn't use a traditional repository
    super(null as any);
    this.templateEngine = templateEngine;
  }

  /**
   * Initialize the template manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Template manager already initialized');
      return;
    }

    try {
      logger.info('Initializing template manager...');

      // Initialize template engine if not already done
      await this.templateEngine.initialize();

      // Load default templates
      await this.loadDefaultTemplates();

      this.isInitialized = true;
      logger.info('Template manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize template manager', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  // ===================== TEMPLATE CRUD OPERATIONS =====================

  /**
   * Create a new template
   */
  public async create(data: TemplateCreateInput, userId?: string): Promise<ServiceResponse<ReportTemplate>> {
    await this.ensureInitialized();

    try {
      logger.debug('Creating new template', { name: data.name, format: data.format });

      // Generate template ID and version
      const templateId = this.generateTemplateId(data.name);
      const version = '1.0.0';

      // Create template object
      const template: ReportTemplate = {
        id: templateId,
        name: data.name,
        description: data.description,
        version,
        format: data.format,
        category: data.category,
        parentTemplateId: data.parentTemplateId,
        template: data.template,
        partials: data.partials,
        helpers: data.helpers,
        metadata: {
          author: data.metadata?.author || userId || 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: data.metadata?.tags || [],
          isPublic: data.metadata?.isPublic ?? false,
          reportTypes: data.metadata?.reportTypes || [],
          defaultOptions: data.metadata?.defaultOptions,
        },
        validation: data.validation,
      };

      // Validate template
      const validation = this.templateEngine.validateTemplate(template);
      if (!validation.isValid) {
        return this.createErrorResponse(
          validation.errors.map(error => ({
            code: 'TEMPLATE_VALIDATION_ERROR',
            message: error,
          }))
        );
      }

      // Check for name conflicts
      const existing = this.findTemplateByName(data.name);
      if (existing) {
        return this.createSingleErrorResponse(
          'TEMPLATE_NAME_EXISTS',
          `Template with name "${data.name}" already exists`
        );
      }

      // Validate parent template if specified
      if (data.parentTemplateId) {
        const parent = this.templateEngine.getTemplate(data.parentTemplateId);
        if (!parent) {
          return this.createSingleErrorResponse(
            'PARENT_TEMPLATE_NOT_FOUND',
            `Parent template not found: ${data.parentTemplateId}`
          );
        }

        if (parent.format !== data.format) {
          return this.createSingleErrorResponse(
            'PARENT_FORMAT_MISMATCH',
            'Parent template must have the same format'
          );
        }
      }

      // Register template with engine
      this.templateEngine.registerTemplate(template);

      // Create version record
      this.createVersionRecord(template, 'Initial version');

      // Initialize usage stats
      this.templateUsage.set(templateId, {
        templateId,
        usageCount: 0,
        topUsers: [],
        recentUsage: [],
      });

      logger.info('Template created successfully', {
        templateId,
        name: data.name,
        author: template.metadata.author,
      });

      return this.createSuccessResponse(template, 'Template created successfully');

    } catch (error) {
      logger.error('Failed to create template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name: data.name,
      });

      return this.createSingleErrorResponse(
        'TEMPLATE_CREATION_ERROR',
        'Failed to create template',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Find template by ID
   */
  public async findById(id: string): Promise<ServiceResponse<ReportTemplate>> {
    await this.ensureInitialized();

    try {
      const template = this.templateEngine.getTemplate(id);

      if (!template) {
        return this.createSingleErrorResponse(
          'TEMPLATE_NOT_FOUND',
          `Template not found: ${id}`
        );
      }

      return this.createSuccessResponse(template, 'Template retrieved successfully');

    } catch (error) {
      logger.error('Failed to find template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId: id,
      });

      return this.createSingleErrorResponse(
        'TEMPLATE_RETRIEVAL_ERROR',
        'Failed to retrieve template',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Update template
   */
  public async update(id: string, data: TemplateUpdateInput, userId?: string): Promise<ServiceResponse<ReportTemplate>> {
    await this.ensureInitialized();

    try {
      logger.debug('Updating template', { templateId: id, updates: Object.keys(data) });

      const existing = this.templateEngine.getTemplate(id);
      if (!existing) {
        return this.createSingleErrorResponse(
          'TEMPLATE_NOT_FOUND',
          `Template not found: ${id}`
        );
      }

      // Create updated template
      const updates: Partial<ReportTemplate> = {
        ...data,
        metadata: {
          ...existing.metadata,
          ...data.metadata,
          updatedAt: new Date(),
        },
      };

      // Increment version
      if (data.template || data.partials || data.helpers) {
        updates.version = this.incrementVersion(existing.version);
      }

      // Validate parent template if changed
      if (data.parentTemplateId && data.parentTemplateId !== existing.parentTemplateId) {
        const parent = this.templateEngine.getTemplate(data.parentTemplateId);
        if (!parent) {
          return this.createSingleErrorResponse(
            'PARENT_TEMPLATE_NOT_FOUND',
            `Parent template not found: ${data.parentTemplateId}`
          );
        }

        if (parent.format !== existing.format) {
          return this.createSingleErrorResponse(
            'PARENT_FORMAT_MISMATCH',
            'Parent template must have the same format'
          );
        }
      }

      // Update template in engine
      const success = this.templateEngine.updateTemplate(id, updates);
      if (!success) {
        return this.createSingleErrorResponse(
          'TEMPLATE_UPDATE_ERROR',
          'Failed to update template in engine'
        );
      }

      const updatedTemplate = this.templateEngine.getTemplate(id)!;

      // Validate updated template
      const validation = this.templateEngine.validateTemplate(updatedTemplate);
      if (!validation.isValid) {
        // Rollback would be needed here in a real implementation
        return this.createErrorResponse(
          validation.errors.map(error => ({
            code: 'TEMPLATE_VALIDATION_ERROR',
            message: error,
          }))
        );
      }

      // Create version record if significant changes
      if (data.template || data.partials || data.helpers) {
        this.createVersionRecord(updatedTemplate, 'Template updated');
      }

      logger.info('Template updated successfully', {
        templateId: id,
        version: updatedTemplate.version,
        updatedBy: userId,
      });

      return this.createSuccessResponse(updatedTemplate, 'Template updated successfully');

    } catch (error) {
      logger.error('Failed to update template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId: id,
      });

      return this.createSingleErrorResponse(
        'TEMPLATE_UPDATE_ERROR',
        'Failed to update template',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Delete template
   */
  public async delete(id: string, userId?: string): Promise<ServiceResponse<boolean>> {
    await this.ensureInitialized();

    try {
      logger.debug('Deleting template', { templateId: id, userId });

      // Check if template exists
      const template = this.templateEngine.getTemplate(id);
      if (!template) {
        return this.createSingleErrorResponse(
          'TEMPLATE_NOT_FOUND',
          `Template not found: ${id}`
        );
      }

      // Check for dependent templates
      const dependents = this.findChildTemplates(id);
      if (dependents.length > 0) {
        return this.createSingleErrorResponse(
          'TEMPLATE_HAS_DEPENDENTS',
          `Cannot delete template with dependent templates: ${dependents.map(t => t.name).join(', ')}`
        );
      }

      // Remove from engine
      const success = this.templateEngine.removeTemplate(id);
      if (!success) {
        return this.createSingleErrorResponse(
          'TEMPLATE_DELETION_ERROR',
          'Failed to remove template from engine'
        );
      }

      // Clean up version history and usage stats
      this.templateVersions.delete(id);
      this.templateUsage.delete(id);

      logger.info('Template deleted successfully', {
        templateId: id,
        templateName: template.name,
        deletedBy: userId,
      });

      return this.createSuccessResponse(true, 'Template deleted successfully');

    } catch (error) {
      logger.error('Failed to delete template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId: id,
      });

      return this.createSingleErrorResponse(
        'TEMPLATE_DELETION_ERROR',
        'Failed to delete template',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Find all templates with pagination and filtering
   */
  public async findAll(options?: QueryOptions): Promise<ServiceResponse<PaginatedResponse<ReportTemplate>>> {
    await this.ensureInitialized();

    try {
      let templates = this.templateEngine.getAllTemplates();

      // Apply filters if provided
      if (options?.filters) {
        templates = this.applyFilters(templates, options.filters as TemplateSearchFilters);
      }

      // Apply sorting
      if (options?.sortBy) {
        templates = this.applySorting(templates, options.sortBy, options.sortOrder || 'ASC');
      }

      // Apply pagination
      const { page, limit, offset } = this.applyPagination(options || {});
      const paginatedTemplates = templates.slice(offset, offset + limit);

      const response = this.createPaginatedResponse(
        paginatedTemplates,
        templates.length,
        page,
        limit
      );

      return this.createSuccessResponse(response, 'Templates retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve templates', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options,
      });

      return this.createSingleErrorResponse(
        'TEMPLATE_RETRIEVAL_ERROR',
        'Failed to retrieve templates',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== TEMPLATE INHERITANCE MANAGEMENT =====================

  /**
   * Get template inheritance tree
   */
  public getInheritanceTree(templateId: string): ServiceResponse<TemplateInheritanceTree | null> {
    try {
      const template = this.templateEngine.getTemplate(templateId);
      if (!template) {
        return this.createSingleErrorResponse(
          'TEMPLATE_NOT_FOUND',
          `Template not found: ${templateId}`
        );
      }

      const tree = this.buildInheritanceTree(template, 0);
      return this.createSuccessResponse(tree, 'Inheritance tree retrieved successfully');

    } catch (error) {
      logger.error('Failed to get inheritance tree', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId,
      });

      return this.createSingleErrorResponse(
        'INHERITANCE_TREE_ERROR',
        'Failed to get inheritance tree',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Find child templates
   */
  public findChildTemplates(parentId: string): ReportTemplate[] {
    return this.templateEngine.getAllTemplates()
      .filter(template => template.parentTemplateId === parentId);
  }

  /**
   * Get inheritance chain (from child to root)
   */
  public getInheritanceChain(templateId: string): ServiceResponse<ReportTemplate[]> {
    try {
      const chain: ReportTemplate[] = [];
      let currentTemplate = this.templateEngine.getTemplate(templateId);

      if (!currentTemplate) {
        return this.createSingleErrorResponse(
          'TEMPLATE_NOT_FOUND',
          `Template not found: ${templateId}`
        );
      }

      // Build chain from child to root
      while (currentTemplate) {
        chain.push(currentTemplate);

        if (currentTemplate.parentTemplateId) {
          currentTemplate = this.templateEngine.getTemplate(currentTemplate.parentTemplateId);

          // Prevent infinite loops
          if (chain.some(t => t.id === currentTemplate?.id)) {
            return this.createSingleErrorResponse(
              'CIRCULAR_INHERITANCE',
              'Circular inheritance detected'
            );
          }
        } else {
          currentTemplate = null;
        }
      }

      return this.createSuccessResponse(chain, 'Inheritance chain retrieved successfully');

    } catch (error) {
      logger.error('Failed to get inheritance chain', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId,
      });

      return this.createSingleErrorResponse(
        'INHERITANCE_CHAIN_ERROR',
        'Failed to get inheritance chain',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== TEMPLATE OPERATIONS =====================

  /**
   * Clone template
   */
  public async cloneTemplate(
    templateId: string,
    options: TemplateCloneOptions,
    userId?: string
  ): Promise<ServiceResponse<ReportTemplate>> {
    await this.ensureInitialized();

    try {
      const original = this.templateEngine.getTemplate(templateId);
      if (!original) {
        return this.createSingleErrorResponse(
          'TEMPLATE_NOT_FOUND',
          `Template not found: ${templateId}`
        );
      }

      const cloneData: TemplateCreateInput = {
        name: options.newName || `${original.name} (Copy)`,
        description: `Clone of: ${original.description}`,
        format: original.format,
        category: options.newCategory || original.category,
        template: original.template,
        partials: original.partials ? { ...original.partials } : undefined,
        helpers: original.helpers ? { ...original.helpers } : undefined,
        parentTemplateId: options.removeParentRelation ? undefined : original.parentTemplateId,
        metadata: {
          author: options.updateAuthor || userId || original.metadata.author,
          tags: [...original.metadata.tags, 'cloned'],
          isPublic: options.makePrivate ? false : original.metadata.isPublic,
          reportTypes: [...original.metadata.reportTypes],
          defaultOptions: original.metadata.defaultOptions ?
            { ...original.metadata.defaultOptions } : undefined,
        },
        validation: original.validation ? {
          requiredFields: [...(original.validation.requiredFields || [])],
          dataSchema: original.validation.dataSchema,
        } : undefined,
      };

      return await this.create(cloneData, userId);

    } catch (error) {
      logger.error('Failed to clone template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId,
      });

      return this.createSingleErrorResponse(
        'TEMPLATE_CLONE_ERROR',
        'Failed to clone template',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Export template as JSON
   */
  public exportTemplate(templateId: string): ServiceResponse<string> {
    try {
      const template = this.templateEngine.getTemplate(templateId);
      if (!template) {
        return this.createSingleErrorResponse(
          'TEMPLATE_NOT_FOUND',
          `Template not found: ${templateId}`
        );
      }

      const exportData = {
        ...template,
        exportedAt: new Date(),
        exportedBy: 'TemplateManager',
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      return this.createSuccessResponse(jsonString, 'Template exported successfully');

    } catch (error) {
      logger.error('Failed to export template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId,
      });

      return this.createSingleErrorResponse(
        'TEMPLATE_EXPORT_ERROR',
        'Failed to export template',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Import template from JSON
   */
  public async importTemplate(jsonString: string, userId?: string): Promise<ServiceResponse<ReportTemplate>> {
    try {
      const importData = JSON.parse(jsonString);

      // Convert date strings back to Date objects
      if (typeof importData.metadata?.createdAt === 'string') {
        importData.metadata.createdAt = new Date(importData.metadata.createdAt);
      }
      if (typeof importData.metadata?.updatedAt === 'string') {
        importData.metadata.updatedAt = new Date(importData.metadata.updatedAt);
      }

      // Create template data
      const templateData: TemplateCreateInput = {
        name: importData.name,
        description: importData.description,
        format: importData.format,
        category: importData.category,
        template: importData.template,
        partials: importData.partials,
        helpers: importData.helpers,
        parentTemplateId: importData.parentTemplateId,
        metadata: {
          ...importData.metadata,
          author: userId || importData.metadata?.author || 'imported',
        },
        validation: importData.validation,
      };

      return await this.create(templateData, userId);

    } catch (error) {
      logger.error('Failed to import template', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.createSingleErrorResponse(
        'TEMPLATE_IMPORT_ERROR',
        'Failed to import template',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== TEMPLATE SEARCH AND FILTERING =====================

  /**
   * Search templates by various criteria
   */
  public async searchTemplates(
    filters: TemplateSearchFilters,
    options?: QueryOptions
  ): Promise<ServiceResponse<PaginatedResponse<ReportTemplate>>> {
    return this.findAll({
      ...options,
      filters: filters as any,
    });
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: string): ServiceResponse<ReportTemplate[]> {
    try {
      const templates = this.templateEngine.getTemplatesByCategory(category);
      return this.createSuccessResponse(templates, `Templates in category "${category}" retrieved successfully`);
    } catch (error) {
      return this.createSingleErrorResponse(
        'CATEGORY_RETRIEVAL_ERROR',
        'Failed to retrieve templates by category',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get templates by format
   */
  public getTemplatesByFormat(format: ReportTemplate['format']): ServiceResponse<ReportTemplate[]> {
    try {
      const templates = this.templateEngine.getTemplatesByFormat(format);
      return this.createSuccessResponse(templates, `Templates in format "${format}" retrieved successfully`);
    } catch (error) {
      return this.createSingleErrorResponse(
        'FORMAT_RETRIEVAL_ERROR',
        'Failed to retrieve templates by format',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== TEMPLATE STATISTICS AND ANALYTICS =====================

  /**
   * Get template usage statistics
   */
  public getTemplateUsage(templateId: string): ServiceResponse<TemplateUsageStats | null> {
    try {
      const stats = this.templateUsage.get(templateId) || null;
      return this.createSuccessResponse(stats, 'Template usage statistics retrieved successfully');
    } catch (error) {
      return this.createSingleErrorResponse(
        'USAGE_STATS_ERROR',
        'Failed to get template usage statistics',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Record template usage
   */
  public recordTemplateUsage(templateId: string, userId?: string): void {
    try {
      let stats = this.templateUsage.get(templateId);

      if (!stats) {
        stats = {
          templateId,
          usageCount: 0,
          topUsers: [],
          recentUsage: [],
        };
      }

      // Update usage count
      stats.usageCount++;
      stats.lastUsed = new Date();

      // Update user statistics
      if (userId) {
        const userStat = stats.topUsers.find(u => u.userId === userId);
        if (userStat) {
          userStat.count++;
        } else {
          stats.topUsers.push({ userId, count: 1 });
        }

        // Keep only top 10 users
        stats.topUsers.sort((a, b) => b.count - a.count);
        stats.topUsers = stats.topUsers.slice(0, 10);
      }

      // Update recent usage (daily aggregation)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayUsage = stats.recentUsage.find(u =>
        u.date.getTime() === today.getTime()
      );

      if (todayUsage) {
        todayUsage.count++;
      } else {
        stats.recentUsage.push({ date: today, count: 1 });
      }

      // Keep only last 30 days
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      stats.recentUsage = stats.recentUsage.filter(u => u.date >= cutoff);

      this.templateUsage.set(templateId, stats);

    } catch (error) {
      logger.error('Failed to record template usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId,
        userId,
      });
    }
  }

  /**
   * Get template manager statistics
   */
  public getManagerStatistics(): ServiceResponse<{
    totalTemplates: number;
    templatesByCategory: Record<string, number>;
    templatesByFormat: Record<string, number>;
    totalUsage: number;
    mostUsedTemplates: { templateId: string; name: string; usageCount: number }[];
  }> {
    try {
      const templates = this.templateEngine.getAllTemplates();

      // Group by category
      const byCategory: Record<string, number> = {};
      templates.forEach(template => {
        byCategory[template.category] = (byCategory[template.category] || 0) + 1;
      });

      // Group by format
      const byFormat: Record<string, number> = {};
      templates.forEach(template => {
        byFormat[template.format] = (byFormat[template.format] || 0) + 1;
      });

      // Calculate total usage
      const totalUsage = Array.from(this.templateUsage.values())
        .reduce((sum, stats) => sum + stats.usageCount, 0);

      // Get most used templates
      const mostUsed = Array.from(this.templateUsage.values())
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10)
        .map(stats => {
          const template = this.templateEngine.getTemplate(stats.templateId);
          return {
            templateId: stats.templateId,
            name: template?.name || 'Unknown',
            usageCount: stats.usageCount,
          };
        });

      const statistics = {
        totalTemplates: templates.length,
        templatesByCategory: byCategory,
        templatesByFormat: byFormat,
        totalUsage,
        mostUsedTemplates: mostUsed,
      };

      return this.createSuccessResponse(statistics, 'Manager statistics retrieved successfully');

    } catch (error) {
      return this.createSingleErrorResponse(
        'STATISTICS_ERROR',
        'Failed to get manager statistics',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== UTILITY METHODS =====================

  /**
   * Generate unique template ID
   */
  private generateTemplateId(name: string): string {
    const sanitizedName = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');

    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);

    return `tpl_${sanitizedName}_${timestamp}_${random}`;
  }

  /**
   * Find template by name
   */
  private findTemplateByName(name: string): ReportTemplate | null {
    return this.templateEngine.getAllTemplates()
      .find(template => template.name === name) || null;
  }

  /**
   * Create version record
   */
  private createVersionRecord(template: ReportTemplate, changeDescription?: string): void {
    const checksum = this.calculateTemplateChecksum(template);

    const versionInfo: TemplateVersionInfo = {
      templateId: template.id,
      version: template.version,
      checksum,
      createdAt: new Date(),
      author: template.metadata.author,
      changeDescription,
    };

    let versions = this.templateVersions.get(template.id) || [];
    versions.push(versionInfo);

    // Keep only last 20 versions
    if (versions.length > 20) {
      versions = versions.slice(-20);
    }

    this.templateVersions.set(template.id, versions);
  }

  /**
   * Calculate template checksum
   */
  private calculateTemplateChecksum(template: ReportTemplate): string {
    const content = template.template +
      JSON.stringify(template.partials || {}) +
      JSON.stringify(template.helpers || {});

    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Increment version number
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    return parts.join('.');
  }

  /**
   * Build inheritance tree
   */
  private buildInheritanceTree(template: ReportTemplate, depth: number): TemplateInheritanceTree {
    const children = this.findChildTemplates(template.id)
      .map(child => this.buildInheritanceTree(child, depth + 1));

    return {
      template,
      children,
      depth,
    };
  }

  /**
   * Apply filters to template list
   */
  private applyFilters(templates: ReportTemplate[], filters: TemplateSearchFilters): ReportTemplate[] {
    return templates.filter(template => {
      if (filters.category && template.category !== filters.category) return false;
      if (filters.format && template.format !== filters.format) return false;
      if (filters.isPublic !== undefined && template.metadata.isPublic !== filters.isPublic) return false;
      if (filters.author && template.metadata.author !== filters.author) return false;
      if (filters.parentTemplateId && template.parentTemplateId !== filters.parentTemplateId) return false;

      if (filters.namePattern) {
        const regex = new RegExp(filters.namePattern, 'i');
        if (!regex.test(template.name)) return false;
      }

      if (filters.tags && filters.tags.length > 0) {
        const hasAnyTag = filters.tags.some(tag => template.metadata.tags.includes(tag));
        if (!hasAnyTag) return false;
      }

      if (filters.reportTypes && filters.reportTypes.length > 0) {
        const hasAnyType = filters.reportTypes.some(type =>
          template.metadata.reportTypes.includes(type)
        );
        if (!hasAnyType) return false;
      }

      if (filters.createdAfter && template.metadata.createdAt < filters.createdAfter) return false;
      if (filters.createdBefore && template.metadata.createdAt > filters.createdBefore) return false;

      return true;
    });
  }

  /**
   * Apply sorting to template list
   */
  private applySorting(
    templates: ReportTemplate[],
    sortBy: string,
    sortOrder: 'ASC' | 'DESC'
  ): ReportTemplate[] {
    return templates.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortBy) {
        case 'name':
          valueA = a.name;
          valueB = b.name;
          break;
        case 'createdAt':
          valueA = a.metadata.createdAt;
          valueB = b.metadata.createdAt;
          break;
        case 'updatedAt':
          valueA = a.metadata.updatedAt;
          valueB = b.metadata.updatedAt;
          break;
        case 'category':
          valueA = a.category;
          valueB = b.category;
          break;
        case 'format':
          valueA = a.format;
          valueB = b.format;
          break;
        case 'version':
          valueA = a.version;
          valueB = b.version;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return sortOrder === 'ASC' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Load default templates
   */
  private async loadDefaultTemplates(): Promise<void> {
    // Load built-in template definitions
    const defaultTemplates: TemplateCreateInput[] = [
      {
        name: 'VPC Summary Report',
        description: 'Standard VPC summary report with basic metrics',
        format: 'HTML',
        category: 'network',
        template: `
          {{> reportMetadata}}
          <div class="report-content">
            <h2>VPC Summary</h2>
            <table class="data-table">
              {{> tableHeader columns=["VPC ID", "Name", "CIDR Block", "Region", "State"]}}
              <tbody>
                {{#each vpcs}}
                  <tr>
                    <td>{{vpcId}}</td>
                    <td>{{name}}</td>
                    <td>{{cidrBlock}}</td>
                    <td>{{region}}</td>
                    <td>{{state}}</td>
                  </tr>
                {{/each}}
              </tbody>
            </table>
            <div class="summary">
              <p>Total VPCs: {{length vpcs}}</p>
              <p>Total IP Addresses: {{sum vpcs "ipCount"}}</p>
            </div>
          </div>
        `,
        metadata: {
          author: 'system',
          tags: ['vpc', 'network', 'summary'],
          isPublic: true,
          reportTypes: ['vpc-inventory', 'network-summary'],
        },
        validation: {
          requiredFields: ['vpcs'],
        },
      },
      {
        name: 'Transit Gateway Report',
        description: 'Comprehensive Transit Gateway connectivity report',
        format: 'HTML',
        category: 'network',
        template: `
          {{> reportMetadata}}
          <div class="report-content">
            <h2>Transit Gateway Report</h2>
            {{#each transitGateways}}
              <div class="tgw-section">
                <h3>{{name}} ({{transitGatewayId}})</h3>
                <p>State: {{state}}</p>
                <p>Default Route Table: {{defaultRouteTableId}}</p>

                {{#if attachments}}
                  <h4>Attachments</h4>
                  <table class="data-table">
                    {{> tableHeader columns=["Attachment ID", "Type", "Resource ID", "State"]}}
                    <tbody>
                      {{#each attachments}}
                        <tr>
                          <td>{{attachmentId}}</td>
                          <td>{{resourceType}}</td>
                          <td>{{resourceId}}</td>
                          <td>{{state}}</td>
                        </tr>
                      {{/each}}
                    </tbody>
                  </table>
                {{/if}}
              </div>
            {{/each}}
          </div>
        `,
        metadata: {
          author: 'system',
          tags: ['transit-gateway', 'network', 'connectivity'],
          isPublic: true,
          reportTypes: ['tgw-connectivity', 'network-topology'],
        },
        validation: {
          requiredFields: ['transitGateways'],
        },
      },
    ];

    // Register default templates
    for (const templateData of defaultTemplates) {
      try {
        await this.create(templateData, 'system');
      } catch (error) {
        logger.warn('Failed to load default template', {
          name: templateData.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Ensure manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Shutdown the manager
   */
  public async shutdown(): Promise<void> {
    this.templateVersions.clear();
    this.templateUsage.clear();
    this.isInitialized = false;
    logger.info('Template manager shutdown complete');
  }
}

// Export convenience functions
export const createTemplateManager = (templateEngine: ReportTemplateEngine): TemplateManager => {
  return new TemplateManager(templateEngine);
};