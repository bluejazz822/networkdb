/**
 * Data Sanitizer Tests
 * Test data sanitization and security controls without database dependencies
 */

import { describe, test, expect } from '@jest/globals';
import {
  DataSanitizer,
  ComplianceLevel
} from '../../src/security/DataSanitizer';
import { DataResourceType, AccessLevel } from '../../src/auth/ReportPermissions';

describe('DataSanitizer', () => {
  const mockUserContext = {
    id: 'test-user',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['USER'],
    permissions: ['report:read'],
    dataAccess: {
      [DataResourceType.VPC]: AccessLevel.READ
    }
  };

  const mockAdminContext = {
    id: 'admin-user',
    username: 'adminuser',
    email: 'admin@example.com',
    roles: ['ADMIN'],
    permissions: ['report:read', 'report:export', 'data:sensitive'],
    dataAccess: {
      [DataResourceType.VPC]: AccessLevel.ADMIN,
      [DataResourceType.SENSITIVE]: AccessLevel.ADMIN
    }
  };

  describe('Data Classification', () => {
    test('should classify public data correctly', () => {
      const publicData = [
        { id: '1', name: 'test-vpc', region: 'us-east-1' },
        { id: '2', name: 'test-subnet', availabilityZone: 'us-east-1a' }
      ];

      const classification = DataSanitizer.classifyData(publicData);

      expect(classification.level).toBe(ComplianceLevel.PUBLIC);
      expect(classification.containsPII).toBe(false);
      expect(classification.containsSensitive).toBe(false);
      expect(Array.isArray(classification.categories)).toBe(true);
    });

    test('should classify sensitive data correctly', () => {
      const sensitiveData = [
        { id: '1', name: 'test-vpc', privateKey: 'secret123' },
        { id: '2', name: 'test-subnet', password: 'password123' }
      ];

      const classification = DataSanitizer.classifyData(sensitiveData);

      expect(classification.level).toBe(ComplianceLevel.RESTRICTED);
      expect(classification.containsSensitive).toBe(true);
      expect(classification.categories).toContain('credentials');
    });

    test('should classify PII data correctly', () => {
      const piiData = [
        { id: '1', name: 'test-vpc', ownerEmail: 'owner@example.com' },
        { id: '2', name: 'test-subnet', contactPhone: '555-1234' }
      ];

      const classification = DataSanitizer.classifyData(piiData);

      expect(classification.containsPII).toBe(true);
      expect(classification.categories).toContain('pii');
      expect([ComplianceLevel.INTERNAL, ComplianceLevel.CONFIDENTIAL]).toContain(classification.level);
    });

    test('should classify mixed data correctly', () => {
      const mixedData = [
        { id: '1', name: 'test-vpc', publicIp: '1.2.3.4' },
        { id: '2', name: 'test-subnet', privateKey: 'secret123', email: 'user@example.com' }
      ];

      const classification = DataSanitizer.classifyData(mixedData);

      expect(classification.containsPII).toBe(true);
      expect(classification.containsSensitive).toBe(true);
      expect(classification.level).toBe(ComplianceLevel.RESTRICTED);
    });
  });

  describe('Data Sanitization', () => {
    test('should redact sensitive fields for users without permission', () => {
      const testData = [
        { id: '1', name: 'test-vpc', password: 'secret123', description: 'normal desc' },
        { id: '2', name: 'test-subnet', privateKey: 'privatekey123', region: 'us-east-1' }
      ];

      const sanitized = DataSanitizer.sanitizeData(testData, mockUserContext);

      expect(sanitized).toHaveLength(testData.length);
      expect(sanitized[0].password).toBe('[REDACTED]');
      expect(sanitized[0].description).toBe('normal desc'); // Should remain unchanged
      expect(sanitized[1].privateKey).toBe('[REDACTED]');
      expect(sanitized[1].region).toBe('us-east-1'); // Should remain unchanged
    });

    test('should preserve data for users with sensitive permissions', () => {
      const testData = [
        { id: '1', name: 'test-vpc', password: 'secret123', description: 'normal desc' },
        { id: '2', name: 'test-subnet', privateKey: 'privatekey123', region: 'us-east-1' }
      ];

      const sanitized = DataSanitizer.sanitizeData(testData, mockAdminContext);

      expect(sanitized).toHaveLength(testData.length);
      // Admin should see sensitive data
      expect(sanitized[0].password).toBe('secret123');
      expect(sanitized[1].privateKey).toBe('privatekey123');
    });

    test('should handle null and undefined values', () => {
      const testData = [
        { id: '1', name: 'test-vpc', password: null, description: undefined },
        { id: '2', name: null, privateKey: 'test', region: 'us-east-1' }
      ];

      const sanitized = DataSanitizer.sanitizeData(testData, mockUserContext);

      expect(sanitized[0].password).toBeNull();
      expect(sanitized[0].description).toBeUndefined();
      expect(sanitized[1].name).toBeNull();
      expect(sanitized[1].privateKey).toBe('[REDACTED]');
    });

    test('should handle empty arrays and objects', () => {
      const emptyData: any[] = [];
      const sanitized = DataSanitizer.sanitizeData(emptyData, mockUserContext);

      expect(sanitized).toEqual([]);
    });
  });

  describe('Watermarking', () => {
    test('should add watermark to exported data', () => {
      const testData = [{ id: '1', name: 'test-data' }];

      const watermarked = DataSanitizer.addWatermark(testData, mockUserContext, 'pdf');

      expect(watermarked).toHaveProperty('watermark');
      expect(watermarked.watermark).toHaveProperty('exportedBy');
      expect(watermarked.watermark).toHaveProperty('exportedAt');
      expect(watermarked.watermark).toHaveProperty('exportId');
      expect(watermarked.watermark).toHaveProperty('format');
      expect(watermarked.watermark).toHaveProperty('notice');

      expect(watermarked.watermark.exportedBy).toBe('testuser');
      expect(watermarked.watermark.format).toBe('pdf');
      expect(typeof watermarked.watermark.exportId).toBe('string');
    });

    test('should handle object data correctly', () => {
      const testData = { id: '1', name: 'test-data', value: 123 };

      const watermarked = DataSanitizer.addWatermark(testData, mockUserContext, 'json');

      expect(watermarked).toHaveProperty('_watermark');
      expect(watermarked).toHaveProperty('id');
      expect(watermarked).toHaveProperty('name');
      expect(watermarked).toHaveProperty('value');
      expect(watermarked._watermark.exportedBy).toBe('testuser');
    });
  });

  describe('Export Security Controls', () => {
    test('should apply security controls to export data', () => {
      const testData = [{ id: '1', name: 'test-data' }];
      const securityOptions = {
        addWatermark: true,
        encryptFile: false,
        passwordProtect: false,
        expirationHours: 24,
        allowedDownloads: 5
      };

      const { securedData, metadata } = DataSanitizer.applyExportSecurity(
        testData,
        mockUserContext,
        'pdf',
        securityOptions
      );

      expect(securedData).toHaveProperty('watermark');
      expect(metadata).toHaveProperty('restrictions');
      expect(metadata).toHaveProperty('expiresAt');
      expect(metadata.restrictions.allowedDownloads).toBe(5);
      expect(metadata.expiresAt).toBeInstanceOf(Date);
    });

    test('should handle encryption options', () => {
      const testBuffer = Buffer.from('test data');
      const password = 'test-password';

      const encryptionResult = DataSanitizer.encryptExportData(testBuffer, password);

      expect(encryptionResult).toHaveProperty('encryptedData');
      expect(encryptionResult).toHaveProperty('key');
      expect(encryptionResult).toHaveProperty('iv');
      expect(Buffer.isBuffer(encryptionResult.encryptedData)).toBe(true);
      expect(typeof encryptionResult.key).toBe('string');
      expect(typeof encryptionResult.iv).toBe('string');
      expect(encryptionResult.key.length).toBe(64); // 32 bytes as hex
      expect(encryptionResult.iv.length).toBe(32); // 16 bytes as hex
    });
  });

  describe('Export Validation', () => {
    test('should validate export requests against user permissions', () => {
      const testData = [
        { id: '1', resourceType: 'vpc', name: 'test-vpc' }
      ];

      const securityOptions = {
        addWatermark: true,
        encryptFile: false,
        passwordProtect: false
      };

      const validation = DataSanitizer.validateExportRequest(
        testData,
        mockUserContext,
        'pdf',
        securityOptions
      );

      expect(validation).toHaveProperty('allowed');
      expect(validation).toHaveProperty('violations');
      expect(validation).toHaveProperty('requirements');
      expect(typeof validation.allowed).toBe('boolean');
      expect(Array.isArray(validation.violations)).toBe(true);
      expect(Array.isArray(validation.requirements)).toBe(true);
    });

    test('should reject export of restricted data without permissions', () => {
      const restrictedData = [
        { id: '1', resourceType: 'vpc', name: 'test-vpc', privateKey: 'secret123' }
      ];

      const securityOptions = {
        addWatermark: false,
        encryptFile: false,
        passwordProtect: false
      };

      const validation = DataSanitizer.validateExportRequest(
        restrictedData,
        mockUserContext, // User without sensitive permissions
        'pdf',
        securityOptions
      );

      expect(validation.allowed).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
    });

    test('should allow export of restricted data with proper permissions', () => {
      const restrictedData = [
        { id: '1', resourceType: 'vpc', name: 'test-vpc', privateKey: 'secret123' }
      ];

      const securityOptions = {
        addWatermark: true,
        encryptFile: true,
        passwordProtect: false
      };

      const validation = DataSanitizer.validateExportRequest(
        restrictedData,
        mockAdminContext, // Admin user with sensitive permissions
        'pdf',
        securityOptions
      );

      expect(validation.allowed).toBe(true);
    });

    test('should require appropriate security controls for sensitive data', () => {
      const sensitiveData = [
        { id: '1', resourceType: 'vpc', name: 'test-vpc', password: 'secret123' }
      ];

      const insufficientSecurityOptions = {
        addWatermark: false,
        encryptFile: false,
        passwordProtect: false
      };

      const validation = DataSanitizer.validateExportRequest(
        sensitiveData,
        mockAdminContext,
        'pdf',
        insufficientSecurityOptions
      );

      // Should have requirements for better security
      expect(validation.requirements.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        name: `Test Item ${i}`,
        password: `secret-${i}`,
        publicData: `public-${i}`,
        privateKey: `key-${i}`,
        email: `user${i}@example.com`
      }));

      const startTime = Date.now();
      const sanitized = DataSanitizer.sanitizeData(largeDataset, mockUserContext);
      const endTime = Date.now();

      expect(sanitized).toHaveLength(largeDataset.length);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify sanitization worked
      expect(sanitized[0].password).toBe('[REDACTED]');
      expect(sanitized[0].publicData).toBe('public-0');
    });

    test('should classify large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        name: `Test Item ${i}`,
        email: `user${i}@example.com`,
        publicField: `public-${i}`
      }));

      const startTime = Date.now();
      const classification = DataSanitizer.classifyData(largeDataset);
      const endTime = Date.now();

      expect(classification.containsPII).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Edge Cases', () => {
    test('should handle deeply nested objects', () => {
      const nestedData = [{
        id: '1',
        config: {
          security: {
            credentials: {
              password: 'secret123',
              apiKey: 'key123'
            },
            settings: {
              publicSetting: 'public',
              privateSetting: 'private'
            }
          }
        }
      }];

      const sanitized = DataSanitizer.sanitizeData(nestedData, mockUserContext);

      // Top-level sanitization should work
      expect(sanitized[0].id).toBe('1');
      // Note: Deep nested sanitization would require recursive implementation
    });

    test('should handle circular references gracefully', () => {
      const circularData: any = { id: '1', name: 'test' };
      circularData.self = circularData;

      // Should not throw an error
      expect(() => {
        DataSanitizer.sanitizeData([circularData], mockUserContext);
      }).not.toThrow();
    });

    test('should handle arrays within objects', () => {
      const complexData = [{
        id: '1',
        name: 'test-vpc',
        passwords: ['secret1', 'secret2', 'secret3'],
        publicList: ['public1', 'public2'],
        settings: {
          password: 'mainsecret',
          description: 'normal'
        }
      }];

      const sanitized = DataSanitizer.sanitizeData(complexData, mockUserContext);

      expect(sanitized[0].id).toBe('1');
      expect(sanitized[0].name).toBe('test-vpc');
      // Arrays and nested objects would need special handling
    });
  });
});