/**
 * Data Sanitizer
 * Secure data handling, sanitization, and export controls for reports
 */

import crypto from 'crypto';
import { ReportUserContext, DataResourceType } from '../auth/ReportPermissions';
import { ReportAuditLogger } from '../audit/ReportAuditLogger';

/**
 * Sensitive field patterns that should be redacted
 */
const SENSITIVE_FIELD_PATTERNS = [
  // Credentials and secrets
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /credential/i,
  /auth/i,
  /apikey/i,
  /api_key/i,

  // Network security
  /private.*key/i,
  /certificate/i,
  /cert/i,
  /ssl/i,
  /tls/i,
  /vpn.*key/i,
  /encryption.*key/i,

  // IP addresses and network details
  /private.*ip/i,
  /internal.*ip/i,
  /private.*address/i,
  /internal.*address/i,
  /management.*ip/i,
  /admin.*ip/i,

  // Connection strings and URIs
  /connection.*string/i,
  /database.*url/i,
  /db.*connection/i,
  /jdbc/i,
  /mongodb/i,
  /mysql/i,
  /postgres/i,

  // Financial and personal data
  /credit.*card/i,
  /ssn/i,
  /social.*security/i,
  /account.*number/i,
  /routing.*number/i,
  /tax.*id/i,

  // Configuration details
  /config.*secret/i,
  /environment.*var/i,
  /env.*var/i,
  /sensitive.*config/i
];

/**
 * Field names that should always be redacted
 */
const ALWAYS_REDACT_FIELDS = new Set([
  'password',
  'passwordHash',
  'secret',
  'privateKey',
  'secretKey',
  'apiKey',
  'token',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'authToken',
  'certificate',
  'privateIp',
  'internalIp',
  'managementIp',
  'connectionString',
  'databaseUrl',
  'mongoUrl',
  'redisUrl'
]);

/**
 * PII field patterns
 */
const PII_FIELD_PATTERNS = [
  /email/i,
  /phone/i,
  /address/i,
  /name/i,
  /first.*name/i,
  /last.*name/i,
  /full.*name/i,
  /ssn/i,
  /social/i,
  /birth.*date/i,
  /date.*of.*birth/i
];

/**
 * Compliance classification levels
 */
export enum ComplianceLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

/**
 * Data classification interface
 */
export interface DataClassification {
  level: ComplianceLevel;
  categories: string[];
  containsPII: boolean;
  containsSensitive: boolean;
  retentionPeriod?: number; // days
  exportRestrictions?: string[];
}

/**
 * Sanitization options
 */
export interface SanitizationOptions {
  redactSensitive: boolean;
  redactPII: boolean;
  maskingChar: string;
  preserveLength: boolean;
  allowPartialView: boolean;
  partialViewChars: number;
  customRedactFields?: string[];
  customMaskPatterns?: RegExp[];
}

/**
 * Export security options
 */
export interface ExportSecurityOptions {
  addWatermark: boolean;
  encryptFile: boolean;
  passwordProtect: boolean;
  password?: string;
  expirationHours?: number;
  allowedDownloads?: number;
  restrictByIP?: boolean;
  allowedIPs?: string[];
}

/**
 * Default sanitization options
 */
const DEFAULT_SANITIZATION_OPTIONS: SanitizationOptions = {
  redactSensitive: true,
  redactPII: true,
  maskingChar: '*',
  preserveLength: false,
  allowPartialView: false,
  partialViewChars: 3
};

/**
 * Data Sanitizer Service
 */
export class DataSanitizer {
  /**
   * Classify data based on content analysis
   */
  static classifyData(data: any[]): DataClassification {
    let containsPII = false;
    let containsSensitive = false;
    let maxLevel = ComplianceLevel.PUBLIC;
    const categories = new Set<string>();

    for (const item of data) {
      const analysis = this.analyzeRecord(item);

      if (analysis.containsPII) containsPII = true;
      if (analysis.containsSensitive) containsSensitive = true;

      // Update max level
      if (this.getComplianceLevelPriority(analysis.level) > this.getComplianceLevelPriority(maxLevel)) {
        maxLevel = analysis.level;
      }

      analysis.categories.forEach(cat => categories.add(cat));
    }

    return {
      level: maxLevel,
      categories: Array.from(categories),
      containsPII,
      containsSensitive,
      retentionPeriod: this.getRetentionPeriod(maxLevel),
      exportRestrictions: this.getExportRestrictions(maxLevel)
    };
  }

