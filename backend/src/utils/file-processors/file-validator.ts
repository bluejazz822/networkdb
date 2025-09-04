/**
 * File Validation Utilities for Network CMDB Import/Export Engine
 * Provides common validation functionality for all file processors
 */

import { createHash } from 'crypto';
import { detect } from 'jschardet';
import { FileMetadata, FileProcessingOptions, ValidationError, FileFormat } from './types';

export class FileValidator {
  // File size limits (in bytes)
  private static readonly DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
  
  // Binary file detection sample size
  private static readonly BINARY_CHECK_SIZE = 8192; // 8KB
  
  // Virus scan patterns (basic signature detection)
  private static readonly SUSPICIOUS_PATTERNS = [
    Buffer.from([0x4D, 0x5A]), // PE executable header
    Buffer.from('<!DOCTYPE html', 'utf8'),
    Buffer.from('<script', 'utf8'),
    Buffer.from('javascript:', 'utf8')
  ];

  /**
   * Comprehensive file validation
   */
  static async validateFile(
    buffer: Buffer,
    metadata: FileMetadata,
    format: FileFormat,
    options?: FileProcessingOptions
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Basic file validation
    errors.push(...this.validateFileSize(buffer, options));
    errors.push(...this.validateFileContent(buffer));
    errors.push(...await this.validateEncoding(buffer));
    errors.push(...this.validateMimeType(metadata.mimetype, format));
    errors.push(...this.validateFileExtension(metadata.originalName, format));
    errors.push(...this.validateFileName(metadata.originalName));
    errors.push(...this.performSecurityChecks(buffer, metadata));

    return errors;
  }

  /**
   * Validate file size constraints
   */
  private static validateFileSize(
    buffer: Buffer,
    options?: FileProcessingOptions
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const maxSize = options?.maxFileSize || this.DEFAULT_MAX_FILE_SIZE;

    if (buffer.length === 0) {
      errors.push({
        field: 'file',
        value: 0,
        message: 'File is empty',
        code: 'EMPTY_FILE',
        severity: 'error'
      });
    }

    if (buffer.length > maxSize) {
      errors.push({
        field: 'file',
        value: buffer.length,
        message: `File size (${this.formatBytes(buffer.length)}) exceeds maximum allowed size (${this.formatBytes(maxSize)})`,
        code: 'FILE_TOO_LARGE',
        severity: 'error'
      });
    }

    // Warning for large files
    if (buffer.length > this.LARGE_FILE_THRESHOLD) {
      errors.push({
        field: 'file',
        value: buffer.length,
        message: `Large file detected (${this.formatBytes(buffer.length)}). Consider using streaming processing.`,
        code: 'LARGE_FILE_WARNING',
        severity: 'warning'
      });
    }

    return errors;
  }

  /**
   * Validate file content (binary detection, corruption checks)
   */
  private static validateFileContent(buffer: Buffer): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for binary content in text files
    if (this.containsBinaryData(buffer)) {
      errors.push({
        field: 'content',
        value: 'binary',
        message: 'File contains binary data which may not be suitable for text processing',
        code: 'BINARY_CONTENT_DETECTED',
        severity: 'warning'
      });
    }

    // Check for file corruption (basic checks)
    if (this.isLikelyCorrupted(buffer)) {
      errors.push({
        field: 'content',
        value: 'corrupted',
        message: 'File may be corrupted or truncated',
        code: 'POSSIBLE_CORRUPTION',
        severity: 'warning'
      });
    }

