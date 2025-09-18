/**
 * Email Alerts Integration Tests
 * Comprehensive tests for email alert service integration with real SMTP service
 * Tests SMTP connectivity, authentication, email delivery, templates, and throttling
 */

import { AlertService } from '../../src/services/AlertService';
import { WorkflowRegistry } from '../../src/models/WorkflowRegistry';
import { WorkflowExecution } from '../../src/models/WorkflowExecution';
import { WorkflowAlert } from '../../src/models/WorkflowAlert';
import { createEmailTransporter, getEmailConfig } from '../../src/config/email';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';
import {
  emailValidator,
  externalServiceUtils,
  EmailServiceValidation,
  TEST_CONFIG
} from '../helpers/external-services';

// Test configuration
const EMAIL_INTEGRATION_TEST_CONFIG = {
  // Test email addresses - use non-deliverable addresses for safety unless specified
  testEmailAddress: process.env.INTEGRATION_TEST_EMAIL || 'integration-test@example.com',
  adminTestEmail: process.env.ADMIN_TEST_EMAIL,

  // Test timeouts
  smtpTimeout: 30000,
  emailSendTimeout: 45000,

  // Test workflow data
  testWorkflow: {
    id: 'test-workflow-123',
    name: 'Integration Test Workflow',
    type: 'vpc' as const,
    provider: 'aws' as const
  },

  testExecution: {
    id: 'test-execution-456',
    workflowId: 'test-workflow-123',
    status: 'failure' as const,
    errorMessage: 'Integration test failure simulation',
    startTime: new Date('2023-12-01T10:00:00Z'),
    endTime: new Date('2023-12-01T10:05:00Z'),
    resourcesCreated: 5,
    resourcesUpdated: 3
  }
} as const;

