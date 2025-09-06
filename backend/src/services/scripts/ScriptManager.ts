/**
 * Script Management Service
 * Handles script upload, versioning, storage, and metadata management
 */

import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { Op } from 'sequelize';
import { getDatabase } from '../../config/database';
import { Script } from '../../models/Script';
import { ScriptParameter } from '../../models/ScriptParameter';
import { DEFAULT_SCRIPT_CONFIG } from './config';
import {
  ScriptError,
  ValidationError,
  calculateFileHash,
  calculateContentHash,
  validateScriptSecurity,
  validateScriptExtension,
  validateScriptName,
  generateScriptFileName,
  extractScriptMetadata,
  ensureDirectory,
  ERROR_CODES
} from './utils';

const sequelize = getDatabase();

export interface ScriptUpload {
  name: string;
  displayName: string;
  description?: string;
  language: string;
  content: string;
  parameters?: Array<{
    name: string;
    type: string;
    description?: string;
    required?: boolean;
    defaultValue?: any;
    validation?: Record<string, any>;
  }>;
  requirements?: string;
  estimatedExecutionTime?: number;
  maxExecutionTime?: number;
  resourceLimits?: {
    maxMemory?: number;
    maxCpu?: number;
    maxDisk?: number;
  };
  tags?: string[];
  isTemplate?: boolean;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface ScriptUpdateData {
  displayName?: string;
  description?: string;
  requirements?: string;
  estimatedExecutionTime?: number;
  maxExecutionTime?: number;
  resourceLimits?: {
    maxMemory?: number;
    maxCpu?: number;
    maxDisk?: number;
  };
  tags?: string[];
  permissions?: string[];
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export interface ScriptSearchOptions {
  query?: string;
  language?: string;
  tags?: string[];
  authorId?: string;
  isActive?: boolean;
  isTemplate?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'displayName' | 'createdAt' | 'updatedAt' | 'version';
  sortOrder?: 'ASC' | 'DESC';
}

export class ScriptManager {
  private config = DEFAULT_SCRIPT_CONFIG;

  constructor() {
    // Initialize storage directories
    this.initializeStorage();
  }

  /**
   * Initialize storage directories
   */
  private async initializeStorage(): Promise<void> {
    try {
      await ensureDirectory(this.config.scriptsStoragePath);
      await ensureDirectory(this.config.logsStoragePath);
      await ensureDirectory(this.config.artifactsStoragePath);
      await ensureDirectory(this.config.tempStoragePath);
    } catch (error) {
      throw new ScriptError(
        `Failed to initialize storage directories: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { error: error as Error }
      );
    }
  }

  /**
   * Upload a new script
   */
  async uploadScript(
    scriptData: ScriptUpload,
    authorId: string,
    file?: Express.Multer.File
  ): Promise<Script> {
    try {
      // Validate input
      validateScriptName(scriptData.name);
      
      // Check if script with same name already exists
      const existingScript = await Script.findOne({
        where: { name: scriptData.name }
      });
      
      if (existingScript) {
        throw new ValidationError(
          `Script with name '${scriptData.name}' already exists`,
          { existingId: existingScript.id }
        );
      }

      let content: string;
      let fileHash: string;
      let filePath: string;

      if (file) {
        // Handle file upload
        content = file.buffer.toString('utf8');
        validateScriptExtension(file.originalname, scriptData.language);
      } else if (scriptData.content) {
        // Handle direct content
        content = scriptData.content;
      } else {
        throw new ValidationError('Either file upload or content is required');
      }

      // Validate file size
      if (content.length > this.config.maxFileSize) {
        throw new ValidationError(
          `Script file too large: ${content.length} bytes (max: ${this.config.maxFileSize})`
        );
      }

      // Security validation
      validateScriptSecurity(content, scriptData.language);

      // Calculate hash and generate file path
      fileHash = calculateContentHash(content);
      const fileName = generateScriptFileName(scriptData.name, '1.0.0', scriptData.language);
      filePath = path.join(this.config.scriptsStoragePath, fileName);

      // Save script file
      await fs.writeFile(filePath, content, 'utf8');

      // Extract metadata from script content
      const extractedMetadata = extractScriptMetadata(content);

      // Create script record
      const script = await Script.create({
        name: scriptData.name,
        displayName: scriptData.displayName,
        description: scriptData.description || extractedMetadata.description,
        language: scriptData.language,
        version: '1.0.0',
        filePath: fileName,
        fileHash,
        authorId,
        isTemplate: scriptData.isTemplate || false,
        permissions: scriptData.permissions || ['script:execute'],
        requirements: scriptData.requirements || extractedMetadata.requirements?.join('\n'),
        estimatedExecutionTime: scriptData.estimatedExecutionTime,
        maxExecutionTime: scriptData.maxExecutionTime || this.config.defaultTimeout,
        resourceLimits: scriptData.resourceLimits,
        tags: scriptData.tags || [],
        metadata: {
          ...scriptData.metadata,
          ...extractedMetadata,
          originalFileName: file?.originalname
        }
      });

      // Create script parameters
      if (scriptData.parameters) {
        const parameters = scriptData.parameters.map(param => ({
          scriptId: script.id,
          name: param.name,
          type: param.type,
          description: param.description,
          required: param.required || false,
          defaultValue: param.defaultValue,
          validation: param.validation
        }));
        
        await ScriptParameter.bulkCreate(parameters);
      }

      return script;
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error;
      }
      throw new ScriptError(
        `Failed to upload script: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptData, error: error as Error }
      );
    }
  }

  /**
   * Create a new version of an existing script
   */
  async createVersion(
    scriptId: string,
    updates: ScriptUpload,
    modifiedBy: string,
    file?: Express.Multer.File
  ): Promise<Script> {
    try {
      const originalScript = await Script.findByPk(scriptId);
      if (!originalScript) {
        throw new ValidationError(`Script not found: ${scriptId}`);
      }

      let content: string;
      let fileHash: string;
      let filePath: string;

      if (file) {
        content = file.buffer.toString('utf8');
        validateScriptExtension(file.originalname, updates.language || originalScript.language);
      } else if (updates.content) {
        content = updates.content;
      } else {
        throw new ValidationError('Either file upload or content is required for new version');
      }

      // Validate file size
      if (content.length > this.config.maxFileSize) {
        throw new ValidationError(
          `Script file too large: ${content.length} bytes (max: ${this.config.maxFileSize})`
        );
      }

      // Security validation
      validateScriptSecurity(content, updates.language || originalScript.language);

      // Check if content actually changed
      fileHash = calculateContentHash(content);
      if (fileHash === originalScript.fileHash) {
        throw new ValidationError('Script content has not changed');
      }

      // Generate new version and file path
      const nextVersion = Script.generateNextVersion(originalScript.version);
      const fileName = generateScriptFileName(
        originalScript.name, 
        nextVersion, 
        updates.language || originalScript.language
      );
      filePath = path.join(this.config.scriptsStoragePath, fileName);

      // Save new script file
      await fs.writeFile(filePath, content, 'utf8');

      // Extract metadata
      const extractedMetadata = extractScriptMetadata(content);

      // Create new version
      const newVersion = await originalScript.createVersion({
        displayName: updates.displayName || originalScript.displayName,
        description: updates.description || extractedMetadata.description || originalScript.description,
        language: updates.language || originalScript.language,
        filePath: fileName,
        fileHash,
        requirements: updates.requirements || extractedMetadata.requirements?.join('\n') || originalScript.requirements,
        estimatedExecutionTime: updates.estimatedExecutionTime || originalScript.estimatedExecutionTime,
        maxExecutionTime: updates.maxExecutionTime || originalScript.maxExecutionTime,
        resourceLimits: updates.resourceLimits || originalScript.resourceLimits,
        tags: updates.tags || originalScript.tags,
        permissions: updates.permissions || originalScript.permissions,
        metadata: {
          ...originalScript.metadata,
          ...updates.metadata,
          ...extractedMetadata,
          originalFileName: file?.originalname,
          previousVersion: originalScript.version
        }
      }, modifiedBy);

      // Update script parameters if provided
      if (updates.parameters) {
        // Remove old parameters
        await ScriptParameter.destroy({
          where: { scriptId: newVersion.id }
        });

        // Create new parameters
        const parameters = updates.parameters.map(param => ({
          scriptId: newVersion.id,
          name: param.name,
          type: param.type,
          description: param.description,
          required: param.required || false,
          defaultValue: param.defaultValue,
          validation: param.validation
        }));
        
        await ScriptParameter.bulkCreate(parameters);
      }

      return newVersion;
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error;
      }
      throw new ScriptError(
        `Failed to create script version: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, updates, error: error as Error }
      );
    }
  }

  /**
   * Update script metadata (non-version changing updates)
   */
  async updateScript(
    scriptId: string,
    updates: ScriptUpdateData,
    modifiedBy: string
  ): Promise<Script> {
    try {
      const script = await Script.findByPk(scriptId);
      if (!script) {
        throw new ValidationError(`Script not found: ${scriptId}`);
      }

      // Update script properties
      await script.update({
        ...updates,
        lastModifiedBy: modifiedBy
      });

      return script;
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error;
      }
      throw new ScriptError(
        `Failed to update script: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, updates, error: error as Error }
      );
    }
  }

  /**
   * Get script by ID with optional associations
   */
  async getScript(scriptId: string, includeAssociations = false): Promise<Script | null> {
    try {
      const include = includeAssociations ? [
        'parameters',
        'executions',
        'schedules'
      ] : undefined;

      return await Script.findByPk(scriptId, { include });
    } catch (error) {
      throw new ScriptError(
        `Failed to get script: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, error: error as Error }
      );
    }
  }

  /**
   * Get script content
   */
  async getScriptContent(scriptId: string): Promise<string> {
    try {
      const script = await Script.findByPk(scriptId);
      if (!script) {
        throw new ValidationError(`Script not found: ${scriptId}`);
      }

      const filePath = path.join(this.config.scriptsStoragePath, script.filePath);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Verify file integrity
      const currentHash = calculateContentHash(content);
      if (currentHash !== script.fileHash) {
        throw new ScriptError(
          'Script file integrity check failed',
          ERROR_CODES.INVALID_SCRIPT,
          { scriptId, expectedHash: script.fileHash, actualHash: currentHash }
        );
      }

      return content;
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error;
      }
      throw new ScriptError(
        `Failed to get script content: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, error: error as Error }
      );
    }
  }

  /**
   * Search scripts with filtering and pagination
   */
  async searchScripts(options: ScriptSearchOptions = {}): Promise<{
    scripts: Script[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        query,
        language,
        tags,
        authorId,
        isActive = true,
        isTemplate,
        limit = 20,
        offset = 0,
        sortBy = 'updatedAt',
        sortOrder = 'DESC'
      } = options;

      const where: any = {};
      
      if (query) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${query}%` } },
          { displayName: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } }
        ];
      }
      
      if (language) where.language = language;
      if (authorId) where.authorId = authorId;
      if (isActive !== undefined) where.isActive = isActive;
      if (isTemplate !== undefined) where.isTemplate = isTemplate;
      
      if (tags && tags.length > 0) {
        where.tags = { [Op.overlap]: tags };
      }

      const { count, rows } = await Script.findAndCountAll({
        where,
        limit,
        offset,
        order: [[sortBy, sortOrder]],
        include: ['author', 'parameters']
      });

      return {
        scripts: rows,
        total: count,
        hasMore: offset + limit < count
      };
    } catch (error) {
      throw new ScriptError(
        `Failed to search scripts: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { options, error: error as Error }
      );
    }
  }

  /**
   * Get all versions of a script
   */
  async getScriptVersions(scriptName: string): Promise<Script[]> {
    try {
      return await Script.findAll({
        where: { name: scriptName },
        order: [['version', 'DESC']]
      });
    } catch (error) {
      throw new ScriptError(
        `Failed to get script versions: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptName, error: error as Error }
      );
    }
  }

  /**
   * Archive (soft delete) a script
   */
  async archiveScript(scriptId: string, archivedBy: string): Promise<void> {
    try {
      const script = await Script.findByPk(scriptId);
      if (!script) {
        throw new ValidationError(`Script not found: ${scriptId}`);
      }

      await script.archive(archivedBy);
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error;
      }
      throw new ScriptError(
        `Failed to archive script: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, error: error as Error }
      );
    }
  }

  /**
   * Restore an archived script
   */
  async restoreScript(scriptId: string, restoredBy: string): Promise<void> {
    try {
      const script = await Script.findByPk(scriptId, { paranoid: false });
      if (!script) {
        throw new ValidationError(`Script not found: ${scriptId}`);
      }

      await script.restore(restoredBy);
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error;
      }
      throw new ScriptError(
        `Failed to restore script: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, error: error as Error }
      );
    }
  }

  /**
   * Delete a script permanently (and its file)
   */
  async deleteScript(scriptId: string): Promise<void> {
    try {
      const script = await Script.findByPk(scriptId, { paranoid: false });
      if (!script) {
        throw new ValidationError(`Script not found: ${scriptId}`);
      }

      // Delete script file
      const filePath = path.join(this.config.scriptsStoragePath, script.filePath);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might already be deleted, log but continue
        console.warn(`Failed to delete script file: ${filePath}`, error);
      }

      // Delete database record
      await script.destroy({ force: true });
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error;
      }
      throw new ScriptError(
        `Failed to delete script: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, error: error as Error }
      );
    }
  }

  /**
   * Get script statistics
   */
  async getScriptStats(): Promise<{
    totalScripts: number;
    activeScripts: number;
    templateScripts: number;
    languageStats: Record<string, number>;
    recentUploads: number;
  }> {
    try {
      const [
        totalScripts,
        activeScripts,
        templateScripts,
        languageStats,
        recentUploads
      ] = await Promise.all([
        Script.count(),
        Script.count({ where: { isActive: true } }),
        Script.count({ where: { isTemplate: true } }),
        Script.findAll({
          attributes: [
            'language',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['language']
        }),
        Script.count({
          where: {
            createdAt: {
              [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        })
      ]);

      const langStats: Record<string, number> = {};
      for (const stat of languageStats as any[]) {
        langStats[stat.language] = parseInt(stat.dataValues.count);
      }

      return {
        totalScripts,
        activeScripts,
        templateScripts,
        languageStats: langStats,
        recentUploads
      };
    } catch (error) {
      throw new ScriptError(
        `Failed to get script statistics: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { error: error as Error }
      );
    }
  }

  /**
   * Configure multer for file uploads
   */
  getUploadMiddleware(): multer.Multer {
    const storage = multer.memoryStorage();
    
    return multer({
      storage,
      limits: {
        fileSize: this.config.maxFileSize,
        files: 1
      },
      fileFilter: (req, file, cb) => {
        try {
          const language = req.body?.language || 'python';
          validateScriptExtension(file.originalname, language);
          cb(null, true);
        } catch (error) {
          cb(error as Error, false);
        }
      }
    });
  }
}

export default ScriptManager;