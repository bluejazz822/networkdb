/**
 * External Service Validation Utilities
 * Helpers for testing external service integrations with proper error handling
 * and realistic timeout/retry scenarios for production-like testing
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import nodemailer from 'nodemailer';
import { n8nAxiosClient, n8nUtils, n8nConfig } from '../../src/config/n8n';
import { createEmailTransporter, getEmailConfig } from '../../src/config/email';

// Test configuration constants
export const TEST_CONFIG = {
  n8n: {
    healthCheckTimeout: 10000,
    workflowTimeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  email: {
    testTimeout: 15000,
    connectionTimeout: 10000,
    sendTimeout: 20000,
  },
  service: {
    unavailableRetryCount: 2,
    degradedThresholdMs: 5000,
    healthyThresholdMs: 2000,
  }
} as const;

export interface ServiceHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unavailable' | 'timeout';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface N8nServiceValidation {
  connectivity: ServiceHealthStatus;
  authentication: ServiceHealthStatus;
  apiVersion: ServiceHealthStatus;
  workflows: ServiceHealthStatus;
  rateLimit: ServiceHealthStatus;
}

export interface EmailServiceValidation {
  smtp: ServiceHealthStatus;
  authentication: ServiceHealthStatus;
  sendCapability: ServiceHealthStatus;
  templates: ServiceHealthStatus;
}

/**
 * N8n Service Validation Class
 */
export class N8nServiceValidator {
  private client: AxiosInstance;

  constructor() {
    this.client = n8nAxiosClient;
  }

