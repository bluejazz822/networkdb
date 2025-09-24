/**
 * File Manager Utility
 * Handles file lifecycle management, temporary file cleanup, and resource management for exports
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  FileInfo,
  FileCleanupResult,
  FileCleanupStrategy,
  FileManagerError,
  ResourceCleanupInfo
} from '../types/export';

export interface FileManagerConfig {
  tempDir: string;
  maxFileSize: number; // in bytes
  maxTotalSize: number; // in bytes
  defaultTTL: number; // time to live in milliseconds
  cleanupInterval: number; // cleanup interval in milliseconds
  compressionEnabled: boolean;
  allowedExtensions: string[];
}

export class FileManager extends EventEmitter {
  private readonly config: FileManagerConfig;
  private readonly activeFiles = new Map<string, FileInfo>();
  private cleanupTimer?: NodeJS.Timeout;
  private totalSizeUsed = 0;
  private isInitialized = false;
  private isShutdown = false;

  constructor(config: Partial<FileManagerConfig> = {}) {
    super();

    this.config = {
      tempDir: config.tempDir || path.join(process.cwd(), 'temp'),
      maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
      maxTotalSize: config.maxTotalSize || 1024 * 1024 * 1024, // 1GB
      defaultTTL: config.defaultTTL || 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: config.cleanupInterval || 60 * 60 * 1000, // 1 hour
      compressionEnabled: config.compressionEnabled || false,
      allowedExtensions: config.allowedExtensions || ['.csv', '.json', '.xlsx', '.pdf', '.zip', '.txt']
    };

    // Initialize asynchronously but allow constructor to complete
    setImmediate(() => this.initializeFileManager());
  }

  /**
   * Initialize file manager - create temp directory and start cleanup timer
   */
  private async initializeFileManager(): Promise<void> {
    try {
      await this.ensureDirectoryExists(this.config.tempDir);
      await this.loadExistingFiles();
      this.startCleanupTimer();
      this.isInitialized = true;

      this.emit('initialized', { tempDir: this.config.tempDir });
    } catch (error) {
      this.emit('error', new FileManagerError(
        `Failed to initialize FileManager: ${error.message}`,
        'INIT_ERROR'
      ));
    }
  }

  /**
   * Create a temporary file with given content
   */
  async createTempFile(
    content: Buffer,
    extension: string,
    options: {
      fileName?: string;
      ttl?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<FileInfo> {
    try {
      if (this.isShutdown) {
        throw new FileManagerError('FileManager has been shutdown', 'SHUTDOWN_ERROR');
      }
      if (!this.isInitialized) {
        throw new FileManagerError('FileManager not initialized', 'NOT_INITIALIZED');
      }

      this.validateFileSize(content.length);
      this.validateExtension(extension);
      await this.ensureSpaceAvailable(content.length);

      const fileName = options.fileName || this.generateFileName(extension);
      const filePath = path.join(this.config.tempDir, fileName);
      const ttl = options.ttl || this.config.defaultTTL;
      const expiresAt = new Date(Date.now() + ttl);

      // Write file
      await fs.writeFile(filePath, content);

      // Create file info
      const fileInfo: FileInfo = {
        fileName,
        filePath,
        fileSize: content.length,
        mimeType: this.getMimeType(extension),
        createdAt: new Date(),
        expiresAt,
        isTemporary: true,
        metadata: options.metadata
      };

      // Track file
      this.activeFiles.set(filePath, fileInfo);
      this.totalSizeUsed += content.length;

      this.emit('file:created', { fileInfo });

      return fileInfo;
    } catch (error) {
      if (error instanceof FileManagerError) {
        throw error;
      }
      throw new FileManagerError(
        `Failed to create temp file: ${error.message}`,
        'CREATE_ERROR',
        undefined,
        'create'
      );
    }
  }

  /**
   * Create a persistent file
   */
  async createPersistentFile(
    content: Buffer,
    fileName: string,
    targetDir?: string
  ): Promise<FileInfo> {
    try {
      this.validateFileSize(content.length);

      const directory = targetDir || this.config.tempDir;
      await this.ensureDirectoryExists(directory);

      const filePath = path.join(directory, fileName);
      const extension = path.extname(fileName);
      this.validateExtension(extension);

      // Write file
      await fs.writeFile(filePath, content);

      // Create file info
      const fileInfo: FileInfo = {
        fileName,
        filePath,
        fileSize: content.length,
        mimeType: this.getMimeType(extension),
        createdAt: new Date(),
        isTemporary: false
      };

      this.emit('file:created', { fileInfo });

      return fileInfo;
    } catch (error) {
      throw new FileManagerError(
        `Failed to create persistent file: ${error.message}`,
        'CREATE_ERROR',
        fileName,
        'create'
      );
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<Buffer> {
    try {
      const fileInfo = this.activeFiles.get(filePath);

      if (fileInfo && fileInfo.expiresAt && fileInfo.expiresAt < new Date()) {
        await this.deleteFile(filePath);
        throw new FileManagerError(
          'File has expired',
          'FILE_EXPIRED',
          filePath,
          'read'
        );
      }

      return await fs.readFile(filePath);
    } catch (error) {
      if (error instanceof FileManagerError) {
        throw error;
      }
      throw new FileManagerError(
        `Failed to read file: ${error.message}`,
        'READ_ERROR',
        filePath,
        'read'
      );
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fileInfo = this.activeFiles.get(filePath);

      // Remove from filesystem
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, which is fine for our purposes
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Update tracking
      if (fileInfo) {
        this.activeFiles.delete(filePath);
        this.totalSizeUsed -= fileInfo.fileSize;
      }

      this.emit('file:deleted', { filePath, fileInfo });

      return true;
    } catch (error) {
      throw new FileManagerError(
        `Failed to delete file: ${error.message}`,
        'DELETE_ERROR',
        filePath,
        'delete'
      );
    }
  }

  /**
   * Get file information
   */
  getFileInfo(filePath: string): FileInfo | null {
    return this.activeFiles.get(filePath) || null;
  }

  /**
   * List all tracked files
   */
  listFiles(filter?: {
    isTemporary?: boolean;
    expired?: boolean;
    olderThan?: Date;
  }): FileInfo[] {
    const files = Array.from(this.activeFiles.values());

    if (!filter) {
      return files;
    }

    return files.filter(file => {
      if (filter.isTemporary !== undefined && file.isTemporary !== filter.isTemporary) {
        return false;
      }

      if (filter.expired !== undefined) {
        const isExpired = file.expiresAt ? file.expiresAt < new Date() : false;
        if (isExpired !== filter.expired) {
          return false;
        }
      }

      if (filter.olderThan && file.createdAt >= filter.olderThan) {
        return false;
      }

      return true;
    });
  }

  /**
   * Clean up files based on strategy
   */
  async cleanupFiles(strategy: FileCleanupStrategy = 'age-based'): Promise<FileCleanupResult> {
    const result: FileCleanupResult = {
      filesDeleted: 0,
      bytesFreed: 0,
      errors: []
    };

    try {
      let filesToDelete: FileInfo[] = [];

      switch (strategy) {
        case 'age-based':
          filesToDelete = this.listFiles({ expired: true });
          break;

        case 'size-based':
          filesToDelete = this.selectFilesForSizeBasedCleanup();
          break;

        case 'manual':
          // Manual cleanup - only delete explicitly expired files
          filesToDelete = this.listFiles({
            expired: true,
            isTemporary: true
          });
          break;
      }

      // Delete selected files
      for (const fileInfo of filesToDelete) {
        try {
          await this.deleteFile(fileInfo.filePath);
          result.filesDeleted++;
          result.bytesFreed += fileInfo.fileSize;
        } catch (error) {
          result.errors.push(`Failed to delete ${fileInfo.filePath}: ${error.message}`);
        }
      }

      this.emit('cleanup:completed', result);

      return result;
    } catch (error) {
      const cleanupError = new FileManagerError(
        `Cleanup failed: ${error.message}`,
        'CLEANUP_ERROR'
      );
      this.emit('cleanup:failed', cleanupError);
      throw cleanupError;
    }
  }

  /**
   * Get resource usage statistics
   */
  getResourceUsage(): {
    totalFiles: number;
    totalSize: number;
    temporaryFiles: number;
    temporarySize: number;
    expiredFiles: number;
    expiredSize: number;
  } {
    const files = Array.from(this.activeFiles.values());
    const now = new Date();

    const stats = {
      totalFiles: files.length,
      totalSize: this.totalSizeUsed,
      temporaryFiles: 0,
      temporarySize: 0,
      expiredFiles: 0,
      expiredSize: 0
    };

    files.forEach(file => {
      if (file.isTemporary) {
        stats.temporaryFiles++;
        stats.temporarySize += file.fileSize;
      }

      if (file.expiresAt && file.expiresAt < now) {
        stats.expiredFiles++;
        stats.expiredSize += file.fileSize;
      }
    });

    return stats;
  }

  /**
   * Shutdown file manager - cleanup and stop timers
   */
  async shutdown(): Promise<void> {
    try {
      if (this.isShutdown) {
        return; // Already shutdown
      }

      this.isShutdown = true;

      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = undefined;
      }

      // Final cleanup of temporary files
      if (this.isInitialized) {
        await this.cleanupFiles('manual');
      }

      this.emit('shutdown');
    } catch (error) {
      throw new FileManagerError(
        `Failed to shutdown FileManager: ${error.message}`,
        'SHUTDOWN_ERROR'
      );
    }
  }

  /**
   * Private helper methods
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async loadExistingFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.tempDir);
      let totalSize = 0;

      for (const fileName of files) {
        const filePath = path.join(this.config.tempDir, fileName);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const fileInfo: FileInfo = {
            fileName,
            filePath,
            fileSize: stats.size,
            mimeType: this.getMimeType(path.extname(fileName)),
            createdAt: stats.birthtime,
            expiresAt: new Date(stats.birthtime.getTime() + this.config.defaultTTL),
            isTemporary: true
          };

          this.activeFiles.set(filePath, fileInfo);
          totalSize += stats.size;
        }
      }

      this.totalSizeUsed = totalSize;
    } catch (error) {
      // Directory might not exist or be inaccessible - this is fine
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupFiles('age-based');
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.cleanupInterval);
  }

  private generateFileName(extension: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `temp_${timestamp}_${random}${extension}`;
  }

  private validateFileSize(size: number): void {
    if (size > this.config.maxFileSize) {
      throw new FileManagerError(
        `File size (${size}) exceeds maximum allowed size (${this.config.maxFileSize})`,
        'FILE_TOO_LARGE'
      );
    }
  }

  private validateExtension(extension: string): void {
    if (!this.config.allowedExtensions.includes(extension.toLowerCase())) {
      throw new FileManagerError(
        `File extension '${extension}' is not allowed`,
        'INVALID_EXTENSION'
      );
    }
  }

  private async ensureSpaceAvailable(requiredSize: number): Promise<void> {
    const futureSize = this.totalSizeUsed + requiredSize;

    if (futureSize > this.config.maxTotalSize) {
      // Try to free up space
      const cleanupResult = await this.cleanupFiles('size-based');

      if (this.totalSizeUsed + requiredSize > this.config.maxTotalSize) {
        throw new FileManagerError(
          `Insufficient space available. Required: ${requiredSize}, Available: ${this.config.maxTotalSize - this.totalSizeUsed}`,
          'INSUFFICIENT_SPACE'
        );
      }
    }
  }

  private selectFilesForSizeBasedCleanup(): FileInfo[] {
    const files = Array.from(this.activeFiles.values());

    // Sort by creation date (oldest first) and select temporary files
    return files
      .filter(file => file.isTemporary)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, Math.ceil(files.length * 0.1)); // Delete oldest 10%
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.txt': 'text/plain'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}