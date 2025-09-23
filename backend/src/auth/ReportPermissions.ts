/**
 * Report-specific permissions and authorization utilities
 * Extends the existing RBAC system with report-focused security controls
 */

import { Permission, SystemPermissions } from '../models/Permission';
import { Role, SystemRoles } from '../models/Role';
import { User } from '../models/User';

/**
 * Report-specific permission constants
 */
export const ReportPermissions = {
  // Basic report access
  REPORT_READ: 'report:read',
  REPORT_CREATE: 'report:create',
  REPORT_MODIFY: 'report:modify',
  REPORT_DELETE: 'report:delete',
  REPORT_MANAGE: 'report:manage',

  // Export permissions
  REPORT_EXPORT: 'report:export',
  REPORT_EXPORT_PDF: 'report:export_pdf',
  REPORT_EXPORT_EXCEL: 'report:export_excel',
  REPORT_EXPORT_CSV: 'report:export_csv',

  // Scheduling permissions
  REPORT_SCHEDULE: 'report:schedule',
  REPORT_SCHEDULE_MANAGE: 'report:schedule_manage',

  // Sharing permissions
  REPORT_SHARE: 'report:share',
  REPORT_SHARE_PUBLIC: 'report:share_public',

  // Data access permissions
  DATA_VPC: 'data:vpc',
  DATA_SUBNET: 'data:subnet',
  DATA_TRANSIT_GATEWAY: 'data:transit_gateway',
  DATA_CUSTOMER_GATEWAY: 'data:customer_gateway',
  DATA_VPC_ENDPOINT: 'data:vpc_endpoint',
  DATA_SENSITIVE: 'data:sensitive',
  DATA_COMPLIANCE: 'data:compliance',

  // Advanced features
  REPORT_TEMPLATE_CREATE: 'report:template_create',
  REPORT_TEMPLATE_MANAGE: 'report:template_manage',
  REPORT_ANALYTICS: 'report:analytics',
  REPORT_AUDIT: 'report:audit'
} as const;

/**
 * Data resource types that can be accessed in reports
 */
export enum DataResourceType {
  VPC = 'vpc',
  SUBNET = 'subnet',
  TRANSIT_GATEWAY = 'transit_gateway',
  CUSTOMER_GATEWAY = 'customer_gateway',
  VPC_ENDPOINT = 'vpc_endpoint',
  SENSITIVE = 'sensitive',
  COMPLIANCE = 'compliance'
}

/**
 * Access levels for data resources
 */
export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin'
}

/**
 * Export format permissions mapping
 */
export const ExportFormatPermissions = {
  pdf: ReportPermissions.REPORT_EXPORT_PDF,
  excel: ReportPermissions.REPORT_EXPORT_EXCEL,
  xlsx: ReportPermissions.REPORT_EXPORT_EXCEL,
  csv: ReportPermissions.REPORT_EXPORT_CSV,
  json: ReportPermissions.REPORT_EXPORT, // Basic export permission for JSON
  html: ReportPermissions.REPORT_EXPORT  // Basic export permission for HTML
} as const;

/**
 * Permission groups for easier management
 */