  /**
   * Validate n8n service connectivity
   */
  async validateConnectivity(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        this.client.get('/healthz'),
        this.timeoutPromise(TEST_CONFIG.n8n.healthCheckTimeout, 'Health check timeout')
      ]);

      const responseTime = Date.now() - startTime;
      const status = responseTime > TEST_CONFIG.service.degradedThresholdMs ? 'degraded' : 'healthy';

      return {
        service: 'n8n-connectivity',
        status,
        responseTime,
        details: {
          httpStatus: response.status,
          endpoint: '/healthz',
          baseUrl: n8nConfig.baseUrl
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (this.isTimeoutError(error)) {
        return {
          service: 'n8n-connectivity',
          status: 'timeout',
          responseTime,
          error: 'Connection timeout exceeded',
          details: { timeout: TEST_CONFIG.n8n.healthCheckTimeout },
          timestamp: new Date()
        };
      }

      return {
        service: 'n8n-connectivity',
        status: 'unavailable',
        responseTime,
        error: this.extractErrorMessage(error),
        details: this.extractErrorDetails(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate n8n API authentication
   */
  async validateAuthentication(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        this.client.get('/workflows', { params: { limit: 1 } }),
        this.timeoutPromise(TEST_CONFIG.n8n.healthCheckTimeout, 'Auth validation timeout')
      ]);

      const responseTime = Date.now() - startTime;

      return {
        service: 'n8n-authentication',
        status: 'healthy',
        responseTime,
        details: {
          httpStatus: response.status,
          hasApiKey: !!n8nConfig.apiKey,
          keyLength: n8nConfig.apiKey?.length || 0
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (this.isAuthenticationError(error)) {
        return {
          service: 'n8n-authentication',
          status: 'unavailable',
          responseTime,
          error: 'Authentication failed - check API key',
          details: {
            httpStatus: (error as AxiosError).response?.status,
            hasApiKey: !!n8nConfig.apiKey,
            keyConfigured: n8nConfig.apiKey?.length > 0
          },
          timestamp: new Date()
        };
      }

      return {
        service: 'n8n-authentication',
        status: 'unavailable',
        responseTime,
        error: this.extractErrorMessage(error),
        details: this.extractErrorDetails(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate n8n API version compatibility
   */
  async validateApiVersion(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      // Try to access a specific API endpoint to validate version
      const response = await Promise.race([
        this.client.get('/workflows', { params: { limit: 1 } }),
        this.timeoutPromise(TEST_CONFIG.n8n.healthCheckTimeout, 'API version check timeout')
      ]);

      const responseTime = Date.now() - startTime;

      // Check for expected response structure
      const hasExpectedStructure = response.data &&
        typeof response.data === 'object' &&
        Array.isArray(response.data.data);

      return {
        service: 'n8n-api-version',
        status: hasExpectedStructure ? 'healthy' : 'degraded',
        responseTime,
        details: {
          httpStatus: response.status,
          responseStructureValid: hasExpectedStructure,
          endpoint: '/workflows'
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        service: 'n8n-api-version',
        status: 'unavailable',
        responseTime,
        error: this.extractErrorMessage(error),
        details: this.extractErrorDetails(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate workflow operations
   */
  async validateWorkflowOperations(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      // Test workflow listing
      const listResponse = await Promise.race([
        this.client.get('/workflows', { params: { limit: 5, active: true } }),
        this.timeoutPromise(TEST_CONFIG.n8n.workflowTimeout, 'Workflow list timeout')
      ]);

      const workflows = listResponse.data?.data || [];
      const responseTime = Date.now() - startTime;

      // If we have workflows, try to get details of one
      let workflowDetailsWorking = false;
      if (workflows.length > 0) {
        try {
          const workflowId = workflows[0].id;
          await Promise.race([
            this.client.get(`/workflows/${workflowId}`),
            this.timeoutPromise(TEST_CONFIG.n8n.workflowTimeout, 'Workflow detail timeout')
          ]);
          workflowDetailsWorking = true;
        } catch {
          // Details failed but listing worked
        }
      }

      const status = workflowDetailsWorking ? 'healthy' :
                    workflows.length > 0 ? 'degraded' : 'healthy';

      return {
        service: 'n8n-workflows',
        status,
        responseTime,
        details: {
          httpStatus: listResponse.status,
          workflowCount: workflows.length,
          canListWorkflows: true,
          canGetWorkflowDetails: workflowDetailsWorking,
          sampleWorkflows: workflows.slice(0, 3).map((w: any) => ({
            id: w.id,
            name: w.name,
            active: w.active
          }))
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        service: 'n8n-workflows',
        status: 'unavailable',
        responseTime,
        error: this.extractErrorMessage(error),
        details: this.extractErrorDetails(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate rate limiting behavior
   */
  async validateRateLimit(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      // Get current rate limit status
      const rateLimitStatus = n8nUtils.getRateLimitStatus();

      // Make a test request to see current behavior
      const response = await this.client.get('/workflows', { params: { limit: 1 } });
      const responseTime = Date.now() - startTime;

      // Check rate limit headers if present
      const rateLimitHeaders = {
        remaining: response.headers['x-ratelimit-remaining'],
        reset: response.headers['x-ratelimit-reset'],
        limit: response.headers['x-ratelimit-limit']
      };

      return {
        service: 'n8n-rate-limit',
        status: 'healthy',
        responseTime,
        details: {
          currentRequests: rateLimitStatus.currentRequests,
          maxRequests: rateLimitStatus.maxRequests,
          canMakeRequest: rateLimitStatus.canMakeRequest,
          resetTime: rateLimitStatus.resetTime.toISOString(),
          headers: rateLimitHeaders,
          retryAfter: rateLimitStatus.retryAfter
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (this.isRateLimitError(error)) {
        return {
          service: 'n8n-rate-limit',
          status: 'degraded',
          responseTime,
          error: 'Rate limit exceeded',
          details: {
            httpStatus: (error as AxiosError).response?.status,
            retryAfter: (error as AxiosError).response?.headers['retry-after']
          },
          timestamp: new Date()
        };
      }

      return {
        service: 'n8n-rate-limit',
        status: 'unavailable',
        responseTime,
        error: this.extractErrorMessage(error),
        details: this.extractErrorDetails(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Run comprehensive n8n validation
   */
  async validateAll(): Promise<N8nServiceValidation> {
    console.log('🔍 Running comprehensive n8n service validation...');

    const [connectivity, authentication, apiVersion, workflows, rateLimit] = await Promise.allSettled([
      this.validateConnectivity(),
      this.validateAuthentication(),
      this.validateApiVersion(),
      this.validateWorkflowOperations(),
      this.validateRateLimit()
    ]);

    return {
      connectivity: connectivity.status === 'fulfilled' ? connectivity.value : this.createFailedStatus('n8n-connectivity', connectivity.reason),
      authentication: authentication.status === 'fulfilled' ? authentication.value : this.createFailedStatus('n8n-authentication', authentication.reason),
      apiVersion: apiVersion.status === 'fulfilled' ? apiVersion.value : this.createFailedStatus('n8n-api-version', apiVersion.reason),
      workflows: workflows.status === 'fulfilled' ? workflows.value : this.createFailedStatus('n8n-workflows', workflows.reason),
      rateLimit: rateLimit.status === 'fulfilled' ? rateLimit.value : this.createFailedStatus('n8n-rate-limit', rateLimit.reason)
    };
  }

  private timeoutPromise(timeout: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    });
  }

  private isTimeoutError(error: any): boolean {
    return error?.message?.includes('timeout') ||
           error?.code === 'ETIMEDOUT' ||
           error?.code === 'ECONNABORTED';
  }

  private isAuthenticationError(error: any): boolean {
    return (error as AxiosError)?.response?.status === 401 ||
           (error as AxiosError)?.response?.status === 403;
  }

  private isRateLimitError(error: any): boolean {
    return (error as AxiosError)?.response?.status === 429;
  }

  private extractErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (error?.response?.data?.error?.message) {
      return error.response.data.error.message;
    }
    if (error?.response?.statusText) {
      return error.response.statusText;
    }
    return 'Unknown error';
  }

  private extractErrorDetails(error: any): Record<string, any> {
    const details: Record<string, any> = {};

    if (error?.response) {
      details.httpStatus = error.response.status;
      details.statusText = error.response.statusText;
    }

    if (error?.code) {
      details.errorCode = error.code;
    }

    if (error?.config?.url) {
      details.endpoint = error.config.url;
    }

    return details;
  }

  private createFailedStatus(service: string, error: any): ServiceHealthStatus {
    return {
      service,
      status: 'unavailable',
      error: error?.message || 'Unknown validation error',
      details: { validationFailed: true },
      timestamp: new Date()
    };
  }
}

/**
 * Email Service Validation Class
 */
export class EmailServiceValidator {
  private transporter: nodemailer.Transporter | null;
  private config: any;

  constructor() {
    this.config = getEmailConfig();
    this.transporter = createEmailTransporter();
  }

  /**
   * Validate SMTP connectivity
   */
  async validateSMTP(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    if (!this.transporter) {
      return {
        service: 'email-smtp',
        status: 'unavailable',
        error: 'SMTP transporter not configured',
        details: {
          configured: false,
          host: this.config.smtp.host,
          port: this.config.smtp.port,
          secure: this.config.smtp.secure
        },
        timestamp: new Date()
      };
    }

    try {
      const verification = await Promise.race([
        this.transporter.verify(),
        this.timeoutPromise(TEST_CONFIG.email.connectionTimeout, 'SMTP verification timeout')
      ]);

      const responseTime = Date.now() - startTime;

      return {
        service: 'email-smtp',
        status: verification ? 'healthy' : 'degraded',
        responseTime,
        details: {
          configured: true,
          verified: verification,
          host: this.config.smtp.host,
          port: this.config.smtp.port,
          secure: this.config.smtp.secure
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        service: 'email-smtp',
        status: 'unavailable',
        responseTime,
        error: this.extractErrorMessage(error),
        details: {
          configured: true,
          host: this.config.smtp.host,
          port: this.config.smtp.port,
          error: error
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate SMTP authentication
   */
  async validateAuthentication(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    if (!this.transporter) {
      return {
        service: 'email-authentication',
        status: 'unavailable',
        error: 'SMTP transporter not configured',
        details: { configured: false },
        timestamp: new Date()
      };
    }

    try {
      // Verify includes authentication check
      const verification = await Promise.race([
        this.transporter.verify(),
        this.timeoutPromise(TEST_CONFIG.email.connectionTimeout, 'SMTP auth timeout')
      ]);

      const responseTime = Date.now() - startTime;

      return {
        service: 'email-authentication',
        status: verification ? 'healthy' : 'unavailable',
        responseTime,
        details: {
          authenticated: verification,
          hasCredentials: !!(this.config.smtp.auth.user && this.config.smtp.auth.pass),
          user: this.config.smtp.auth.user ? '***configured***' : 'not_configured'
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        service: 'email-authentication',
        status: 'unavailable',
        responseTime,
        error: this.extractErrorMessage(error),
        details: {
          authenticated: false,
          hasCredentials: !!(this.config.smtp.auth.user && this.config.smtp.auth.pass)
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate email sending capability with test email
   */
  async validateSendCapability(testEmail?: string): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    if (!this.transporter) {
      return {
        service: 'email-send-capability',
        status: 'unavailable',
        error: 'SMTP transporter not configured',
        timestamp: new Date()
      };
    }

    // Use a test email or a placeholder
    const recipient = testEmail || 'test@example.com';
    const isRealEmail = testEmail && testEmail.includes('@') && !testEmail.includes('example.com');

    try {
      const testMailOptions = {
        from: `"${this.config.from.name}" <${this.config.from.address}>`,
        to: recipient,
        subject: '[TEST] Network CMDB Integration Test',
        text: `This is a test email sent during integration testing at ${new Date().toISOString()}. If this is a real email address, the SMTP service is working correctly.`,
        html: `
          <h3>Integration Test Email</h3>
          <p>This is a test email sent during integration testing.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><em>If you received this email, the SMTP service is working correctly.</em></p>
        `
      };

      // Only send if it's a real email address, otherwise just validate the mail options
      let info;
      if (isRealEmail) {
        info = await Promise.race([
          this.transporter.sendMail(testMailOptions),
          this.timeoutPromise(TEST_CONFIG.email.sendTimeout, 'Email send timeout')
        ]);
      } else {
        // Simulate successful send for test email addresses
        info = { messageId: 'test-message-id', accepted: [recipient] };
      }

      const responseTime = Date.now() - startTime;

      return {
        service: 'email-send-capability',
        status: 'healthy',
        responseTime,
        details: {
          messageId: info.messageId,
          recipient: recipient,
          actualSend: isRealEmail,
          accepted: info.accepted,
          rejected: info.rejected || [],
          from: this.config.from.address
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        service: 'email-send-capability',
        status: 'unavailable',
        responseTime,
        error: this.extractErrorMessage(error),
        details: {
          recipient: recipient,
          actualSend: isRealEmail,
          from: this.config.from.address
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate email templates
   */
  async validateTemplates(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      // Import template functions
      const { getWorkflowFailureTemplate, getWorkflowSuccessTemplate } = await import('../../src/config/email');

      // Test failure template
      const failureTemplate = getWorkflowFailureTemplate(
        'Test Workflow',
        'test-execution-123',
        'Test error message',
        new Date(),
        this.config.templates.baseUrl
      );

      // Test success template
      const successTemplate = getWorkflowSuccessTemplate(
        'Test Workflow',
        'test-execution-456',
        new Date(),
        new Date(),
        5,
        this.config.templates.baseUrl
      );

      const responseTime = Date.now() - startTime;

      // Validate template structure
      const templatesValid =
        failureTemplate.subject && failureTemplate.html && failureTemplate.text &&
        successTemplate.subject && successTemplate.html && successTemplate.text;

      return {
        service: 'email-templates',
        status: templatesValid ? 'healthy' : 'degraded',
        responseTime,
        details: {
          failureTemplate: {
            hasSubject: !!failureTemplate.subject,
            hasHtml: !!failureTemplate.html,
            hasText: !!failureTemplate.text,
            subjectLength: failureTemplate.subject?.length || 0,
            htmlLength: failureTemplate.html?.length || 0,
            textLength: failureTemplate.text?.length || 0
          },
          successTemplate: {
            hasSubject: !!successTemplate.subject,
            hasHtml: !!successTemplate.html,
            hasText: !!successTemplate.text,
            subjectLength: successTemplate.subject?.length || 0,
            htmlLength: successTemplate.html?.length || 0,
            textLength: successTemplate.text?.length || 0
          },
          baseUrl: this.config.templates.baseUrl
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        service: 'email-templates',
        status: 'unavailable',
        responseTime,
        error: this.extractErrorMessage(error),
        details: {
          templateImportFailed: true
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Run comprehensive email service validation
   */
  async validateAll(testEmail?: string): Promise<EmailServiceValidation> {
    console.log('📧 Running comprehensive email service validation...');

    const [smtp, authentication, sendCapability, templates] = await Promise.allSettled([
      this.validateSMTP(),
      this.validateAuthentication(),
      this.validateSendCapability(testEmail),
      this.validateTemplates()
    ]);

    return {
      smtp: smtp.status === 'fulfilled' ? smtp.value : this.createFailedStatus('email-smtp', smtp.reason),
      authentication: authentication.status === 'fulfilled' ? authentication.value : this.createFailedStatus('email-authentication', authentication.reason),
      sendCapability: sendCapability.status === 'fulfilled' ? sendCapability.value : this.createFailedStatus('email-send-capability', sendCapability.reason),
      templates: templates.status === 'fulfilled' ? templates.value : this.createFailedStatus('email-templates', templates.reason)
    };
  }

  private timeoutPromise(timeout: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    });
  }

  private extractErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }

  private createFailedStatus(service: string, error: any): ServiceHealthStatus {
    return {
      service,
      status: 'unavailable',
      error: error?.message || 'Unknown validation error',
      details: { validationFailed: true },
      timestamp: new Date()
    };
  }
}

/**
 * Utility Functions
 */
export const externalServiceUtils = {
  /**
   * Wait for service to become available with retry logic
   */
  async waitForServiceAvailability(
    serviceValidator: () => Promise<ServiceHealthStatus>,
    options: {
      maxAttempts?: number;
      retryDelay?: number;
      acceptablestatus?: ('healthy' | 'degraded')[];
    } = {}
  ): Promise<ServiceHealthStatus> {
    const {
      maxAttempts = TEST_CONFIG.service.unavailableRetryCount,
      retryDelay = TEST_CONFIG.n8n.retryDelay,
      acceptablestatus = ['healthy', 'degraded']
    } = options;

    let lastStatus: ServiceHealthStatus;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      lastStatus = await serviceValidator();

      if (acceptablestatus.includes(lastStatus.status)) {
        return lastStatus;
      }

      if (attempt < maxAttempts) {
        console.log(`Service unavailable (attempt ${attempt}/${maxAttempts}), retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return lastStatus!;
  },

  /**
   * Create comprehensive service validation report
   */
  createValidationReport(n8nValidation: N8nServiceValidation, emailValidation: EmailServiceValidation): {
    overall: 'healthy' | 'degraded' | 'unavailable';
    services: {
      n8n: {
        status: 'healthy' | 'degraded' | 'unavailable';
        details: N8nServiceValidation;
      };
      email: {
        status: 'healthy' | 'degraded' | 'unavailable';
        details: EmailServiceValidation;
      };
    };
    summary: {
      healthyServices: number;
      degradedServices: number;
      unavailableServices: number;
      totalServices: number;
    };
    recommendations: string[];
  } {
    // Calculate service statuses
    const n8nStatuses = Object.values(n8nValidation).map(v => v.status);
    const emailStatuses = Object.values(emailValidation).map(v => v.status);
    const allStatuses = [...n8nStatuses, ...emailStatuses];

    const n8nStatus = n8nStatuses.includes('unavailable') ? 'unavailable' :
                     n8nStatuses.includes('degraded') ? 'degraded' : 'healthy';

    const emailStatus = emailStatuses.includes('unavailable') ? 'unavailable' :
                       emailStatuses.includes('degraded') ? 'degraded' : 'healthy';

    const overall = allStatuses.includes('unavailable') ? 'unavailable' :
                   allStatuses.includes('degraded') ? 'degraded' : 'healthy';

    // Create summary
    const summary = {
      healthyServices: allStatuses.filter(s => s === 'healthy').length,
      degradedServices: allStatuses.filter(s => s === 'degraded').length,
      unavailableServices: allStatuses.filter(s => s === 'unavailable').length,
      totalServices: allStatuses.length
    };

    // Generate recommendations
    const recommendations: string[] = [];

    if (n8nValidation.connectivity.status === 'unavailable') {
      recommendations.push('Check n8n service connectivity and ensure the service is running');
    }

    if (n8nValidation.authentication.status === 'unavailable') {
      recommendations.push('Verify n8n API key configuration and permissions');
    }

    if (emailValidation.smtp.status === 'unavailable') {
      recommendations.push('Check SMTP server configuration and connectivity');
    }

    if (emailValidation.authentication.status === 'unavailable') {
      recommendations.push('Verify SMTP authentication credentials');
    }

    if (allStatuses.some(s => s === 'timeout')) {
      recommendations.push('Consider increasing timeout values for better reliability');
    }

    if (recommendations.length === 0) {
      recommendations.push('All services are operating within normal parameters');
    }

    return {
      overall,
      services: {
        n8n: { status: n8nStatus, details: n8nValidation },
        email: { status: emailStatus, details: emailValidation }
      },
      summary,
      recommendations
    };
  },

  /**
   * Print validation report to console
   */
  printValidationReport(report: any): void {
    console.log('\n📊 External Service Validation Report');
    console.log('=====================================');
    console.log(`Overall Status: ${report.overall.toUpperCase()}`);
    console.log(`Services: ${report.summary.healthyServices} healthy, ${report.summary.degradedServices} degraded, ${report.summary.unavailableServices} unavailable`);

    console.log('\n🔗 N8n Service Status:', report.services.n8n.status.toUpperCase());
    Object.entries(report.services.n8n.details).forEach(([key, value]: [string, any]) => {
      console.log(`  ${key}: ${value.status} (${value.responseTime || 0}ms)`);
      if (value.error) console.log(`    Error: ${value.error}`);
    });

    console.log('\n📧 Email Service Status:', report.services.email.status.toUpperCase());
    Object.entries(report.services.email.details).forEach(([key, value]: [string, any]) => {
      console.log(`  ${key}: ${value.status} (${value.responseTime || 0}ms)`);
      if (value.error) console.log(`    Error: ${value.error}`);
    });

    console.log('\n💡 Recommendations:');
    report.recommendations.forEach((rec: string) => console.log(`  • ${rec}`));
    console.log('');
  }
};

// Export singleton instances for easy use in tests
export const n8nValidator = new N8nServiceValidator();
export const emailValidator = new EmailServiceValidator();