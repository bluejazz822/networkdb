/**
 * Report Security Middleware
 * Authentication, authorization, and security controls for report endpoints
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import {
  ReportAuthorizationService,
  ReportUserContext,
  ReportPermissions
} from '../auth/ReportPermissions';
import {
  ReportAuditLogger,
  AuditAction,
  AuditResource
} from '../audit/ReportAuditLogger';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      reportUser?: ReportUserContext;
      securityContext?: {
        requiresAudit: boolean;
        sensitiveOperation: boolean;
        riskLevel: 'low' | 'medium' | 'high';
      };
    }
  }
}

/**
 * Security error types
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Authentication middleware for reports
 */
export async function authenticateReportUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    let user: any = null;

    // Try JWT token authentication
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
        user = await User.findByPk(decoded.userId, {
          include: ['roles']
        });
      } catch (jwtError) {
        throw new SecurityError('Invalid or expired token', 'INVALID_TOKEN', 401);
      }
    }
    // Try API key authentication (for service-to-service calls)
    else if (apiKey) {
      // In production, validate API key against database
      // For now, use a simple validation
      if (apiKey === process.env.REPORT_API_KEY) {
        // Use a system user for API key authentication
        user = {
          id: 'system',
          username: 'system',
          email: 'system@internal',
          roles: [{ name: 'SYSTEM' }]
        };
      } else {
        throw new SecurityError('Invalid API key', 'INVALID_API_KEY', 401);
      }
    }
    // Try session-based authentication (for web UI)
    else if (req.session?.userId) {
      user = await User.findByPk(req.session.userId, {
        include: ['roles']
      });
    }

    if (!user) {
      await ReportAuditLogger.logAuthenticationFailed(
        req.ip,
        req.get('User-Agent'),
        { path: req.path, method: req.method }
      );
      throw new SecurityError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
    }

    // Check if user account is active
    if (!user.isActive) {
      throw new SecurityError('Account is disabled', 'ACCOUNT_DISABLED', 403);
    }

    // Create report user context
    req.reportUser = await ReportAuthorizationService.createUserContext(
      user,
      req.ip,
      req.get('User-Agent'),
      req.sessionID || crypto.randomBytes(16).toString('hex')
    );

    next();
  } catch (error) {
    if (error instanceof SecurityError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      console.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication system error'
        }
      });
    }
  }
}

/**
 * Authorization middleware factory for specific permissions
 */
export function requireReportPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.reportUser;

      if (!user) {
        throw new SecurityError('User not authenticated', 'USER_NOT_AUTHENTICATED', 401);
      }

      const hasPermission = await ReportAuthorizationService.hasReportPermission(user, permission);

      if (!hasPermission) {
        await ReportAuditLogger.logPermissionDenied(
          user,
          permission,
          'report',
          undefined,
          { path: req.path, method: req.method }
        );
        throw new SecurityError(`Missing required permission: ${permission}`, 'PERMISSION_DENIED', 403);
      }

      next();
    } catch (error) {
      if (error instanceof SecurityError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      } else {
        console.error('Authorization error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'AUTHORIZATION_ERROR',
            message: 'Authorization system error'
          }
        });
      }
    }
  };
}

/**
 * Middleware to check data access permissions
 */
export function requireDataAccess(dataTypes: string[], accessLevel: 'read' | 'write' | 'admin' = 'read') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.reportUser;

      if (!user) {
        throw new SecurityError('User not authenticated', 'USER_NOT_AUTHENTICATED', 401);
      }

      for (const dataType of dataTypes) {
        const hasAccess = await ReportAuthorizationService.hasDataAccess(
          user,
          dataType as any,
          accessLevel as any
        );

        if (!hasAccess) {
          await ReportAuditLogger.logPermissionDenied(
            user,
            `data:${dataType}:${accessLevel}`,
            'data',
            dataType,
            { path: req.path, method: req.method }
          );
          throw new SecurityError(
            `Insufficient access to ${dataType} data`,
            'DATA_ACCESS_DENIED',
            403
          );
        }
      }

      next();
    } catch (error) {
      if (error instanceof SecurityError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      } else {
        console.error('Data access check error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'DATA_ACCESS_ERROR',
            message: 'Data access check failed'
          }
        });
      }
    }
  };
}

/**
 * Middleware to validate export permissions
 */
export function requireExportPermission(format?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.reportUser;

      if (!user) {
        throw new SecurityError('User not authenticated', 'USER_NOT_AUTHENTICATED', 401);
      }

      // Get format from request if not provided
      const exportFormat = format || req.body?.format || req.query?.format;

      if (!exportFormat) {
        throw new SecurityError('Export format not specified', 'FORMAT_NOT_SPECIFIED', 400);
      }

      const canExport = await ReportAuthorizationService.canExportFormat(user, exportFormat);

      if (!canExport) {
        await ReportAuditLogger.logPermissionDenied(
          user,
          `export:${exportFormat}`,
          'export',
          undefined,
          { path: req.path, method: req.method, format: exportFormat }
        );
        throw new SecurityError(
          `Not authorized to export in ${exportFormat} format`,
          'EXPORT_FORMAT_DENIED',
          403
        );
      }

      next();
    } catch (error) {
      if (error instanceof SecurityError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      } else {
        console.error('Export permission check error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'EXPORT_PERMISSION_ERROR',
            message: 'Export permission check failed'
          }
        });
      }
    }
  };
}