export const ReportPermissionGroups = {
  BASIC_REPORTING: [
    ReportPermissions.REPORT_READ,
    ReportPermissions.REPORT_CREATE
  ],
  ADVANCED_REPORTING: [
    ReportPermissions.REPORT_READ,
    ReportPermissions.REPORT_CREATE,
    ReportPermissions.REPORT_MODIFY,
    ReportPermissions.REPORT_EXPORT,
    ReportPermissions.REPORT_SHARE
  ],
  REPORT_MANAGEMENT: [
    ReportPermissions.REPORT_READ,
    ReportPermissions.REPORT_CREATE,
    ReportPermissions.REPORT_MODIFY,
    ReportPermissions.REPORT_DELETE,
    ReportPermissions.REPORT_MANAGE,
    ReportPermissions.REPORT_TEMPLATE_MANAGE
  ],
  DATA_ACCESS_BASIC: [
    ReportPermissions.DATA_VPC,
    ReportPermissions.DATA_SUBNET
  ],
  DATA_ACCESS_FULL: [
    ReportPermissions.DATA_VPC,
    ReportPermissions.DATA_SUBNET,
    ReportPermissions.DATA_TRANSIT_GATEWAY,
    ReportPermissions.DATA_CUSTOMER_GATEWAY,
    ReportPermissions.DATA_VPC_ENDPOINT
  ],
  DATA_ACCESS_ADMIN: [
    ReportPermissions.DATA_VPC,
    ReportPermissions.DATA_SUBNET,
    ReportPermissions.DATA_TRANSIT_GATEWAY,
    ReportPermissions.DATA_CUSTOMER_GATEWAY,
    ReportPermissions.DATA_VPC_ENDPOINT,
    ReportPermissions.DATA_SENSITIVE,
    ReportPermissions.DATA_COMPLIANCE
  ]
} as const;

/**
 * User interface for report authentication context
 */
export interface ReportUserContext {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  dataAccess: {
    [key in DataResourceType]?: AccessLevel;
  };
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

/**
 * Authorization service for report operations
 */
export class ReportAuthorizationService {
  /**
   * Check if user has permission to perform a specific report action
   */
  static async hasReportPermission(user: ReportUserContext, permission: string): Promise<boolean> {
    return user.permissions?.includes(permission) || false;
  }

  /**
   * Check if user has permission to access specific data type
   */
  static async hasDataAccess(
    user: ReportUserContext,
    dataType: DataResourceType,
    accessLevel: AccessLevel = AccessLevel.READ
  ): Promise<boolean> {
    const userDataAccess = user.dataAccess[dataType];
    if (!userDataAccess) return false;

    // Check access level hierarchy: admin > write > read
    const accessLevels = { read: 1, write: 2, admin: 3 };
    const requiredLevel = accessLevels[accessLevel];
    const userLevel = accessLevels[userDataAccess];

    return userLevel >= requiredLevel;
  }

  /**
   * Check if user can export in a specific format
   */
  static async canExportFormat(user: ReportUserContext, format: string): Promise<boolean> {
    const requiredPermission = ExportFormatPermissions[format as keyof typeof ExportFormatPermissions];
    if (!requiredPermission) return false;

    return this.hasReportPermission(user, requiredPermission);
  }

  /**
   * Get user's accessible data types
   */
  static getAccessibleDataTypes(user: ReportUserContext): DataResourceType[] {
    return Object.keys(user.dataAccess) as DataResourceType[];
  }

  /**
   * Check if user can access sensitive data
   */
  static async canAccessSensitiveData(user: ReportUserContext): Promise<boolean> {
    return this.hasDataAccess(user, DataResourceType.SENSITIVE, AccessLevel.READ);
  }

  /**
   * Check if user can access compliance data
   */
  static async canAccessComplianceData(user: ReportUserContext): Promise<boolean> {
    return this.hasDataAccess(user, DataResourceType.COMPLIANCE, AccessLevel.READ);
  }

  /**
   * Get filtered permissions for user based on their role
   */
  static async getEffectivePermissions(userId: string): Promise<string[]> {
    try {
      const user = await User.findByPk(userId, {
        include: [{
          model: Role,
          as: 'roles',
          include: [{
            model: Permission,
            as: 'permissions',
            where: { isActive: true }
          }]
        }]
      });

      if (!user) return [];

      const permissions = new Set<string>();

      // Collect all permissions from all roles
      for (const role of (user as any).roles || []) {
        for (const permission of role.permissions || []) {
          permissions.add(permission.name);
        }
      }

      return Array.from(permissions);
    } catch (error) {
      console.error('Error getting effective permissions:', error);
      return [];
    }
  }

