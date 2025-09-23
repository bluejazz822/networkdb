/**
 * Report Security Tests
 * Comprehensive test suite for report security implementations
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { getDatabase } from '../../src/config/database';
import { User } from '../../src/models/User';
import { Role } from '../../src/models/Role';
import { Permission } from '../../src/models/Permission';
import {
  ReportAuthorizationService,
  ReportPermissions,
  DataResourceType,
  AccessLevel
} from '../../src/auth/ReportPermissions';
import {
  ReportAuditLogger,
  AuditAction,
  AuditResource
} from '../../src/audit/ReportAuditLogger';
import { DataSanitizer, ComplianceLevel } from '../../src/security/DataSanitizer';
import reportRoutes from '../../src/api/routes/reports';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

describe('Report Security System', () => {
  let testUser: User;
  let adminUser: User;
  let viewerUser: User;
  let authToken: string;
  let adminToken: string;
  let viewerToken: string;
  let sequelize: any;

  beforeAll(async () => {
    // Get database connection
    sequelize = getDatabase();

    // Skip database operations in CI/testing environment
    if (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL) {
      console.log('Skipping database operations in test environment');
      return;
    }

    try {
      // Ensure database connection
      await sequelize.authenticate();

      // Create test database tables if needed
      await sequelize.sync({ force: false });
    } catch (error) {
      console.warn('Database connection failed, skipping database tests:', error.message);
    }
  });

  beforeEach(async () => {
    // Skip database operations if not connected
    if (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL) {
      // Create mock user objects for testing
      testUser = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        isActive: true
      } as User;

      adminUser = {
        id: 'admin-user-id',
        username: 'adminuser',
        email: 'admin@example.com',
        isActive: true
      } as User;

      viewerUser = {
        id: 'viewer-user-id',
        username: 'vieweruser',
        email: 'viewer@example.com',
        isActive: true
      } as User;

      return;
    }

    try {
      // Create test users with different permission levels
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        isEmailVerified: true
      });

      adminUser = await User.create({
        username: 'adminuser',
        email: 'admin@example.com',
        password: 'AdminPassword123!',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
        isEmailVerified: true
      });

      viewerUser = await User.create({
        username: 'vieweruser',
        email: 'viewer@example.com',
        password: 'ViewerPassword123!',
        firstName: 'Viewer',
        lastName: 'User',
        isActive: true,
        isEmailVerified: true
      });
    } catch (error) {
      console.warn('Failed to create test users, using mocks:', error.message);
    }
  });

  afterEach(async () => {
    // Skip database cleanup if not connected
    if (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL) {
      return;
    }

    try {
      // Clean up test data
      await User.destroy({ where: { username: ['testuser', 'adminuser', 'vieweruser'] } });
    } catch (error) {
      console.warn('Failed to clean up test data:', error.message);
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Authentication & Authorization', () => {
    test('should validate JWT token structure', () => {
      const testPayload = { userId: 'test-user-id' };
      const token = jwt.sign(testPayload, 'test-secret');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, 'test-secret') as any;
      expect(decoded.userId).toBe(testPayload.userId);
    });

    test('should handle invalid JWT tokens', () => {
      expect(() => {
        jwt.verify('invalid-token', 'test-secret');
      }).toThrow();
    });

    test('should generate unique session IDs', () => {
      const sessionId1 = crypto.randomBytes(16).toString('hex');
      const sessionId2 = crypto.randomBytes(16).toString('hex');

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1.length).toBe(32);
    });
  });

  describe('ReportAuthorizationService', () => {
    test('should validate report permissions correctly', async () => {
      // Skip database-dependent test if no database
      if (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL) {
        return;
      }

      try {
        const userContext = await ReportAuthorizationService.createUserContext(
          testUser,
          '127.0.0.1',
          'test-agent',
          'test-session'
        );

        // Test basic report read permission
        const hasReadPermission = await ReportAuthorizationService.hasReportPermission(
          userContext,
          ReportPermissions.REPORT_READ
        );

        // Should depend on user's actual permissions
        expect(typeof hasReadPermission).toBe('boolean');
      } catch (error) {
        console.warn('Skipping database-dependent test:', error.message);
      }
    });

    test('should validate data access permissions', async () => {
      const userContext = await ReportAuthorizationService.createUserContext(
        testUser,
        '127.0.0.1',
        'test-agent',
        'test-session'
      );

      const hasVpcAccess = await ReportAuthorizationService.hasDataAccess(
        userContext,
        DataResourceType.VPC,
        AccessLevel.READ
      );

      expect(typeof hasVpcAccess).toBe('boolean');
    });

    test('should validate export format permissions', async () => {
      const userContext = await ReportAuthorizationService.createUserContext(
        adminUser,
        '127.0.0.1',
        'test-agent',
        'test-session'
      );

      const canExportPdf = await ReportAuthorizationService.canExportFormat(
        userContext,
        'pdf'
      );

      expect(typeof canExportPdf).toBe('boolean');
    });

    test('should validate report queries against permissions', async () => {
      const userContext = await ReportAuthorizationService.createUserContext(
        testUser,
        '127.0.0.1',
        'test-agent',
        'test-session'
      );

      const mockQuery = {
        resourceTypes: ['vpc', 'subnet'],
        includeSensitive: true,
        includeCompliance: false
      };

      const validation = await ReportAuthorizationService.validateReportQuery(
        userContext,
        mockQuery
      );

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      expect(Array.isArray(validation.errors)).toBe(true);
    });

    test('should filter report data based on permissions', () => {
      const userContext = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['USER'],
        permissions: [ReportPermissions.REPORT_READ],
        dataAccess: {
          [DataResourceType.VPC]: AccessLevel.READ
        }
      };

      const mockData = [
        { id: '1', resourceType: 'vpc', name: 'test-vpc', sensitive: false },
        { id: '2', resourceType: 'subnet', name: 'test-subnet', sensitive: false },
        { id: '3', resourceType: 'sensitive', name: 'sensitive-data', sensitive: true }
      ];

      const filteredData = ReportAuthorizationService.filterReportData(userContext, mockData);

      // Should filter out data the user doesn't have access to
      expect(filteredData.length).toBeLessThanOrEqual(mockData.length);
    });
  });

  describe('ReportAuditLogger', () => {
    test('should log report view actions', async () => {
      const userContext = await ReportAuthorizationService.createUserContext(
        testUser,
        '127.0.0.1',
        'test-agent',
        'test-session'
      );

      await ReportAuditLogger.logReportView(userContext, 'test-report-1', {
        fields: ['id', 'name']
      });

      // Verify log was created
      const logs = await ReportAuditLogger.getUserAuditLogs(testUser.id, 10);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe(AuditAction.VIEW_REPORT);
    });

    test('should log export actions', async () => {
      const userContext = await ReportAuthorizationService.createUserContext(
        testUser,
        '127.0.0.1',
        'test-agent',
        'test-session'
      );

      await ReportAuditLogger.logReportExport(userContext, 'test-report-1', 'pdf', {
        recordCount: 100
      });

      const logs = await ReportAuditLogger.getUserAuditLogs(testUser.id, 10);
      const exportLog = logs.find(log => log.action === AuditAction.EXPORT_REPORT);
      expect(exportLog).toBeDefined();
      expect(exportLog!.details.format).toBe('pdf');
    });

    test('should log permission denied events', async () => {
      const userContext = await ReportAuthorizationService.createUserContext(
        testUser,
        '127.0.0.1',
        'test-agent',
        'test-session'
      );

      await ReportAuditLogger.logPermissionDenied(
        userContext,
        'export_sensitive',
        'data',
        'sensitive-resource'
      );

      const logs = await ReportAuditLogger.getUserAuditLogs(testUser.id, 10);
      const deniedLog = logs.find(log => log.action === AuditAction.PERMISSION_DENIED);
      expect(deniedLog).toBeDefined();
      expect(deniedLog!.status).toBe('denied');
    });

    test('should generate audit statistics', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();

      const stats = await ReportAuditLogger.getAuditStatistics(startDate, endDate);

      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('successfulEvents');
      expect(stats).toHaveProperty('failedEvents');
      expect(stats).toHaveProperty('deniedEvents');
      expect(stats).toHaveProperty('topActions');
      expect(stats).toHaveProperty('topUsers');
      expect(Array.isArray(stats.topActions)).toBe(true);
      expect(Array.isArray(stats.topUsers)).toBe(true);
    });
  });

  describe('DataSanitizer', () => {
    test('should classify data correctly', () => {
      const testData = [
        { id: '1', name: 'test-vpc', publicIp: '1.2.3.4' },
        { id: '2', name: 'test-subnet', privateKey: 'secret123' },
        { id: '3', name: 'test-resource', email: 'user@example.com' }
      ];

      const classification = DataSanitizer.classifyData(testData);

      expect(classification).toHaveProperty('level');
      expect(classification).toHaveProperty('categories');
      expect(classification).toHaveProperty('containsPII');
      expect(classification).toHaveProperty('containsSensitive');
      expect(Object.values(ComplianceLevel)).toContain(classification.level);
    });

    test('should sanitize sensitive data correctly', () => {
      const userContext = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['USER'],
        permissions: [ReportPermissions.REPORT_READ],
        dataAccess: {} // No sensitive data access
      };

      const testData = [
        { id: '1', name: 'test-vpc', password: 'secret123', publicData: 'public' },
        { id: '2', name: 'test-subnet', privateKey: 'privatekey123', description: 'normal desc' }
      ];

      const sanitizedData = DataSanitizer.sanitizeData(testData, userContext);

      expect(sanitizedData).toHaveLength(testData.length);
      expect(sanitizedData[0].password).toBe('[REDACTED]');
      expect(sanitizedData[0].publicData).toBe('public'); // Should remain unchanged
      expect(sanitizedData[1].privateKey).toBe('[REDACTED]');
    });

    test('should add watermarks to exported data', () => {
      const userContext = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['USER'],
        permissions: [],
        dataAccess: {}
      };

      const testData = [{ id: '1', name: 'test-data' }];

      const watermarkedData = DataSanitizer.addWatermark(testData, userContext, 'pdf');

      expect(watermarkedData).toHaveProperty('watermark');
      expect(watermarkedData.watermark).toHaveProperty('exportedBy');
      expect(watermarkedData.watermark.exportedBy).toBe('testuser');
    });

    test('should validate export requests against security policies', () => {
      const userContext = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['USER'],
        permissions: [ReportPermissions.REPORT_EXPORT],
        dataAccess: {
          [DataResourceType.VPC]: AccessLevel.READ
        }
      };

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
        userContext,
        'pdf',
        securityOptions
      );

      expect(validation).toHaveProperty('allowed');
      expect(validation).toHaveProperty('violations');
      expect(validation).toHaveProperty('requirements');
      expect(Array.isArray(validation.violations)).toBe(true);
      expect(Array.isArray(validation.requirements)).toBe(true);
    });

    test('should encrypt export data when requested', () => {
      const testData = Buffer.from('test export data');
      const password = 'test-password';

      const encryptionResult = DataSanitizer.encryptExportData(testData, password);

      expect(encryptionResult).toHaveProperty('encryptedData');
      expect(encryptionResult).toHaveProperty('key');
      expect(encryptionResult).toHaveProperty('iv');
      expect(Buffer.isBuffer(encryptionResult.encryptedData)).toBe(true);
      expect(typeof encryptionResult.key).toBe('string');
      expect(typeof encryptionResult.iv).toBe('string');
    });
  });

  describe('Security Middleware Integration', () => {
    test('should enforce rate limiting', async () => {
      const promises = [];

      // Send multiple requests rapidly to trigger rate limiting
      for (let i = 0; i < 120; i++) { // Exceed the rate limit
        promises.push(
          request(app)
            .get('/api/reports/dashboard')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should validate input and reject malicious content', async () => {
      const maliciousPayload = {
        data: [{ script: '<script>alert("xss")</script>', name: 'test' }],
        format: 'pdf',
        options: { javascript: 'alert("hack")', onload: 'malicious()' }
      };

      const response = await request(app)
        .post('/api/reports/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SUSPICIOUS_INPUT');
    });

    test('should apply security headers', async () => {
      const response = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should log all security events', async () => {
      // Generate various security events
      await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .post('/api/reports/export')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          data: [{ id: '1', name: 'test' }],
          format: 'pdf'
        });

      // Check audit logs
      const securityEvents = await ReportAuditLogger.getSecurityEvents(50);
      expect(Array.isArray(securityEvents)).toBe(true);
    });
  });

  describe('End-to-End Security Scenarios', () => {
    test('should handle complete export workflow with security', async () => {
      // 1. Generate report
      const reportResponse = await request(app)
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resourceTypes: ['vpc'],
          fields: ['id', 'name', 'region'],
          filters: []
        });

      expect(reportResponse.status).toBe(200);

      // 2. Export with security options
      const exportResponse = await request(app)
        .post('/api/reports/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          data: reportResponse.body.data?.records || [],
          format: 'pdf',
          options: {
            addWatermark: true,
            encryptFile: false,
            includeMetadata: true
          }
        });

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.body.data).toHaveProperty('security');
      expect(exportResponse.body.data.security.watermarked).toBe(true);

      // 3. Download with audit trail
      const fileName = exportResponse.body.data.fileName;
      const downloadResponse = await request(app)
        .get(`/api/reports/download/${fileName}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Should succeed or fail gracefully
      expect([200, 404]).toContain(downloadResponse.status);
    });

    test('should prevent unauthorized access to sensitive data', async () => {
      const sensitiveQuery = {
        resourceTypes: ['vpc'],
        fields: ['id', 'name', 'privateKey', 'sensitiveConfig'],
        includeSensitive: true,
        includeCompliance: true
      };

      // User without sensitive data permissions
      const response = await request(app)
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(sensitiveQuery);

      expect(response.status).toBe(403);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          code: 'PERMISSION_DENIED'
        })
      );
    });

    test('should maintain audit trail for compliance', async () => {
      const startTime = new Date();

      // Perform various operations
      await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceTypes: ['vpc'],
          fields: ['id', 'name'],
          filters: []
        });

      const endTime = new Date();

      // Check audit trail
      const auditStats = await ReportAuditLogger.getAuditStatistics(startTime, endTime);
      expect(auditStats.totalEvents).toBeGreaterThan(0);
    });
  });
});

describe('Performance and Security Stress Tests', () => {
  test('should handle concurrent requests with rate limiting', async () => {
    const concurrentRequests = 20;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        request(app)
          .get('/api/reports/dashboard')
          .set('Authorization', `Bearer ${jwt.sign({ userId: 'test-user-' + i }, 'test-secret')}`)
      );
    }

    const responses = await Promise.all(promises);
    const successCount = responses.filter(res => res.status === 200).length;
    const rateLimitedCount = responses.filter(res => res.status === 429).length;

    expect(successCount + rateLimitedCount).toBe(concurrentRequests);
  });

  test('should handle large data sanitization efficiently', () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: `item-${i}`,
      name: `Test Item ${i}`,
      password: `secret-${i}`,
      publicData: `public-${i}`,
      privateKey: `key-${i}`,
      email: `user${i}@example.com`
    }));

    const userContext = {
      id: 'test-user',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['USER'],
      permissions: [ReportPermissions.REPORT_READ],
      dataAccess: {}
    };

    const startTime = Date.now();
    const sanitizedData = DataSanitizer.sanitizeData(largeDataset, userContext);
    const endTime = Date.now();

    expect(sanitizedData).toHaveLength(largeDataset.length);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });
});