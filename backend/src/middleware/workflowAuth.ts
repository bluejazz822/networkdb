/**
 * Workflow Authentication Middleware
 * Authentication and authorization middleware specifically for workflow endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { N8nErrorCode } from '../types/workflow';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username?: string;
        email?: string;
        roles?: string[];
        permissions?: string[];
      };
    }
  }
}

// Mock user data for development (will be replaced with real auth system)
const mockUsers = {
  'workflow-user-1': {
    id: 'workflow-user-1',
    username: 'admin',
    email: 'admin@example.com',
    roles: ['admin'],
    permissions: ['workflow:read', 'workflow:write', 'workflow:execute', 'workflow:admin']
  },
  'workflow-user-2': {
    id: 'workflow-user-2',
    username: 'operator',
    email: 'operator@example.com',
    roles: ['operator'],
    permissions: ['workflow:read', 'workflow:execute']
  },
  'workflow-user-3': {
    id: 'workflow-user-3',
    username: 'viewer',
    email: 'viewer@example.com',
    roles: ['viewer'],
    permissions: ['workflow:read']
  }
};

/**
 * Basic authentication middleware for workflow routes
 * In production, this should integrate with the actual authentication system
 */
export function authenticateWorkflowUser(req: Request, res: Response, next: NextFunction): void {
  try {
    // For development, check for a simple authorization header or use default user
    const authHeader = req.headers.authorization;
    let userId = 'workflow-user-1'; // Default admin user for development

    if (authHeader) {
      // Extract user ID from Bearer token or API key
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // In production, validate JWT token here
        // For now, treat token as user ID
        if (mockUsers[token as keyof typeof mockUsers]) {
          userId = token;
        }
      } else if (authHeader.startsWith('ApiKey ')) {
        const apiKey = authHeader.substring(7);
        // In production, validate API key here
        // For now, map API key to user ID
        userId = apiKey;
      }
    }

    // Check if user exists
    const user = mockUsers[userId as keyof typeof mockUsers];
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: [{
          code: 'AUTHENTICATION_FAILED' as N8nErrorCode,
          message: 'Invalid or missing authentication credentials'
        }]
      });
    }

    // Attach user to request
    req.user = user;

    // Log authentication for audit trail
    console.log(`Workflow API authenticated user: ${user.username} (${user.id}) from ${req.ip}`);

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication system error',
      errors: [{
        code: 'AUTHENTICATION_FAILED' as N8nErrorCode,
        message: 'An error occurred during authentication'
      }]
    });
  }
}

/**
 * Authorization middleware factory for specific workflow permissions
 */
export function requireWorkflowPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: [{
            code: 'AUTHENTICATION_FAILED' as N8nErrorCode,
            message: 'User not authenticated'
          }]
        });
      }

      // Check if user has required permission
      if (!user.permissions?.includes(permission)) {
        console.log(`Permission denied: User ${user.username} missing ${permission}`);
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          errors: [{
            code: 'PERMISSION_DENIED' as N8nErrorCode,
            message: `Required permission: ${permission}`
          }]
        });
      }

      // Log authorization for audit trail
      console.log(`Authorization granted: User ${user.username} has ${permission}`);

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization system error',
        errors: [{
          code: 'PERMISSION_DENIED' as N8nErrorCode,
          message: 'An error occurred during authorization'
        }]
      });
    }
  };
}

/**
 * Role-based authorization middleware
 */
export function requireWorkflowRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: [{
            code: 'AUTHENTICATION_FAILED' as N8nErrorCode,
            message: 'User not authenticated'
          }]
        });
      }

      // Check if user has required role
      if (!user.roles?.includes(role)) {
        console.log(`Role access denied: User ${user.username} missing role ${role}`);
        return res.status(403).json({
          success: false,
          message: 'Insufficient role privileges',
          errors: [{
            code: 'PERMISSION_DENIED' as N8nErrorCode,
            message: `Required role: ${role}`
          }]
        });
      }

      console.log(`Role access granted: User ${user.username} has role ${role}`);
      next();
    } catch (error) {
      console.error('Role authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Role authorization system error',
        errors: [{
          code: 'PERMISSION_DENIED' as N8nErrorCode,
          message: 'An error occurred during role authorization'
        }]
      });
    }
  };
}

