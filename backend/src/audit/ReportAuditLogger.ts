/**
 * Report Audit Logger
 * Comprehensive audit logging for all report-related operations
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { getDatabase } from '../config/database';
import { ReportUserContext } from '../auth/ReportPermissions';

const sequelize = getDatabase();

/**
 * Audit log entry attributes
 */
export interface AuditLogAttributes {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  status: 'success' | 'failed' | 'denied';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Audit log creation attributes
 */
export interface AuditLogCreationAttributes extends Optional<AuditLogAttributes,
  'id' | 'createdAt' | 'updatedAt'
> {}

/**
 * Audit log model
 */
export class ReportAuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes>
  implements AuditLogAttributes {
  public id!: string;
  public userId?: string;
  public action!: string;
  public resource!: string;
  public resourceId?: string;
  public details?: Record<string, any>;
  public ipAddress?: string;
  public userAgent?: string;
  public sessionId?: string;
  public status!: 'success' | 'failed' | 'denied';
  public errorMessage?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model
ReportAuditLog.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'User who performed the action (null for system actions)'
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Action performed (view, create, modify, delete, export, etc.)'
  },
  resource: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Resource type (report, dashboard, template, etc.)'
  },
  resourceId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'ID of the specific resource'
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional action details and metadata'
  },
  ipAddress: {
    type: DataTypes.INET,
    allowNull: true,
    comment: 'IP address of the user'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'User agent string'
  },
  sessionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Session identifier'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'success',
    comment: 'Action status (success, failed, denied)'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error message if action failed'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  tableName: 'report_audit_logs',
  modelName: 'ReportAuditLog',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['action'] },
    { fields: ['resource'] },
    { fields: ['resource', 'resourceId'] },
    { fields: ['createdAt'] },
    { fields: ['status'] }
  ]
});

/**
 * Audit action types
 */
export enum AuditAction {
  // Report operations
  VIEW_REPORT = 'view_report',
  CREATE_REPORT = 'create_report',
  MODIFY_REPORT = 'modify_report',
  DELETE_REPORT = 'delete_report',
  EXPORT_REPORT = 'export_report',
  DOWNLOAD_EXPORT = 'download_export',

  // Dashboard operations
  VIEW_DASHBOARD = 'view_dashboard',
  MODIFY_DASHBOARD = 'modify_dashboard',

  // Template operations
  VIEW_TEMPLATE = 'view_template',
  CREATE_TEMPLATE = 'create_template',
  MODIFY_TEMPLATE = 'modify_template',
  DELETE_TEMPLATE = 'delete_template',

  // Scheduling operations
  SCHEDULE_REPORT = 'schedule_report',
  MODIFY_SCHEDULE = 'modify_schedule',
  DELETE_SCHEDULE = 'delete_schedule',
  EXECUTE_SCHEDULED = 'execute_scheduled',

  // Sharing operations
  CREATE_SHARE = 'create_share',
  ACCESS_SHARED = 'access_shared',
  DELETE_SHARE = 'delete_share',

  // Data access
  ACCESS_SENSITIVE = 'access_sensitive',
  ACCESS_COMPLIANCE = 'access_compliance',

  // Security events
  PERMISSION_DENIED = 'permission_denied',
  AUTHENTICATION_FAILED = 'authentication_failed',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

/**
 * Audit resource types
 */
export enum AuditResource {
  REPORT = 'report',
  DASHBOARD = 'dashboard',
  TEMPLATE = 'template',
  SCHEDULE = 'schedule',
  SHARE = 'share',
  EXPORT = 'export',
  DATA = 'data'
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: Record<string, any>;
  status?: 'success' | 'failed' | 'denied';
  errorMessage?: string;
}

/**
 * Report Audit Logger Service
 */
export class ReportAuditLogger {
  /**
   * Log an audit event
   */
  static async log(
    user: ReportUserContext | null,
    entry: AuditLogEntry
  ): Promise<void> {
    try {
      await ReportAuditLog.create({
        userId: user?.id,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details,
        ipAddress: user?.ipAddress,
        userAgent: user?.userAgent,
        sessionId: user?.sessionId,
        status: entry.status || 'success',
        errorMessage: entry.errorMessage
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - audit logging should not break main functionality
    }
  }

  /**
   * Log successful report view
   */
  static async logReportView(
    user: ReportUserContext,
    reportId: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.VIEW_REPORT,
      resource: AuditResource.REPORT,
      resourceId: reportId,
      details
    });
  }