    return errors;
  }

  /**
   * Validate file encoding
   */
  private static async validateEncoding(buffer: Buffer): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    try {
      const sampleSize = Math.min(buffer.length, 64 * 1024);
      const sample = buffer.subarray(0, sampleSize);
      const detection = detect(sample);

      if (!detection) {
        errors.push({
          field: 'encoding',
          value: 'unknown',
          message: 'Could not detect file encoding',
          code: 'ENCODING_DETECTION_FAILED',
          severity: 'warning'
        });
      } else if (detection.confidence < 0.7) {
        errors.push({
          field: 'encoding',
          value: detection.encoding,
          message: `Low confidence in detected encoding (${detection.encoding}, ${Math.round(detection.confidence * 100)}%)`,
          code: 'LOW_ENCODING_CONFIDENCE',
          severity: 'warning'
        });
      }

      // Check for BOM (Byte Order Mark) issues
      if (buffer.length >= 3) {
        const bom = buffer.subarray(0, 3);
        if (bom.equals(Buffer.from([0xEF, 0xBB, 0xBF]))) {
          // UTF-8 BOM detected
          errors.push({
            field: 'encoding',
            value: 'UTF-8 BOM',
            message: 'File contains UTF-8 BOM which may cause parsing issues',
            code: 'BOM_DETECTED',
            severity: 'warning'
          });
        }
      }

    } catch (error) {
      errors.push({
        field: 'encoding',
        value: error,
        message: `Encoding validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'ENCODING_VALIDATION_ERROR',
        severity: 'warning'
      });
    }

    return errors;
  }

  /**
   * Validate MIME type matches expected format
   */
  private static validateMimeType(
    mimeType: string,
    expectedFormat: FileFormat
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const validMimeTypes = this.getValidMimeTypes(expectedFormat);

    if (!validMimeTypes.includes(mimeType)) {
      const severity = expectedFormat === FileFormat.JSON ? 'warning' : 'error';
      errors.push({
        field: 'mimeType',
        value: mimeType,
        message: `MIME type '${mimeType}' may not be compatible with ${expectedFormat.toUpperCase()} format. Expected: ${validMimeTypes.join(', ')}`,
        code: 'MIME_TYPE_MISMATCH',
        severity
      });
    }

    return errors;
  }

  /**
   * Validate file extension matches expected format
   */
  private static validateFileExtension(
    filename: string,
    expectedFormat: FileFormat
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!filename || !filename.includes('.')) {
      errors.push({
        field: 'filename',
        value: filename,
        message: 'File has no extension',
        code: 'NO_FILE_EXTENSION',
        severity: 'warning'
      });
      return errors;
    }

    const extension = filename.toLowerCase().split('.').pop();
    const validExtensions = this.getValidExtensions(expectedFormat);

    if (!validExtensions.includes(extension!)) {
      errors.push({
        field: 'filename',
        value: extension,
        message: `File extension '${extension}' may not be compatible with ${expectedFormat.toUpperCase()} format. Expected: ${validExtensions.join(', ')}`,
        code: 'EXTENSION_MISMATCH',
        severity: 'warning'
      });
    }

    return errors;
  }

  /**
   * Validate filename for security and compatibility
   */
  private static validateFileName(filename: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!filename || filename.trim() === '') {
      errors.push({
        field: 'filename',
        value: filename,
        message: 'Filename is empty',
        code: 'EMPTY_FILENAME',
        severity: 'error'
      });
      return errors;
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/g;
    if (dangerousChars.test(filename)) {
      errors.push({
        field: 'filename',
        value: filename,
        message: 'Filename contains dangerous characters',
        code: 'DANGEROUS_FILENAME_CHARS',
        severity: 'warning'
      });
    }

    // Check filename length
    if (filename.length > 255) {
      errors.push({
        field: 'filename',
        value: filename.length,
        message: 'Filename is too long (maximum 255 characters)',
        code: 'FILENAME_TOO_LONG',
        severity: 'error'
      });
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    if (reservedNames.test(filename)) {
      errors.push({
        field: 'filename',
        value: filename,
        message: 'Filename uses a reserved system name',
        code: 'RESERVED_FILENAME',
        severity: 'warning'
      });
    }

    return errors;
  }

  /**
   * Perform basic security checks
   */
  private static performSecurityChecks(
    buffer: Buffer,
    metadata: FileMetadata
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for suspicious file signatures
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (buffer.indexOf(pattern) !== -1) {
        errors.push({
          field: 'security',
          value: 'suspicious pattern',
          message: 'File contains suspicious binary patterns',
          code: 'SUSPICIOUS_CONTENT',
          severity: 'error'
        });
        break;
      }
    }

    // Check for excessively long lines (potential DoS)
    if (this.hasExcessivelyLongLines(buffer)) {
      errors.push({
        field: 'content',
        value: 'long lines',
        message: 'File contains excessively long lines which may cause processing issues',
        code: 'EXCESSIVE_LINE_LENGTH',
        severity: 'warning'
      });
    }

    // Check for excessive nesting (JSON/XML bomb protection)
    if (this.hasExcessiveNesting(buffer)) {
      errors.push({
        field: 'content',
        value: 'deep nesting',
        message: 'File contains deeply nested structures which may cause performance issues',
        code: 'EXCESSIVE_NESTING',
        severity: 'warning'
      });
    }

    return errors;
  }

  /**
   * Check if buffer contains binary data
   */
  private static containsBinaryData(buffer: Buffer): boolean {
    const sampleSize = Math.min(buffer.length, this.BINARY_CHECK_SIZE);
    const sample = buffer.subarray(0, sampleSize);

    // Check for null bytes
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) {
        return true;
      }
    }

    // Check for high percentage of non-printable characters
    let nonPrintableCount = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample[i];
      if (char < 32 && char !== 9 && char !== 10 && char !== 13) {
        nonPrintableCount++;
      }
    }

    return (nonPrintableCount / sample.length) > 0.3; // More than 30% non-printable
  }

  /**
   * Check if file is likely corrupted
   */
  private static isLikelyCorrupted(buffer: Buffer): boolean {
    // Check for truncation patterns
    const end = buffer.subarray(-100);
    const nullBytes = end.filter(byte => byte === 0).length;
    
    // If last 100 bytes are mostly null, might be corrupted
    return nullBytes > 80;
  }

  /**
   * Check for excessively long lines
   */
  private static hasExcessivelyLongLines(buffer: Buffer): boolean {
    const maxLineLength = 100000; // 100KB per line
    const sample = buffer.subarray(0, Math.min(buffer.length, 1024 * 1024)); // Check first 1MB
    const content = sample.toString('utf8', 0, Math.min(sample.length, 10000));
    
    const lines = content.split('\n');
    return lines.some(line => line.length > maxLineLength);
  }

  /**
   * Check for excessive nesting (basic check)
   */
  private static hasExcessiveNesting(buffer: Buffer): boolean {
    const maxNesting = 100;
    const sample = buffer.subarray(0, Math.min(buffer.length, 10000));
    const content = sample.toString('utf8');
    
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === '{' || char === '[') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}' || char === ']') {
        currentDepth--;
      }
    }
    
    return maxDepth > maxNesting;
  }

  /**
   * Generate file checksum
   */
  static generateChecksum(buffer: Buffer, algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): string {
    return createHash(algorithm).update(buffer).digest('hex');
  }

  /**
   * Get valid MIME types for file format
   */
  private static getValidMimeTypes(format: FileFormat): string[] {
    switch (format) {
      case FileFormat.CSV:
        return [
          'text/csv',
          'application/csv',
          'text/plain',
          'application/vnd.ms-excel'
        ];
      case FileFormat.EXCEL:
        return [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/vnd.ms-excel.sheet.macroEnabled.12',
          'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
          'application/octet-stream'
        ];
      case FileFormat.JSON:
        return [
          'application/json',
          'text/json',
          'application/x-json',
          'text/plain'
        ];
      default:
        return [];
    }
  }

  /**
   * Get valid file extensions for file format
   */
  private static getValidExtensions(format: FileFormat): string[] {
    switch (format) {
      case FileFormat.CSV:
        return ['csv', 'txt'];
      case FileFormat.EXCEL:
        return ['xlsx', 'xls', 'xlsm', 'xlsb'];
      case FileFormat.JSON:
        return ['json', 'txt'];
      default:
        return [];
    }
  }

  /**
   * Format bytes to human readable string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * File format detection utility
 */
export class FileFormatDetector {
  /**
   * Detect file format based on content and metadata
   */
  static detectFormat(buffer: Buffer, metadata: FileMetadata): FileFormat | null {
    // Try content-based detection first
    const contentFormat = this.detectFormatByContent(buffer);
    if (contentFormat) return contentFormat;

    // Fall back to extension-based detection
    return this.detectFormatByExtension(metadata.originalName);
  }

  /**
   * Detect format by analyzing file content
   */
  private static detectFormatByContent(buffer: Buffer): FileFormat | null {
    const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
    const content = sample.toString('utf8').trim();

    // Excel format detection
    if (buffer.length >= 8) {
      const signature = buffer.subarray(0, 8);
      // XLSX signature (ZIP format)
      if (signature[0] === 0x50 && signature[1] === 0x4B) {
        return FileFormat.EXCEL;
      }
      // XLS signature
      if (signature[0] === 0xD0 && signature[1] === 0xCF) {
        return FileFormat.EXCEL;
      }
    }

    // JSON format detection
    if (content.startsWith('{') || content.startsWith('[')) {
      try {
        JSON.parse(content.length > 1000 ? content.substring(0, 1000) + '}' : content);
        return FileFormat.JSON;
      } catch {
        // Not valid JSON, might be CSV
      }
    }

    // CSV format detection (basic heuristics)
    if (this.looksLikeCSV(content)) {
      return FileFormat.CSV;
    }

    return null;
  }

  /**
   * Detect format by file extension
   */
  private static detectFormatByExtension(filename: string): FileFormat | null {
    if (!filename || !filename.includes('.')) return null;

    const extension = filename.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'csv':
      case 'txt':
        return FileFormat.CSV;
      case 'xlsx':
      case 'xls':
      case 'xlsm':
      case 'xlsb':
        return FileFormat.EXCEL;
      case 'json':
        return FileFormat.JSON;
      default:
        return null;
    }
  }

  /**
   * Basic heuristic to detect CSV-like content
   */
  private static looksLikeCSV(content: string): boolean {
    const lines = content.split('\n').slice(0, 5); // Check first 5 lines
    if (lines.length < 2) return false;

    // Check for common CSV patterns
    const commonDelimiters = [',', ';', '\t'];
    
    for (const delimiter of commonDelimiters) {
      const firstLineFields = lines[0].split(delimiter);
      if (firstLineFields.length < 2) continue;

      // Check if other lines have similar field count
      let consistentFieldCount = 0;
      for (let i = 1; i < lines.length && lines[i].trim(); i++) {
        const fields = lines[i].split(delimiter);
        if (Math.abs(fields.length - firstLineFields.length) <= 1) {
          consistentFieldCount++;
        }
      }

      // If most lines have consistent field count, likely CSV
      if (consistentFieldCount >= Math.min(lines.length - 1, 2)) {
        return true;
      }
    }

    return false;
  }
}