  /**
   * Analyze a single record for sensitive content
   */
  private static analyzeRecord(record: any): {
    level: ComplianceLevel;
    categories: string[];
    containsPII: boolean;
    containsSensitive: boolean;
  } {
    let level = ComplianceLevel.PUBLIC;
    const categories = new Set<string>();
    let containsPII = false;
    let containsSensitive = false;

    const fieldNames = Object.keys(record || {});
    const stringified = JSON.stringify(record).toLowerCase();

    // Check for sensitive fields
    for (const fieldName of fieldNames) {
      const lowerFieldName = fieldName.toLowerCase();

      // Check if field is always redacted
      if (ALWAYS_REDACT_FIELDS.has(lowerFieldName)) {
        containsSensitive = true;
        level = ComplianceLevel.RESTRICTED;
        categories.add('credentials');
      }

      // Check sensitive patterns
      for (const pattern of SENSITIVE_FIELD_PATTERNS) {
        if (pattern.test(fieldName)) {
          containsSensitive = true;
          level = ComplianceLevel.CONFIDENTIAL;
          categories.add('sensitive');
          break;
        }
      }

      // Check PII patterns
      for (const pattern of PII_FIELD_PATTERNS) {
        if (pattern.test(fieldName)) {
          containsPII = true;
          if (level === ComplianceLevel.PUBLIC) {
            level = ComplianceLevel.INTERNAL;
          }
          categories.add('pii');
          break;
        }
      }
    }

    // Content-based analysis
    if (stringified.includes('password') || stringified.includes('secret')) {
      containsSensitive = true;
      level = ComplianceLevel.RESTRICTED;
      categories.add('credentials');
    }

    if (stringified.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)) {
      categories.add('network');
      if (level === ComplianceLevel.PUBLIC) {
        level = ComplianceLevel.INTERNAL;
      }
    }