  /**
   * Get user's data access matrix
   */
  static async getUserDataAccess(userId: string): Promise<{ [key in DataResourceType]?: AccessLevel }> {
    try {
      // This would query the report_access_controls table
      // For now, return based on user permissions
      const permissions = await this.getEffectivePermissions(userId);
      const dataAccess: { [key in DataResourceType]?: AccessLevel } = {};

      // Map permissions to data access
      for (const dataType of Object.values(DataResourceType)) {
        const dataPermission = `data:${dataType}`;
        if (permissions.includes(dataPermission)) {
          // Determine access level based on other permissions
          if (permissions.includes(SystemPermissions.SYSTEM_MANAGE)) {
            dataAccess[dataType] = AccessLevel.ADMIN;
          } else if (permissions.includes(SystemPermissions.NETWORK_MANAGE)) {
            dataAccess[dataType] = AccessLevel.WRITE;
          } else {
            dataAccess[dataType] = AccessLevel.READ;
          }
        }
      }

      return dataAccess;
    } catch (error) {
      console.error('Error getting user data access:', error);
      return {};
    }
  }

  /**
   * Create report user context from authenticated user
   */
  static async createUserContext(
    user: any,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string
  ): Promise<ReportUserContext> {
    const permissions = await this.getEffectivePermissions(user.id);
    const dataAccess = await this.getUserDataAccess(user.id);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles?.map((role: any) => role.name) || [],
      permissions,
      dataAccess,
      ipAddress,
      userAgent,
      sessionId
    };
  }

  /**
   * Validate report query against user permissions
   */
  static async validateReportQuery(
    user: ReportUserContext,
    query: any
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check basic report read permission
    if (!await this.hasReportPermission(user, ReportPermissions.REPORT_READ)) {
      errors.push('User does not have permission to view reports');
      return { valid: false, errors };
    }

    // Check data access permissions for requested resources
    if (query.resourceTypes) {
      for (const resourceType of query.resourceTypes) {
        const dataType = resourceType as DataResourceType;
        if (!await this.hasDataAccess(user, dataType)) {
          errors.push(`User does not have access to ${resourceType} data`);
        }
      }
    }

    // Check sensitive data access
    if (query.includeSensitive && !await this.canAccessSensitiveData(user)) {
      errors.push('User does not have permission to access sensitive data');
    }

    // Check compliance data access
    if (query.includeCompliance && !await this.canAccessComplianceData(user)) {
      errors.push('User does not have permission to access compliance data');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Filter report data based on user permissions
   */
  static filterReportData(user: ReportUserContext, data: any[]): any[] {
    const accessibleTypes = this.getAccessibleDataTypes(user);

    return data.filter(item => {
      // Filter based on resource type access
      if (item.resourceType && !accessibleTypes.includes(item.resourceType)) {
        return false;
      }

      // Filter sensitive data if no access
      if (item.sensitive && !user.dataAccess[DataResourceType.SENSITIVE]) {
        return false;
      }

      // Filter compliance data if no access
      if (item.compliance && !user.dataAccess[DataResourceType.COMPLIANCE]) {
        return false;
      }

      return true;
    });
  }

  /**
   * Sanitize sensitive fields from report data
   */
  static sanitizeReportData(user: ReportUserContext, data: any[]): any[] {
    const canAccessSensitive = user.dataAccess[DataResourceType.SENSITIVE];

    if (canAccessSensitive) {
      return data; // Return as-is if user has sensitive data access
    }

    // List of sensitive fields to mask or remove
    const sensitiveFields = [
      'password', 'secret', 'key', 'token', 'credential',
      'privateKey', 'certificate', 'connectionString',
      'internalIp', 'privateIp', 'sensitiveConfig'
    ];

    return data.map(item => {
      const sanitized = { ...item };

      for (const field of sensitiveFields) {
        if (sanitized[field]) {
          sanitized[field] = '***REDACTED***';
        }
      }

      return sanitized;
    });
  }
}

export default ReportAuthorizationService;