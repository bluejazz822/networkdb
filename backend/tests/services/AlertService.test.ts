/**
 * AlertService Test Suite
 * Comprehensive tests for email notification service
 */

import { AlertService } from '../../src/services/AlertService';
import { WorkflowRegistry } from '../../src/models/WorkflowRegistry';
import { WorkflowExecution } from '../../src/models/WorkflowExecution';
import { WorkflowAlert } from '../../src/models/WorkflowAlert';
import { createEmailTransporter } from '../../src/config/email';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn()
}));

// Mock email config
jest.mock('../../src/config/email', () => ({
  createEmailTransporter: jest.fn(),
  getEmailConfig: jest.fn(() => ({
    smtp: {
      host: 'test-smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'test@example.com', pass: 'password' }
    },
    from: {
      name: 'Test Alert Service',
      address: 'alerts@test.com'
    },
    throttle: {
      maxAlertsPerHour: 10,
      maxAlertsPerWorkflowPerHour: 1
    },
    templates: {
      baseUrl: 'http://localhost:3000'
    }
  })),
  getWorkflowFailureTemplate: jest.fn(() => ({
    subject: 'Test Failure Alert',
    html: '<html>Test failure</html>',
    text: 'Test failure text'
  })),
  getWorkflowSuccessTemplate: jest.fn(() => ({
    subject: 'Test Success Alert',
    html: '<html>Test success</html>',
    text: 'Test success text'
  }))
}));

// Mock models
jest.mock('../../src/models/WorkflowRegistry');
jest.mock('../../src/models/WorkflowExecution');
jest.mock('../../src/models/WorkflowAlert');