    return {
      level,
      categories: Array.from(categories),
      containsPII,
      containsSensitive
    };
  }

  /**
   * Sanitize data based on user permissions and options
   */
  static sanitizeData(
    data: any[],
    user: ReportUserContext,
    options: Partial<SanitizationOptions> = {}
  ): any[] {
    const opts = { ...DEFAULT_SANITIZATION_OPTIONS, ...options };

    // Log sensitive data access if applicable
    const classification = this.classifyData(data);
    if (classification.containsSensitive) {
      ReportAuditLogger.logSensitiveDataAccess(
        user,
        'report_data',
        { classification, recordCount: data.length }
      );
    }

    return data.map(record => this.sanitizeRecord(record, user, opts));
  }

  /**
   * Sanitize a single record
   */
  private static sanitizeRecord(
    record: any,
    user: ReportUserContext,
    options: SanitizationOptions
  ): any {
    if (!record || typeof record !== 'object') {
      return record;
    }

    const sanitized = { ...record };

    for (const [key, value] of Object.entries(record)) {
      if (this.shouldRedactField(key, value, user, options)) {
        sanitized[key] = this.redactValue(value, options);
      } else if (this.shouldMaskField(key, value, user, options)) {
        sanitized[key] = this.maskValue(value, options);
      }
    }

    return sanitized;
  }

  /**
   * Check if a field should be completely redacted
   */
  private static shouldRedactField(
    fieldName: string,
    value: any,
    user: ReportUserContext,
    options: SanitizationOptions
  ): boolean {
    const lowerFieldName = fieldName.toLowerCase();

    // Always redact certain fields
    if (ALWAYS_REDACT_FIELDS.has(lowerFieldName)) {
      return true;
    }

    // Check custom redact fields
    if (options.customRedactFields?.includes(fieldName)) {
      return true;
    }

    // Check if user lacks permission for sensitive data
    if (options.redactSensitive && !user.dataAccess[DataResourceType.SENSITIVE]) {
      for (const pattern of SENSITIVE_FIELD_PATTERNS) {
        if (pattern.test(fieldName)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a field should be masked (partially visible)
   */
  private static shouldMaskField(
    fieldName: string,
    value: any,
    user: ReportUserContext,
    options: SanitizationOptions
  ): boolean {
    if (!options.redactPII) return false;

    // Only mask if user doesn't have full access to PII
    if (user.dataAccess[DataResourceType.SENSITIVE]) {
      return false;
    }

    for (const pattern of PII_FIELD_PATTERNS) {
      if (pattern.test(fieldName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Redact a value completely
   */
  private static redactValue(value: any, options: SanitizationOptions): string {
    if (value === null || value === undefined) {
      return value;
    }

    const strValue = String(value);

    if (options.preserveLength) {
      return options.maskingChar.repeat(strValue.length);
    }

    return '[REDACTED]';
  }

  /**
   * Mask a value (show partial content)
   */
  private static maskValue(value: any, options: SanitizationOptions): string {
    if (value === null || value === undefined) {
      return value;
    }

    const strValue = String(value);

    if (!options.allowPartialView || strValue.length <= options.partialViewChars) {
      return this.redactValue(value, options);
    }

    const visibleChars = options.partialViewChars;
    const maskedLength = strValue.length - visibleChars;
    const visible = strValue.substring(0, visibleChars);
    const masked = options.maskingChar.repeat(maskedLength);

    return visible + masked;
  }

  /**
   * Add watermark to exported data
   */
  static addWatermark(
    data: any,
    user: ReportUserContext,
    exportFormat: string
  ): any {
    const watermark = {
      exportedBy: user.username,
      exportedAt: new Date().toISOString(),
      exportId: crypto.randomBytes(8).toString('hex'),
      format: exportFormat,
      notice: 'This report contains confidential information. Unauthorized distribution is prohibited.'
    };

    if (Array.isArray(data)) {
      return {
        watermark,
        data
      };
    } else {
      return {
        ...data,
        _watermark: watermark
      };
    }
  }

  /**
   * Encrypt exported file data
   */
  static encryptExportData(
    data: Buffer,
    password?: string
  ): { encryptedData: Buffer; key: string; iv: string } {
    const key = password ?
      crypto.scryptSync(password, 'salt', 32) :
      crypto.randomBytes(32);

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);

    const encryptedData = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);

    return {
      encryptedData,
      key: key.toString('hex'),
      iv: iv.toString('hex')
    };
  }

  /**
   * Apply export security controls
   */
  static applyExportSecurity(
    data: any,
    user: ReportUserContext,
    format: string,
    options: ExportSecurityOptions
  ): {
    securedData: any;
    metadata: {
      encryption?: { key: string; iv: string };
      restrictions: any;
      expiresAt?: Date;
    };
  } {
    let securedData = data;
    const metadata: any = {
      restrictions: {
        allowedDownloads: options.allowedDownloads || null,
        restrictByIP: options.restrictByIP || false,
        allowedIPs: options.allowedIPs || []
      }
    };

    // Add watermark
    if (options.addWatermark) {
      securedData = this.addWatermark(securedData, user, format);
    }

    // Set expiration
    if (options.expirationHours) {
      metadata.expiresAt = new Date(
        Date.now() + options.expirationHours * 60 * 60 * 1000
      );
    }

    // Encrypt if requested
    if (options.encryptFile && Buffer.isBuffer(securedData)) {
      const encryption = this.encryptExportData(securedData, options.password);
      securedData = encryption.encryptedData;
      metadata.encryption = {
        key: encryption.key,
        iv: encryption.iv
      };
    }

    return {
      securedData,
      metadata
    };
  }

  /**
   * Get compliance level priority for comparison
   */
  private static getComplianceLevelPriority(level: ComplianceLevel): number {
    const priorities = {
      [ComplianceLevel.PUBLIC]: 1,
      [ComplianceLevel.INTERNAL]: 2,
      [ComplianceLevel.CONFIDENTIAL]: 3,
      [ComplianceLevel.RESTRICTED]: 4
    };
    return priorities[level] || 1;
  }

  /**
   * Get retention period based on compliance level
   */
  private static getRetentionPeriod(level: ComplianceLevel): number {
    const periods = {
      [ComplianceLevel.PUBLIC]: 365,      // 1 year
      [ComplianceLevel.INTERNAL]: 180,    // 6 months
      [ComplianceLevel.CONFIDENTIAL]: 90, // 3 months
      [ComplianceLevel.RESTRICTED]: 30    // 1 month
    };
    return periods[level] || 365;
  }

  /**
   * Get export restrictions based on compliance level
   */
  private static getExportRestrictions(level: ComplianceLevel): string[] {
    const restrictions = {
      [ComplianceLevel.PUBLIC]: [],
      [ComplianceLevel.INTERNAL]: ['watermark_required'],
      [ComplianceLevel.CONFIDENTIAL]: ['watermark_required', 'encryption_recommended'],
      [ComplianceLevel.RESTRICTED]: ['watermark_required', 'encryption_required', 'approval_required']
    };
    return restrictions[level] || [];
  }

  /**
   * Validate export request against security policies
   */
  static validateExportRequest(
    data: any[],
    user: ReportUserContext,
    format: string,
    options: ExportSecurityOptions
  ): { allowed: boolean; violations: string[]; requirements: string[] } {
    const violations: string[] = [];
    const requirements: string[] = [];

    const classification = this.classifyData(data);

    // Check if user has export permission for this data classification
    if (classification.level === ComplianceLevel.RESTRICTED &&
        !user.dataAccess[DataResourceType.SENSITIVE]) {
      violations.push('User lacks permission to export restricted data');
    }

    // Check export restrictions
    for (const restriction of classification.exportRestrictions || []) {
      switch (restriction) {
        case 'watermark_required':
          if (!options.addWatermark) {
            requirements.push('Watermark is required for this data classification');
          }
          break;
        case 'encryption_required':
          if (!options.encryptFile) {
            violations.push('Encryption is required for this data classification');
          }
          break;
        case 'encryption_recommended':
          if (!options.encryptFile) {
            requirements.push('Encryption is recommended for this data classification');
          }
          break;
        case 'approval_required':
          // This would integrate with an approval workflow
          requirements.push('Manager approval required for this export');
          break;
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
      requirements
    };
  }
}

export default DataSanitizer;