/**
 * Workflow-specific authorization middleware for workflow access control
 */
export function authorizeWorkflowAccess(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.user;
    const workflowId = req.params.id;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: [{
          code: 'AUTHENTICATION_FAILED' as N8nErrorCode,
          message: 'User not authenticated'
        }]
      });
    }

    // TODO: In production, check if user has access to specific workflow
    // For now, allow access based on basic permissions
    
    const isReadOperation = req.method === 'GET';
    const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    
    if (isReadOperation && !user.permissions?.includes('workflow:read')) {
      return res.status(403).json({
        success: false,
        message: 'Read access denied',
        errors: [{
          code: 'PERMISSION_DENIED' as N8nErrorCode,
          message: 'Insufficient permissions to read workflows'
        }]
      });
    }

    if (isWriteOperation && !user.permissions?.includes('workflow:write')) {
      return res.status(403).json({
        success: false,
        message: 'Write access denied',
        errors: [{
          code: 'PERMISSION_DENIED' as N8nErrorCode,
          message: 'Insufficient permissions to modify workflows'
        }]
      });
    }

    // Special handling for workflow execution
    if (req.path.includes('/trigger') && !user.permissions?.includes('workflow:execute')) {
      return res.status(403).json({
        success: false,
        message: 'Execution access denied',
        errors: [{
          code: 'PERMISSION_DENIED' as N8nErrorCode,
          message: 'Insufficient permissions to execute workflows'
        }]
      });
    }

    console.log(`Workflow access granted: User ${user.username} accessing workflow ${workflowId || 'list'}`);
    next();
  } catch (error) {
    console.error('Workflow authorization error:', error);
    res.status(500).json({
      success: false,
      message: 'Workflow authorization system error',
      errors: [{
        code: 'PERMISSION_DENIED' as N8nErrorCode,
        message: 'An error occurred during workflow authorization'
      }]
    });
  }
}

/**
 * Optional authentication middleware - allows access without auth but attaches user if present
 */
export function optionalWorkflowAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      // Try to authenticate if credentials are provided
      authenticateWorkflowUser(req, res, next);
    } else {
      // Continue without authentication for public endpoints
      next();
    }
  } catch (error) {
    // Continue without authentication on error for optional auth
    console.warn('Optional authentication failed, continuing without auth:', error);
    next();
  }
}

/**
 * Extract user context for logging and audit trails
 */
export function extractUserContext(req: Request): string {
  const user = req.user;
  if (user) {
    return `User: ${user.username} (${user.id})`;
  }
  return `Anonymous user from ${req.ip}`;
}

/**
 * Middleware to log workflow API access for audit trails
 */
export function logWorkflowAccess(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const userContext = extractUserContext(req);
  
  console.log(`Workflow API ${req.method} ${req.path} - ${userContext}`);
  
  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`Workflow API ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${userContext}`);
  });
  
  next();
}

// Pre-configured middleware combinations for common use cases
export const workflowAuthMiddleware = {
  // Full authentication + general workflow access
  authenticated: [authenticateWorkflowUser, authorizeWorkflowAccess, logWorkflowAccess],
  
  // Authentication + specific permission
  withPermission: (permission: string) => [
    authenticateWorkflowUser, 
    requireWorkflowPermission(permission), 
    logWorkflowAccess
  ],
  
  // Authentication + specific role
  withRole: (role: string) => [
    authenticateWorkflowUser, 
    requireWorkflowRole(role), 
    logWorkflowAccess
  ],
  
  // Optional authentication with logging
  optional: [optionalWorkflowAuth, logWorkflowAccess],
  
  // Read-only access
  readOnly: [
    authenticateWorkflowUser, 
    requireWorkflowPermission('workflow:read'), 
    logWorkflowAccess
  ],
  
  // Execution access (requires execute permission)
  execution: [
    authenticateWorkflowUser, 
    requireWorkflowPermission('workflow:execute'), 
    logWorkflowAccess
  ],
  
  // Admin only access
  adminOnly: [
    authenticateWorkflowUser, 
    requireWorkflowRole('admin'), 
    logWorkflowAccess
  ]
};

export default workflowAuthMiddleware;