  /**
   * Log report creation
   */
  static async logReportCreate(
    user: ReportUserContext,
    reportId: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.CREATE_REPORT,
      resource: AuditResource.REPORT,
      resourceId: reportId,
      details
    });
  }

  /**
   * Log report modification
   */
  static async logReportModify(
    user: ReportUserContext,
    reportId: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.MODIFY_REPORT,
      resource: AuditResource.REPORT,
      resourceId: reportId,
      details
    });
  }

  /**
   * Log report deletion
   */
  static async logReportDelete(
    user: ReportUserContext,
    reportId: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.DELETE_REPORT,
      resource: AuditResource.REPORT,
      resourceId: reportId,
      details
    });
  }

  /**
   * Log report export
   */
  static async logReportExport(
    user: ReportUserContext,
    reportId: string,
    format: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.EXPORT_REPORT,
      resource: AuditResource.EXPORT,
      resourceId: reportId,
      details: {
        format,
        ...details
      }
    });
  }

  /**
   * Log export download
   */
  static async logExportDownload(
    user: ReportUserContext | null,
    fileName: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.DOWNLOAD_EXPORT,
      resource: AuditResource.EXPORT,
      resourceId: fileName,
      details
    });
  }

  /**
   * Log dashboard access
   */
  static async logDashboardView(
    user: ReportUserContext,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.VIEW_DASHBOARD,
      resource: AuditResource.DASHBOARD,
      details
    });
  }

  /**
   * Log permission denied event
   */
  static async logPermissionDenied(
    user: ReportUserContext | null,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.PERMISSION_DENIED,
      resource: resource as AuditResource,
      resourceId,
      details: {
        deniedAction: action,
        ...details
      },
      status: 'denied'
    });
  }

  /**
   * Log authentication failure
   */
  static async logAuthenticationFailed(
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      id: '',
      username: '',
      email: '',
      roles: [],
      permissions: [],
      dataAccess: {},
      ipAddress,
      userAgent
    }, {
      action: AuditAction.AUTHENTICATION_FAILED,
      resource: AuditResource.DATA,
      details,
      status: 'failed'
    });
  }

  /**
   * Log sensitive data access
   */
  static async logSensitiveDataAccess(
    user: ReportUserContext,
    dataType: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.ACCESS_SENSITIVE,
      resource: AuditResource.DATA,
      resourceId: dataType,
      details
    });
  }

  /**
   * Log compliance data access
   */
  static async logComplianceDataAccess(
    user: ReportUserContext,
    dataType: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.ACCESS_COMPLIANCE,
      resource: AuditResource.DATA,
      resourceId: dataType,
      details
    });
  }

  /**
   * Log report sharing
   */
  static async logReportShare(
    user: ReportUserContext,
    reportId: string,
    shareToken: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.CREATE_SHARE,
      resource: AuditResource.SHARE,
      resourceId: shareToken,
      details: {
        reportId,
        ...details
      }
    });
  }

  /**
   * Log shared report access
   */
  static async logSharedReportAccess(
    shareToken: string,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      id: '',
      username: 'anonymous',
      email: '',
      roles: [],
      permissions: [],
      dataAccess: {},
      ipAddress,
      userAgent
    }, {
      action: AuditAction.ACCESS_SHARED,
      resource: AuditResource.SHARE,
      resourceId: shareToken,
      details
    });
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(
    user: ReportUserContext | null,
    activity: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log(user, {
      action: AuditAction.SUSPICIOUS_ACTIVITY,
      resource: AuditResource.DATA,
      details: {
        activity,
        ...details
      },
      status: 'failed'
    });
  }

  /**
   * Get audit logs for a user
   */
  static async getUserAuditLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ReportAuditLog[]> {
    return await ReportAuditLog.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  /**
   * Get audit logs for a resource
   */
  static async getResourceAuditLogs(
    resource: AuditResource,
    resourceId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ReportAuditLog[]> {
    const where: any = { resource };
    if (resourceId) {
      where.resourceId = resourceId;
    }

    return await ReportAuditLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  /**
   * Get security events (failed attempts, permission denials, etc.)
   */
  static async getSecurityEvents(
    limit: number = 100,
    offset: number = 0
  ): Promise<ReportAuditLog[]> {
    return await ReportAuditLog.findAll({
      where: {
        status: ['failed', 'denied']
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  /**
   * Get audit statistics for a time period
   */
  static async getAuditStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    deniedEvents: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; count: number }>;
  }> {
    const logs = await ReportAuditLog.findAll({
      where: {
        createdAt: {
          [sequelize.Op.between]: [startDate, endDate]
        }
      },
      attributes: ['action', 'userId', 'status']
    });

    const totalEvents = logs.length;
    const successfulEvents = logs.filter(log => log.status === 'success').length;
    const failedEvents = logs.filter(log => log.status === 'failed').length;
    const deniedEvents = logs.filter(log => log.status === 'denied').length;

    // Count actions
    const actionCounts = new Map<string, number>();
    const userCounts = new Map<string, number>();

    for (const log of logs) {
      actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
      if (log.userId) {
        userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
      }
    }

    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topUsers = Array.from(userCounts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      deniedEvents,
      topActions,
      topUsers
    };
  }
}

export default ReportAuditLogger;