describe('AlertService', () => {
  let alertService: AlertService;
  let mockTransporter: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock transporter
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn((callback) => callback(null, true))
    };

    // Mock createEmailTransporter to return our mock
    (createEmailTransporter as jest.Mock).mockReturnValue(mockTransporter);

    // Initialize service
    alertService = new AlertService({
      enabled: true,
      throttleEnabled: true,
      defaultRecipients: [
        { email: 'admin@test.com', alertTypes: ['failure', 'success'] },
        { email: 'ops@test.com', alertTypes: ['failure'] }
      ]
    });
  });

  describe('Initialization', () => {
    it('should initialize with SMTP transporter available', () => {
      expect(createEmailTransporter).toHaveBeenCalled();
      expect(alertService).toBeDefined();
    });

    it('should handle SMTP unavailability gracefully', () => {
      (createEmailTransporter as jest.Mock).mockReturnValue(null);
      
      const serviceWithoutSMTP = new AlertService();
      expect(serviceWithoutSMTP).toBeDefined();
    });

    it('should parse default recipients from environment', () => {
      process.env.ALERT_DEFAULT_RECIPIENTS = 'test1@example.com,test2@example.com';
      
      const service = new AlertService();
      expect(service).toBeDefined();
      
      delete process.env.ALERT_DEFAULT_RECIPIENTS;
    });
  });

  describe('sendFailureAlert', () => {
    beforeEach(() => {
      // Mock workflow execution data
      const mockExecution = {
        execution_id: 'exec-123',
        workflow_id: 'workflow-456',
        status: 'failure',
        error_message: 'Test error message',
        start_time: new Date('2023-01-01T10:00:00Z'),
        workflow: {
          workflow_name: 'Test Workflow'
        }
      };

      (WorkflowExecution.findOne as jest.Mock).mockResolvedValue(mockExecution);
      (WorkflowAlert.count as jest.Mock).mockResolvedValue(0); // No throttling
      (WorkflowAlert.create as jest.Mock).mockResolvedValue({ id: 1 });
      
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    });

    it('should send failure alert successfully', async () => {
      const result = await alertService.sendFailureAlert('exec-123');

      expect(result.success).toBe(true);
      expect(result.alertId).toBe(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2); // Two default recipients
    });

    it('should use custom recipients when provided', async () => {
      const customRecipients = ['custom@test.com'];
      const result = await alertService.sendFailureAlert('exec-123', customRecipients);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'custom@test.com'
        })
      );
    });

    it('should handle throttling correctly', async () => {
      // Mock throttle conditions
      (WorkflowAlert.count as jest.Mock).mockResolvedValue(10); // Exceeds throttle

      const result = await alertService.sendFailureAlert('exec-123');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('throttled');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should handle non-existent execution', async () => {
      (WorkflowExecution.findOne as jest.Mock).mockResolvedValue(null);

      const result = await alertService.sendFailureAlert('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle SMTP unavailability gracefully', async () => {
      alertService = new AlertService(); // Will have no transporter
      (createEmailTransporter as jest.Mock).mockReturnValue(null);

      const result = await alertService.sendFailureAlert('exec-123');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('SMTP service unavailable');
      expect(result.alertId).toBe(1); // Alert record still created
    });

    it('should handle email sending errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Error'));

      const result = await alertService.sendFailureAlert('exec-123');

      expect(result.success).toBe(false);
      expect(result.alertId).toBe(1);
    });

    it('should skip when service disabled', async () => {
      alertService = new AlertService({ enabled: false });

      const result = await alertService.sendFailureAlert('exec-123');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('disabled');
    });
  });

  describe('sendSuccessAlert', () => {
    beforeEach(() => {
      const mockExecution = {
        execution_id: 'exec-success-123',
        workflow_id: 'workflow-456',
        status: 'success',
        start_time: new Date('2023-01-01T10:00:00Z'),
        end_time: new Date('2023-01-01T10:05:00Z'),
        resources_created: 5,
        resources_updated: 3,
        workflow: {
          workflow_name: 'Success Test Workflow'
        }
      };

      (WorkflowExecution.findOne as jest.Mock).mockResolvedValue(mockExecution);
      (WorkflowAlert.create as jest.Mock).mockResolvedValue({ id: 2 });
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'success-message-id' });
    });

    it('should send success alert successfully', async () => {
      const result = await alertService.sendSuccessAlert('exec-success-123');

      expect(result.success).toBe(true);
      expect(result.alertId).toBe(2);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Test Success Alert'
        })
      );
    });

    it('should filter recipients by alert type for success alerts', async () => {
      // Only admin@test.com should receive success alerts based on our mock config
      const result = await alertService.sendSuccessAlert('exec-success-123');

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendManualTriggerAlert', () => {
    beforeEach(() => {
      const mockWorkflow = {
        workflow_id: 'workflow-789',
        workflow_name: 'Manual Test Workflow'
      };

      (WorkflowRegistry.findOne as jest.Mock).mockResolvedValue(mockWorkflow);
      (WorkflowAlert.create as jest.Mock).mockResolvedValue({ id: 3 });
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'manual-message-id' });
    });

    it('should send manual trigger alert successfully', async () => {
      const result = await alertService.sendManualTriggerAlert(
        'workflow-789',
        'exec-manual-123',
        'admin@test.com'
      );

      expect(result.success).toBe(true);
      expect(result.alertId).toBe(3);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should handle non-existent workflow', async () => {
      (WorkflowRegistry.findOne as jest.Mock).mockResolvedValue(null);

      const result = await alertService.sendManualTriggerAlert(
        'non-existent',
        'exec-123',
        'user@test.com'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getAlertHistory', () => {
    it('should retrieve alert history with pagination', async () => {
      const mockAlerts = [
        { id: 1, alert_type: 'failure', sent_at: new Date() },
        { id: 2, alert_type: 'success', sent_at: new Date() }
      ];

      (WorkflowAlert.findAndCountAll as jest.Mock).mockResolvedValue({
        count: 10,
        rows: mockAlerts
      });

      const result = await alertService.getAlertHistory({
        page: 1,
        limit: 20
      });

      expect(result.alerts).toEqual(mockAlerts);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by workflow ID', async () => {
      await alertService.getAlertHistory({ workflowId: 'workflow-123' });

      expect(WorkflowAlert.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              where: { workflow_id: 'workflow-123' }
            })
          ])
        })
      );
    });

    it('should filter by alert type', async () => {
      await alertService.getAlertHistory({ alertType: 'failure' });

      expect(WorkflowAlert.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { alert_type: 'failure' }
        })
      );
    });

    it('should filter by resolved status', async () => {
      await alertService.getAlertHistory({ resolved: false });

      expect(WorkflowAlert.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resolved_at: null }
        })
      );
    });
  });

  describe('resolveAlert', () => {
    it('should resolve alert successfully', async () => {
      (WorkflowAlert.update as jest.Mock).mockResolvedValue([1]); // 1 row updated

      const result = await alertService.resolveAlert(123);

      expect(result).toBe(true);
      expect(WorkflowAlert.update).toHaveBeenCalledWith(
        { resolved_at: expect.any(Date) },
        { where: { id: 123, resolved_at: null } }
      );
    });

    it('should return false if alert not found or already resolved', async () => {
      (WorkflowAlert.update as jest.Mock).mockResolvedValue([0]); // 0 rows updated

      const result = await alertService.resolveAlert(999);

      expect(result).toBe(false);
    });
  });

  describe('testEmailConfig', () => {
    it('should send test email successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      const result = await alertService.testEmailConfig('test@example.com');

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Network CMDB Alert Service Test'
        })
      );
    });

    it('should handle SMTP errors in test', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Connection failed'));

      const result = await alertService.testEmailConfig('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });

    it('should handle missing transporter', async () => {
      alertService = new AlertService();
      (createEmailTransporter as jest.Mock).mockReturnValue(null);

      const result = await alertService.testEmailConfig('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP transporter not configured');
    });
  });

  describe('getServiceHealth', () => {
    it('should return healthy status when all services available', () => {
      const health = alertService.getServiceHealth();

      expect(health.status).toBe('healthy');
      expect(health.details.enabled).toBe(true);
      expect(health.details.smtpAvailable).toBe(true);
      expect(health.details.recipientsConfigured).toBe(true);
    });

    it('should return degraded status with partial availability', () => {
      alertService = new AlertService({
        enabled: true,
        defaultRecipients: [] // No recipients configured
      });

      const health = alertService.getServiceHealth();

      expect(health.status).toBe('degraded');
      expect(health.details.recipientsConfigured).toBe(false);
    });

    it('should return unhealthy status when service disabled', () => {
      alertService = new AlertService({ enabled: false });

      const health = alertService.getServiceHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.details.enabled).toBe(false);
    });
  });

  describe('Throttling Logic', () => {
    beforeEach(() => {
      const mockExecution = {
        execution_id: 'exec-throttle-123',
        workflow_id: 'workflow-throttle',
        status: 'failure',
        error_message: 'Throttle test error',
        start_time: new Date(),
        workflow: { workflow_name: 'Throttle Test Workflow' }
      };

      (WorkflowExecution.findOne as jest.Mock).mockResolvedValue(mockExecution);
      (WorkflowAlert.create as jest.Mock).mockResolvedValue({ id: 1 });
    });

    it('should throttle based on global alert limit', async () => {
      // Mock global throttle hit
      (WorkflowAlert.count as jest.Mock)
        .mockResolvedValueOnce(10) // Global count (at limit)
        .mockResolvedValueOnce(0); // Workflow-specific count

      const result = await alertService.sendFailureAlert('exec-throttle-123');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('throttled');
    });

    it('should throttle based on per-workflow limit', async () => {
      // Mock workflow-specific throttle hit
      (WorkflowAlert.count as jest.Mock)
        .mockResolvedValueOnce(5) // Global count (under limit)
        .mockResolvedValueOnce(1); // Workflow-specific count (at limit)

      const result = await alertService.sendFailureAlert('exec-throttle-123');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('throttled');
    });

    it('should not throttle when under limits', async () => {
      // Mock under both limits
      (WorkflowAlert.count as jest.Mock)
        .mockResolvedValueOnce(3) // Global count (under limit)
        .mockResolvedValueOnce(0); // Workflow-specific count (under limit)

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'no-throttle-id' });

      const result = await alertService.sendFailureAlert('exec-throttle-123');

      expect(result.success).toBe(true);
      expect(result.skipped).toBeFalsy();
    });

    it('should bypass throttling when disabled', async () => {
      alertService = new AlertService({
        enabled: true,
        throttleEnabled: false,
        defaultRecipients: [{ email: 'test@example.com', alertTypes: ['failure'] }]
      });

      // Even with high counts, should not throttle
      (WorkflowAlert.count as jest.Mock).mockResolvedValue(100);
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'no-throttle-id' });

      const result = await alertService.sendFailureAlert('exec-throttle-123');

      expect(result.success).toBe(true);
      expect(result.skipped).toBeFalsy();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      (WorkflowExecution.findOne as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const result = await alertService.sendFailureAlert('exec-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    it('should handle alert creation errors', async () => {
      const mockExecution = {
        execution_id: 'exec-123',
        workflow_id: 'workflow-456',
        status: 'failure',
        error_message: 'Test error',
        start_time: new Date(),
        workflow: { workflow_name: 'Test Workflow' }
      };

      (WorkflowExecution.findOne as jest.Mock).mockResolvedValue(mockExecution);
      (WorkflowAlert.count as jest.Mock).mockResolvedValue(0);
      (WorkflowAlert.create as jest.Mock).mockRejectedValue(new Error('Alert creation failed'));

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      const result = await alertService.sendFailureAlert('exec-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Alert creation failed');
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle malformed recipient configuration', () => {
      process.env.ALERT_DEFAULT_RECIPIENTS = 'invalid-json-{';
      
      const service = new AlertService();
      expect(service).toBeDefined();
      
      delete process.env.ALERT_DEFAULT_RECIPIENTS;
    });

    it('should handle empty recipient list', async () => {
      alertService = new AlertService({
        enabled: true,
        defaultRecipients: []
      });

      const mockExecution = {
        execution_id: 'exec-123',
        workflow_id: 'workflow-456',
        workflow: { workflow_name: 'Test Workflow' }
      };

      (WorkflowExecution.findOne as jest.Mock).mockResolvedValue(mockExecution);

      const result = await alertService.sendFailureAlert('exec-123');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('No recipients configured');
    });
  });
});