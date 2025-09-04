/**
 * Base File Processor for Network CMDB Import/Export Engine
 * Provides common functionality for all file processors
 */

import { detect } from 'jschardet';
import {
  FileMetadata,
  FileProcessingOptions,
  ValidationError,
  ProcessingStats
} from './types';

export abstract class BaseFileProcessor {
  protected stats: ProcessingStats = {
    totalFilesProcessed: 0,
    totalRecordsProcessed: 0,
    totalProcessingTimeMs: 0,
    averageProcessingRatePerSecond: 0,
    memoryUsage: {
      current: 0,
      peak: 0,
      average: 0
    },
    errorCounts: new Map<string, number>()
  };

  /**
   * Basic file validation that all processors should perform
   */
  protected async validateFile(
    buffer: Buffer,
    metadata: FileMetadata,
    options?: FileProcessingOptions
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Check file size limits
    const maxFileSize = options?.maxFileSize || 100 * 1024 * 1024; // 100MB default
    if (buffer.length > maxFileSize) {
      errors.push({
        field: 'file',
        value: buffer.length,
        message: `File size (${this.formatBytes(buffer.length)}) exceeds maximum allowed size (${this.formatBytes(maxFileSize)})`,
        code: 'FILE_TOO_LARGE',
        severity: 'error'
      });
    }

    // Check if file is empty
    if (buffer.length === 0) {
      errors.push({
        field: 'file',
        value: 0,
        message: 'File is empty',
        code: 'EMPTY_FILE',
        severity: 'error'
      });
    }

    // Validate encoding
    try {
      const encoding = await this.detectEncoding(buffer);
      if (!encoding) {
        errors.push({
          field: 'encoding',
          value: 'unknown',
          message: 'Could not detect file encoding',
          code: 'UNKNOWN_ENCODING',
          severity: 'warning'
        });
      }
    } catch (error) {
      errors.push({
        field: 'encoding',
        value: error,
        message: `Encoding detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'ENCODING_DETECTION_ERROR',
        severity: 'warning'
      });
    }

    return errors;
  }

  /**
   * Detect file encoding using jschardet
   */
  async detectEncoding(buffer: Buffer): Promise<BufferEncoding> {
    try {
      // For small files, check the entire buffer
      // For large files, check first 64KB for performance
      const sampleSize = Math.min(buffer.length, 64 * 1024);
      const sample = buffer.subarray(0, sampleSize);
      
      const detection = detect(sample);
      
      if (!detection || detection.confidence < 0.5) {
        // Default to UTF-8 if confidence is low
        return 'utf8';
      }

      // Map detected encoding to Node.js BufferEncoding
      const encoding = detection.encoding.toLowerCase();
      switch (encoding) {
        case 'utf-8':
        case 'utf8':
          return 'utf8';
        case 'ascii':
          return 'ascii';
        case 'latin1':
        case 'iso-8859-1':
          return 'latin1';
        case 'utf-16le':
        case 'utf16le':
          return 'utf16le';
        case 'ucs2':
        case 'utf-16be':
          return 'utf16le'; // Node.js doesn't have utf16be, use utf16le
        default:
          return 'utf8'; // Default fallback
      }
    } catch (error) {
      // If detection fails, default to UTF-8
      return 'utf8';
    }
  }

  /**
   * Update processing statistics
   */
  protected updateStats(recordsProcessed: number, processingTimeMs: number): void {
    this.stats.totalFilesProcessed++;
    this.stats.totalRecordsProcessed += recordsProcessed;
    this.stats.totalProcessingTimeMs += processingTimeMs;
    
    // Calculate average processing rate
    this.stats.averageProcessingRatePerSecond = 
      this.stats.totalRecordsProcessed / (this.stats.totalProcessingTimeMs / 1000);

    // Update memory usage
    const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    this.stats.memoryUsage.current = currentMemory;
    
    if (currentMemory > this.stats.memoryUsage.peak) {
      this.stats.memoryUsage.peak = currentMemory;
    }

    // Calculate running average memory usage
    this.stats.memoryUsage.average = 
      (this.stats.memoryUsage.average * (this.stats.totalFilesProcessed - 1) + currentMemory) / 
      this.stats.totalFilesProcessed;
  }

  /**
   * Increment error count for a specific error code
   */
  protected incrementErrorCount(errorCode: string): void {
    const currentCount = this.stats.errorCounts.get(errorCode) || 0;
    this.stats.errorCounts.set(errorCode, currentCount + 1);
  }

  /**
   * Get current processing statistics
   */
  getProcessingStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Reset processing statistics
   */
  resetStats(): void {
    this.stats = {
      totalFilesProcessed: 0,
      totalRecordsProcessed: 0,
      totalProcessingTimeMs: 0,
      averageProcessingRatePerSecond: 0,
      memoryUsage: {
        current: 0,
        peak: 0,
        average: 0
      },
      errorCounts: new Map<string, number>()
    };
  }

  /**
   * Format bytes to human readable string
   */
  protected formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate that a string is not empty after trimming
   */
  protected isNonEmptyString(value: any): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Safe string conversion with trimming
   */
  protected safeString(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    const str = String(value).trim();
    return str.length > 0 ? str : undefined;
  }

  /**
   * Safe number conversion
   */
  protected safeNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Safe boolean conversion
   */
  protected safeBoolean(value: any): boolean | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') return true;
      if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') return false;
    }
    if (typeof value === 'number') return value !== 0;
    return undefined;
  }

  /**
   * Safe date conversion
   */
  protected safeDate(value: any): Date | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (value instanceof Date) return value;
    
    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }

  /**
   * Validate email format
   */
  protected isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  protected isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a checksum for file content validation
   */
  protected generateChecksum(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Check if file appears to be binary (contains null bytes in first 8KB)
   */
  protected isBinaryFile(buffer: Buffer): boolean {
    const sampleSize = Math.min(buffer.length, 8192); // Check first 8KB
    const sample = buffer.subarray(0, sampleSize);
    
    // Check for null bytes which are common in binary files
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Sanitize field name for safe usage
   */
  protected sanitizeFieldName(fieldName: string): string {
    return fieldName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Create a validation error object
   */
  protected createValidationError(
    field: string,
    value: any,
    message: string,
    code: string,
    severity: 'error' | 'warning' = 'error'
  ): ValidationError {
    return {
      field,
      value,
      message,
      code,
      severity
    };
  }
}