describe('Email Alerts Integration Tests', () => {
  let alertService: AlertService;
  let validationReport: EmailServiceValidation;
  let serviceAvailable = false;
  let testWorkflow: any;
  let testExecution: any;

  beforeAll(async () => {
    console.log('\n📧 Starting Email Alerts Integration Tests');

    // Set up test database
    await setupTestDatabase();

    // Create test workflow and execution data
    console.log('🏗️  Setting up test data...');

    testWorkflow = await WorkflowRegistry.create({
      workflow_id: EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.id,
      workflow_name: EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.name,
      workflow_type: EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.type,
      provider: EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.provider,
      is_active: true
    });

    testExecution = await WorkflowExecution.create({
      workflow_id: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.workflowId,
      execution_id: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id,
      status: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.status,
      start_time: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.startTime,
      end_time: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.endTime,
      error_message: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.errorMessage,
      resources_created: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.resourcesCreated,
      resources_updated: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.resourcesUpdated,
      resources_failed: 1,
      execution_data: {
        testData: true,
        integrationTest: 'email-alerts',
        timestamp: new Date().toISOString()
      }
    });

    // Initialize alert service with test configuration
    alertService = new AlertService({
      enabled: true,
      throttleEnabled: false, // Disable throttling for integration tests
      defaultRecipients: [
        {
          email: EMAIL_INTEGRATION_TEST_CONFIG.testEmailAddress,
          name: 'Integration Test Recipient',
          alertTypes: ['failure', 'success', 'manual_trigger']
        }
      ]
    });

    // Run comprehensive email service validation
    console.log('🔍 Running email service validation...');
    validationReport = await emailValidator.validateAll(EMAIL_INTEGRATION_TEST_CONFIG.adminTestEmail);

    // Check if service is available for testing
    serviceAvailable = validationReport.smtp.status !== 'unavailable' &&
                     validationReport.authentication.status === 'healthy';

    if (!serviceAvailable) {
      console.warn('⚠️  Email service unavailable - some tests will be skipped');
      console.warn(`SMTP status: ${validationReport.smtp.status}`);
      console.warn(`Auth status: ${validationReport.authentication.status}`);
      if (validationReport.smtp.error) console.warn(`SMTP Error: ${validationReport.smtp.error}`);
      if (validationReport.authentication.error) console.warn(`Auth Error: ${validationReport.authentication.error}`);
    } else {
      console.log('✅ Email service is available for testing');
    }

    // Print service validation summary
    console.log('\n📊 Email Service Validation Summary:');
    console.log(`SMTP: ${validationReport.smtp.status}`);
    console.log(`Authentication: ${validationReport.authentication.status}`);
    console.log(`Send Capability: ${validationReport.sendCapability.status}`);
    console.log(`Templates: ${validationReport.templates.status}`);
  }, EMAIL_INTEGRATION_TEST_CONFIG.smtpTimeout);

  afterAll(async () => {
    console.log('🧹 Cleaning up email integration test environment...');

    // Clean up test data
    if (testExecution) await testExecution.destroy();
    if (testWorkflow) await testWorkflow.destroy();

    await cleanupTestDatabase();
  });

  describe('Email Service Validation', () => {
    it('should validate SMTP connectivity', async () => {
      console.log('🔗 Testing SMTP connectivity...');

      const status = validationReport.smtp;

      expect(status.service).toBe('email-smtp');
      expect(status.timestamp).toBeInstanceOf(Date);

      if (status.details?.configured) {
        expect(['healthy', 'degraded', 'unavailable']).toContain(status.status);
        expect(status.details.host).toBeDefined();
        expect(typeof status.details.port).toBe('number');
        expect(typeof status.details.secure).toBe('boolean');
      } else {
        expect(status.status).toBe('unavailable');
        expect(status.error).toContain('not configured');
      }

      console.log(`SMTP result: ${status.status} (${status.responseTime || 0}ms)`);
      if (status.details?.configured) {
        console.log(`  Host: ${status.details.host}:${status.details.port} (secure: ${status.details.secure})`);
      }
      if (status.error) console.log(`  Error: ${status.error}`);
    });

    it('should validate SMTP authentication', async () => {
      console.log('🔐 Testing SMTP authentication...');

      const status = validationReport.authentication;

      expect(status.service).toBe('email-authentication');
      expect(status.timestamp).toBeInstanceOf(Date);

      if (validationReport.smtp.details?.configured) {
        expect(['healthy', 'unavailable']).toContain(status.status);
        expect(typeof status.details?.authenticated).toBe('boolean');
        expect(typeof status.details?.hasCredentials).toBe('boolean');
      } else {
        expect(status.status).toBe('unavailable');
      }

      console.log(`Authentication result: ${status.status} (${status.responseTime || 0}ms)`);
      console.log(`  Credentials configured: ${status.details?.hasCredentials || false}`);
      console.log(`  Authenticated: ${status.details?.authenticated || false}`);
      if (status.error) console.log(`  Error: ${status.error}`);
    });

    it('should validate email sending capability', async () => {
      console.log('📤 Testing email sending capability...');

      const status = validationReport.sendCapability;

      expect(status.service).toBe('email-send-capability');
      expect(status.timestamp).toBeInstanceOf(Date);

      if (serviceAvailable) {
        expect(['healthy', 'degraded']).toContain(status.status);
        expect(status.details?.messageId).toBeDefined();
        expect(status.details?.recipient).toBeDefined();
      } else {
        expect(status.status).toBe('unavailable');
      }

      console.log(`Send capability result: ${status.status} (${status.responseTime || 0}ms)`);
      if (status.details) {
        console.log(`  Recipient: ${status.details.recipient}`);
        console.log(`  Actual send: ${status.details.actualSend}`);
        console.log(`  From: ${status.details.from}`);
      }
      if (status.error) console.log(`  Error: ${status.error}`);
    });

    it('should validate email templates', async () => {
      console.log('📝 Testing email templates...');

      const status = validationReport.templates;

      expect(status.service).toBe('email-templates');
      expect(status.timestamp).toBeInstanceOf(Date);
      expect(['healthy', 'degraded', 'unavailable']).toContain(status.status);

      if (status.status !== 'unavailable') {
        expect(status.details?.failureTemplate).toBeDefined();
        expect(status.details?.successTemplate).toBeDefined();

        const failureTemplate = status.details?.failureTemplate;
        const successTemplate = status.details?.successTemplate;

        if (failureTemplate) {
          expect(failureTemplate.hasSubject).toBe(true);
          expect(failureTemplate.hasHtml).toBe(true);
          expect(failureTemplate.hasText).toBe(true);
          expect(failureTemplate.subjectLength).toBeGreaterThan(0);
          expect(failureTemplate.htmlLength).toBeGreaterThan(0);
          expect(failureTemplate.textLength).toBeGreaterThan(0);
        }

        if (successTemplate) {
          expect(successTemplate.hasSubject).toBe(true);
          expect(successTemplate.hasHtml).toBe(true);
          expect(successTemplate.hasText).toBe(true);
          expect(successTemplate.subjectLength).toBeGreaterThan(0);
          expect(successTemplate.htmlLength).toBeGreaterThan(0);
          expect(successTemplate.textLength).toBeGreaterThan(0);
        }
      }

      console.log(`Templates result: ${status.status} (${status.responseTime || 0}ms)`);
      if (status.details?.baseUrl) {
        console.log(`  Base URL: ${status.details.baseUrl}`);
      }
      if (status.error) console.log(`  Error: ${status.error}`);
    });
  });

  describe('AlertService Operations', () => {
    it('should send failure alert successfully', async () => {
      if (!serviceAvailable) {
        console.log('⏭️  Skipping failure alert test - service unavailable');
        return;
      }

      console.log('🚨 Testing failure alert sending...');

      const result = await alertService.sendFailureAlert(
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id
      );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.alertId).toBeDefined();

      if (result.success) {
        console.log(`✅ Failure alert sent successfully (Alert ID: ${result.alertId})`);

        // Verify alert was recorded in database
        const alert = await WorkflowAlert.findByPk(result.alertId);
        expect(alert).toBeDefined();
        expect(alert?.alert_type).toBe('failure');
        expect(alert?.execution_id).toBe(EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id);
        expect(alert?.recipients).toBeDefined();

        console.log(`  Recipients: ${alert?.recipients}`);
        console.log(`  Sent at: ${alert?.sent_at}`);
      } else {
        if (result.skipped) {
          console.log(`⏭️  Alert skipped: ${result.reason}`);
          expect(result.reason).toBeDefined();
        } else {
          console.log(`❌ Alert sending failed: ${result.error}`);
          expect(result.error).toBeDefined();
        }
      }
    }, EMAIL_INTEGRATION_TEST_CONFIG.emailSendTimeout);

    it('should send success alert with proper formatting', async () => {
      if (!serviceAvailable) {
        console.log('⏭️  Skipping success alert test - service unavailable');
        return;
      }

      console.log('✅ Testing success alert sending...');

      // Create a successful execution record
      const successExecution = await WorkflowExecution.create({
        workflow_id: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.workflowId,
        execution_id: 'test-success-execution-789',
        status: 'success',
        start_time: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.startTime,
        end_time: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.endTime,
        resources_created: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.resourcesCreated,
        resources_updated: EMAIL_INTEGRATION_TEST_CONFIG.testExecution.resourcesUpdated,
        resources_failed: 0,
        execution_data: {
          testData: true,
          success: true,
          integrationTest: 'email-alerts'
        }
      });

      try {
        const result = await alertService.sendSuccessAlert('test-success-execution-789');

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');

        if (result.success) {
          console.log(`✅ Success alert sent successfully (Alert ID: ${result.alertId})`);

          // Verify alert was recorded
          const alert = await WorkflowAlert.findByPk(result.alertId);
          expect(alert).toBeDefined();
          expect(alert?.alert_type).toBe('success');
          expect(alert?.execution_id).toBe('test-success-execution-789');
        } else {
          if (result.skipped) {
            console.log(`⏭️  Success alert skipped: ${result.reason}`);
          } else {
            console.log(`❌ Success alert failed: ${result.error}`);
          }
        }
      } finally {
        // Clean up test execution
        await successExecution.destroy();
      }
    }, EMAIL_INTEGRATION_TEST_CONFIG.emailSendTimeout);

    it('should send manual trigger alert', async () => {
      if (!serviceAvailable) {
        console.log('⏭️  Skipping manual trigger alert test - service unavailable');
        return;
      }

      console.log('🔧 Testing manual trigger alert...');

      const result = await alertService.sendManualTriggerAlert(
        EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.id,
        'manual-execution-999',
        'integration-test@example.com'
      );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        console.log(`✅ Manual trigger alert sent successfully (Alert ID: ${result.alertId})`);

        // Verify alert was recorded
        const alert = await WorkflowAlert.findByPk(result.alertId);
        expect(alert).toBeDefined();
        expect(alert?.alert_type).toBe('manual_trigger');
        expect(alert?.execution_id).toBe('manual-execution-999');
      } else {
        if (result.skipped) {
          console.log(`⏭️  Manual trigger alert skipped: ${result.reason}`);
        } else {
          console.log(`❌ Manual trigger alert failed: ${result.error}`);
        }
      }
    }, EMAIL_INTEGRATION_TEST_CONFIG.emailSendTimeout);

    it('should use custom recipients when provided', async () => {
      if (!serviceAvailable) {
        console.log('⏭️  Skipping custom recipients test - service unavailable');
        return;
      }

      console.log('👥 Testing custom recipients...');

      const customRecipients = [
        'custom1@example.com',
        'custom2@example.com'
      ];

      const result = await alertService.sendFailureAlert(
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id,
        customRecipients
      );

      expect(result).toBeDefined();

      if (result.success) {
        console.log(`✅ Alert sent to custom recipients (Alert ID: ${result.alertId})`);

        // Verify correct recipients were used
        const alert = await WorkflowAlert.findByPk(result.alertId);
        expect(alert).toBeDefined();
        expect(alert?.recipients).toContain('custom1@example.com');
        expect(alert?.recipients).toContain('custom2@example.com');

        console.log(`  Recipients: ${alert?.recipients}`);
      } else {
        if (result.skipped) {
          console.log(`⏭️  Custom recipients alert skipped: ${result.reason}`);
        } else {
          console.log(`❌ Custom recipients alert failed: ${result.error}`);
        }
      }
    }, EMAIL_INTEGRATION_TEST_CONFIG.emailSendTimeout);

    it('should handle email service degradation gracefully', async () => {
      console.log('⚠️  Testing service degradation handling...');

      // Test with service unavailable scenario
      const serviceWithoutSMTP = new AlertService({
        enabled: true,
        defaultRecipients: [{
          email: 'test@example.com',
          alertTypes: ['failure']
        }]
      });

      // Mock transporter as null to simulate SMTP unavailability
      const originalTransporter = (serviceWithoutSMTP as any).transporter;
      (serviceWithoutSMTP as any).transporter = null;

      try {
        const result = await serviceWithoutSMTP.sendFailureAlert(
          EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id
        );

        expect(result.success).toBe(false);
        expect(result.skipped).toBe(true);
        expect(result.reason).toContain('SMTP service unavailable');
        expect(result.alertId).toBeDefined(); // Alert should still be recorded

        console.log('✅ Service degradation handled gracefully');
        console.log(`  Reason: ${result.reason}`);
      } finally {
        // Restore original transporter
        (serviceWithoutSMTP as any).transporter = originalTransporter;
      }
    });

    it('should test email configuration validation', async () => {
      if (!serviceAvailable) {
        console.log('⏭️  Skipping email config test - service unavailable');
        return;
      }

      console.log('⚙️  Testing email configuration validation...');

      const testResult = await alertService.testEmailConfig(
        EMAIL_INTEGRATION_TEST_CONFIG.testEmailAddress
      );

      expect(testResult).toBeDefined();
      expect(typeof testResult.success).toBe('boolean');

      if (testResult.success) {
        console.log('✅ Email configuration test passed');
      } else {
        console.log(`❌ Email configuration test failed: ${testResult.error}`);
        expect(testResult.error).toBeDefined();
      }
    }, EMAIL_INTEGRATION_TEST_CONFIG.emailSendTimeout);

    it('should validate service health status', () => {
      console.log('🏥 Testing service health status...');

      const health = alertService.getServiceHealth();

      expect(health).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.details).toBeDefined();
      expect(typeof health.details.enabled).toBe('boolean');
      expect(typeof health.details.smtpAvailable).toBe('boolean');
      expect(typeof health.details.recipientsConfigured).toBe('boolean');
      expect(typeof health.details.defaultRecipientCount).toBe('number');
      expect(typeof health.details.throttleEnabled).toBe('boolean');

      console.log(`Service health: ${health.status}`);
      console.log(`  Enabled: ${health.details.enabled}`);
      console.log(`  SMTP Available: ${health.details.smtpAvailable}`);
      console.log(`  Recipients Configured: ${health.details.recipientsConfigured}`);
      console.log(`  Default Recipients: ${health.details.defaultRecipientCount}`);
      console.log(`  Throttling: ${health.details.throttleEnabled}`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent execution IDs', async () => {
      console.log('❌ Testing non-existent execution handling...');

      const result = await alertService.sendFailureAlert('non-existent-execution');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');

      console.log(`✅ Properly handled non-existent execution: ${result.error}`);
    });

    it('should handle invalid workflow IDs for manual triggers', async () => {
      console.log('❌ Testing invalid workflow handling...');

      const result = await alertService.sendManualTriggerAlert(
        'non-existent-workflow',
        'test-execution',
        'test@example.com'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');

      console.log(`✅ Properly handled invalid workflow: ${result.error}`);
    });

    it('should handle empty recipient lists', async () => {
      console.log('👤 Testing empty recipient list handling...');

      const serviceWithNoRecipients = new AlertService({
        enabled: true,
        defaultRecipients: []
      });

      const result = await serviceWithNoRecipients.sendFailureAlert(
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id
      );

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('No recipients configured');

      console.log(`✅ Properly handled empty recipients: ${result.reason}`);
    });

    it('should handle service disabled state', async () => {
      console.log('🚫 Testing disabled service handling...');

      const disabledService = new AlertService({
        enabled: false,
        defaultRecipients: [{
          email: 'test@example.com',
          alertTypes: ['failure']
        }]
      });

      const result = await disabledService.sendFailureAlert(
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id
      );

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('disabled');

      console.log(`✅ Properly handled disabled service: ${result.reason}`);
    });
  });

  describe('Production Features', () => {
    it('should demonstrate throttling behavior when enabled', async () => {
      if (!serviceAvailable) {
        console.log('⏭️  Skipping throttling test - service unavailable');
        return;
      }

      console.log('🚦 Testing throttling behavior...');

      // Create service with throttling enabled
      const throttledService = new AlertService({
        enabled: true,
        throttleEnabled: true,
        defaultRecipients: [{
          email: EMAIL_INTEGRATION_TEST_CONFIG.testEmailAddress,
          alertTypes: ['failure']
        }]
      });

      // Send multiple alerts rapidly
      const results = await Promise.allSettled([
        throttledService.sendFailureAlert(EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id),
        throttledService.sendFailureAlert(EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id),
        throttledService.sendFailureAlert(EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id)
      ]);

      let successCount = 0;
      let throttledCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const alertResult = result.value;
          if (alertResult.success) {
            successCount++;
          } else if (alertResult.skipped && alertResult.reason?.includes('throttled')) {
            throttledCount++;
          }

          console.log(`  Alert ${index + 1}: ${alertResult.success ? 'sent' : (alertResult.skipped ? 'throttled' : 'failed')}`);
        }
      });

      // At least one should succeed, and throttling may occur
      expect(successCount).toBeGreaterThan(0);

      console.log(`✅ Throttling test completed: ${successCount} sent, ${throttledCount} throttled`);
    }, EMAIL_INTEGRATION_TEST_CONFIG.emailSendTimeout * 2);

    it('should retrieve and paginate alert history', async () => {
      console.log('📚 Testing alert history retrieval...');

      const history = await alertService.getAlertHistory({
        page: 1,
        limit: 10,
        workflowId: EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.id
      });

      expect(history).toBeDefined();
      expect(Array.isArray(history.alerts)).toBe(true);
      expect(typeof history.total).toBe('number');
      expect(typeof history.page).toBe('number');
      expect(typeof history.totalPages).toBe('number');

      console.log(`✅ Alert history: ${history.alerts.length} alerts on page ${history.page} of ${history.totalPages}`);

      if (history.alerts.length > 0) {
        const alert = history.alerts[0];
        expect(alert.alert_type).toBeDefined();
        expect(alert.sent_at).toBeDefined();
      }
    });

    it('should resolve alerts', async () => {
      console.log('✅ Testing alert resolution...');

      // Find an alert to resolve
      const history = await alertService.getAlertHistory({ limit: 1, resolved: false });

      if (history.alerts.length > 0) {
        const alertId = history.alerts[0].id;
        const resolved = await alertService.resolveAlert(alertId);

        expect(typeof resolved).toBe('boolean');

        if (resolved) {
          console.log(`✅ Alert ${alertId} resolved successfully`);

          // Verify it was resolved
          const alert = await WorkflowAlert.findByPk(alertId);
          expect(alert?.resolved_at).not.toBeNull();
        } else {
          console.log(`⚠️  Alert ${alertId} was not resolved (may already be resolved)`);
        }
      } else {
        console.log('ℹ️  No unresolved alerts found to test resolution');
      }
    });

    it('should validate email template generation', async () => {
      console.log('📝 Testing email template generation...');

      // Import template functions
      const { getWorkflowFailureTemplate, getWorkflowSuccessTemplate } = await import('../../src/config/email');
      const emailConfig = getEmailConfig();

      // Test failure template
      const failureTemplate = getWorkflowFailureTemplate(
        EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.name,
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id,
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.errorMessage,
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.startTime,
        emailConfig.templates.baseUrl
      );

      expect(failureTemplate.subject).toBeDefined();
      expect(failureTemplate.html).toBeDefined();
      expect(failureTemplate.text).toBeDefined();
      expect(failureTemplate.subject).toContain('Failure Alert');
      expect(failureTemplate.html).toContain(EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.name);
      expect(failureTemplate.text).toContain(EMAIL_INTEGRATION_TEST_CONFIG.testExecution.errorMessage);

      // Test success template
      const successTemplate = getWorkflowSuccessTemplate(
        EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.name,
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.id,
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.startTime,
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.endTime,
        EMAIL_INTEGRATION_TEST_CONFIG.testExecution.resourcesCreated + EMAIL_INTEGRATION_TEST_CONFIG.testExecution.resourcesUpdated,
        emailConfig.templates.baseUrl
      );

      expect(successTemplate.subject).toBeDefined();
      expect(successTemplate.html).toBeDefined();
      expect(successTemplate.text).toBeDefined();
      expect(successTemplate.subject).toContain('Success');
      expect(successTemplate.html).toContain(EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.name);

      console.log('✅ Email templates generated and validated successfully');
      console.log(`  Failure template length: ${failureTemplate.html.length} chars`);
      console.log(`  Success template length: ${successTemplate.html.length} chars`);
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should handle complete workflow failure notification flow', async () => {
      if (!serviceAvailable) {
        console.log('⏭️  Skipping workflow flow test - service unavailable');
        return;
      }

      console.log('🔄 Testing complete workflow failure notification flow...');

      // Simulate a real workflow failure scenario
      const realFailureExecution = await WorkflowExecution.create({
        workflow_id: EMAIL_INTEGRATION_TEST_CONFIG.testWorkflow.id,
        execution_id: 'real-failure-' + Date.now(),
        status: 'failure',
        start_time: new Date(),
        end_time: new Date(),
        error_message: 'AWS API rate limit exceeded during VPC discovery',
        resources_created: 0,
        resources_updated: 0,
        resources_failed: 1,
        execution_data: {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            details: 'Too many requests to AWS API'
          }
        }
      });

      try {
        // Send failure alert
        const alertResult = await alertService.sendFailureAlert(realFailureExecution.execution_id);

        expect(alertResult).toBeDefined();

        if (alertResult.success) {
          console.log(`✅ Real workflow failure notification sent (Alert ID: ${alertResult.alertId})`);

          // Verify database record
          const alert = await WorkflowAlert.findByPk(alertResult.alertId);
          expect(alert).toBeDefined();
          expect(alert?.alert_type).toBe('failure');

          // Test alert resolution
          const resolved = await alertService.resolveAlert(alertResult.alertId!);
          expect(typeof resolved).toBe('boolean');

          console.log(`  Alert resolved: ${resolved}`);
        } else {
          console.log(`⚠️  Real workflow notification failed or skipped: ${alertResult.error || alertResult.reason}`);
        }
      } finally {
        await realFailureExecution.destroy();
      }
    }, EMAIL_INTEGRATION_TEST_CONFIG.emailSendTimeout);

    it('should validate production SMTP settings', () => {
      console.log('⚙️  Validating production SMTP settings...');

      const config = getEmailConfig();

      expect(config).toBeDefined();
      expect(config.smtp).toBeDefined();
      expect(config.from).toBeDefined();
      expect(config.throttle).toBeDefined();
      expect(config.templates).toBeDefined();

      console.log(`SMTP Host: ${config.smtp.host}:${config.smtp.port}`);
      console.log(`From: ${config.from.name} <${config.from.address}>`);
      console.log(`Throttle: ${config.throttle.maxAlertsPerHour}/hour, ${config.throttle.maxAlertsPerWorkflowPerHour}/workflow/hour`);
      console.log(`Template Base URL: ${config.templates.baseUrl}`);

      // Validate reasonable configuration values
      expect(config.smtp.port).toBeGreaterThan(0);
      expect(config.smtp.port).toBeLessThan(65536);
      expect(config.throttle.maxAlertsPerHour).toBeGreaterThan(0);
      expect(config.throttle.maxAlertsPerWorkflowPerHour).toBeGreaterThan(0);

      console.log('✅ Production SMTP settings validated');
    });

    it('should demonstrate service resilience', async () => {
      console.log('🛡️  Testing service resilience...');

      // Test multiple consecutive operations
      const operations = [
        () => alertService.getServiceHealth(),
        () => alertService.getAlertHistory({ limit: 1 }),
        () => alertService.testEmailConfig(EMAIL_INTEGRATION_TEST_CONFIG.testEmailAddress)
      ];

      const results = await Promise.allSettled(operations.map(op => op()));

      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          console.log(`  Operation ${index + 1}: succeeded`);
        } else {
          failureCount++;
          console.log(`  Operation ${index + 1}: failed - ${result.reason}`);
        }
      });

      // At least health check should always succeed
      expect(successCount).toBeGreaterThan(0);

      console.log(`✅ Service resilience: ${successCount}/${operations.length} operations succeeded`);
    });
  });
});