/**
 * Middleware to add security context
 */
export function addSecurityContext(
  requiresAudit: boolean = true,
  sensitiveOperation: boolean = false,
  riskLevel: 'low' | 'medium' | 'high' = 'low'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.securityContext = {
      requiresAudit,
      sensitiveOperation,
      riskLevel
    };
    next();
  };
}

/**
 * Audit logging middleware
 */
export function auditReportAccess(action: AuditAction, resource: AuditResource) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    const startTime = Date.now();

    res.send = function(body) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log the action after response is sent
      setImmediate(async () => {
        try {
          const user = req.reportUser;
          const success = res.statusCode < 400;

          await ReportAuditLogger.log(user || null, {
            action,
            resource,
            resourceId: req.params.id || req.params.reportId,
            details: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              duration,
              query: req.query,
              userAgent: req.get('User-Agent')
            },
            status: success ? 'success' : 'failed',
            errorMessage: success ? undefined : 'Request failed'
          });
        } catch (error) {
          console.error('Audit logging failed:', error);
        }
      });

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Rate limiting for report endpoints
 */
export const reportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.reportUser?.id || req.ip;
  }
});

/**
 * Strict rate limiting for export operations
 */
export const exportRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each user to 5 exports per minute
  message: {
    success: false,
    error: {
      code: 'EXPORT_RATE_LIMIT_EXCEEDED',
      message: 'Export rate limit exceeded, please wait before requesting another export'
    }
  },
  keyGenerator: (req) => {
    return req.reportUser?.id || req.ip;
  }
});

/**
 * Security headers middleware
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * Input validation and sanitization middleware
 */
export function validateAndSanitizeInput(req: Request, res: Response, next: NextFunction): void {
  try {
    // Basic input validation and sanitization
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        // Remove potentially dangerous characters
        req.query[key] = (req.query[key] as string)
          .replace(/[<>\"'%;()&+]/g, '')
          .trim()
          .substring(0, 1000); // Limit length
      }
    }

    // Validate body size
    if (req.body && JSON.stringify(req.body).length > 1000000) { // 1MB limit
      throw new SecurityError('Request body too large', 'BODY_TOO_LARGE', 413);
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload/i,
      /onerror/i,
      /<iframe/i,
      /<embed/i,
      /<object/i
    ];

    const requestString = JSON.stringify(req.body) + JSON.stringify(req.query);
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestString)) {
        if (req.reportUser) {
          ReportAuditLogger.logSuspiciousActivity(
            req.reportUser,
            'Suspicious input detected',
            { pattern: pattern.toString(), input: requestString.substring(0, 500) }
          );
        }
        throw new SecurityError('Suspicious input detected', 'SUSPICIOUS_INPUT', 400);
      }
    }

    next();
  } catch (error) {
    if (error instanceof SecurityError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      console.error('Input validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed'
        }
      });
    }
  }
}

/**
 * Pre-configured middleware combinations
 */
export const reportSecurityMiddleware = {
  // Basic authentication and validation
  basic: [
    securityHeaders,
    validateAndSanitizeInput,
    reportRateLimiter,
    authenticateReportUser
  ],

  // Read-only report access
  readOnly: [
    securityHeaders,
    validateAndSanitizeInput,
    reportRateLimiter,
    authenticateReportUser,
    requireReportPermission(ReportPermissions.REPORT_READ),
    addSecurityContext(true, false, 'low'),
    auditReportAccess(AuditAction.VIEW_REPORT, AuditResource.REPORT)
  ],

  // Report creation/modification
  writeAccess: [
    securityHeaders,
    validateAndSanitizeInput,
    reportRateLimiter,
    authenticateReportUser,
    requireReportPermission(ReportPermissions.REPORT_CREATE),
    addSecurityContext(true, false, 'medium'),
    auditReportAccess(AuditAction.CREATE_REPORT, AuditResource.REPORT)
  ],

  // Export operations
  exportAccess: [
    securityHeaders,
    validateAndSanitizeInput,
    exportRateLimiter,
    authenticateReportUser,
    requireReportPermission(ReportPermissions.REPORT_EXPORT),
    requireExportPermission(),
    addSecurityContext(true, true, 'medium'),
    auditReportAccess(AuditAction.EXPORT_REPORT, AuditResource.EXPORT)
  ],

  // Administrative operations
  adminAccess: [
    securityHeaders,
    validateAndSanitizeInput,
    reportRateLimiter,
    authenticateReportUser,
    requireReportPermission(ReportPermissions.REPORT_MANAGE),
    addSecurityContext(true, true, 'high'),
    auditReportAccess(AuditAction.MODIFY_REPORT, AuditResource.REPORT)
  ],

  // Sensitive data access
  sensitiveData: [
    securityHeaders,
    validateAndSanitizeInput,
    reportRateLimiter,
    authenticateReportUser,
    requireDataAccess(['sensitive']),
    addSecurityContext(true, true, 'high'),
    auditReportAccess(AuditAction.ACCESS_SENSITIVE, AuditResource.DATA)
  ]
};

export default reportSecurityMiddleware;