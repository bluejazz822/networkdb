'use strict';

const { createMigrationHelper } = require('../../dist/utils/migration-helper');
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add report-specific permissions to the permissions table
    const reportPermissions = [
      // Report viewing permissions
      { name: 'report:read', displayName: 'View Reports', description: 'View and access reports and dashboards', resource: 'report', action: 'read' },
      { name: 'report:create', displayName: 'Create Reports', description: 'Create new reports and queries', resource: 'report', action: 'create' },
      { name: 'report:modify', displayName: 'Modify Reports', description: 'Edit existing reports and templates', resource: 'report', action: 'modify' },
      { name: 'report:delete', displayName: 'Delete Reports', description: 'Delete reports and templates', resource: 'report', action: 'delete' },
      { name: 'report:manage', displayName: 'Manage Reports', description: 'Full report management including system templates', resource: 'report', action: 'manage' },

      // Report export permissions
      { name: 'report:export', displayName: 'Export Reports', description: 'Export reports in various formats', resource: 'report', action: 'export' },
      { name: 'report:export_pdf', displayName: 'Export PDF', description: 'Export reports as PDF files', resource: 'report', action: 'export_pdf' },
      { name: 'report:export_excel', displayName: 'Export Excel', description: 'Export reports as Excel files', resource: 'report', action: 'export_excel' },
      { name: 'report:export_csv', displayName: 'Export CSV', description: 'Export reports as CSV files', resource: 'report', action: 'export_csv' },

      // Report scheduling permissions
      { name: 'report:schedule', displayName: 'Schedule Reports', description: 'Create and manage scheduled reports', resource: 'report', action: 'schedule' },
      { name: 'report:schedule_manage', displayName: 'Manage Scheduled Reports', description: 'Full control over report scheduling', resource: 'report', action: 'schedule_manage' },

      // Report sharing permissions
      { name: 'report:share', displayName: 'Share Reports', description: 'Create shareable links for reports', resource: 'report', action: 'share' },
      { name: 'report:share_public', displayName: 'Public Share', description: 'Share reports publicly without authentication', resource: 'report', action: 'share_public' },

      // Data access permissions
      { name: 'data:vpc', displayName: 'VPC Data Access', description: 'Access VPC data in reports', resource: 'data', action: 'vpc' },
      { name: 'data:subnet', displayName: 'Subnet Data Access', description: 'Access subnet data in reports', resource: 'data', action: 'subnet' },
      { name: 'data:transit_gateway', displayName: 'Transit Gateway Data Access', description: 'Access transit gateway data in reports', resource: 'data', action: 'transit_gateway' },
      { name: 'data:customer_gateway', displayName: 'Customer Gateway Data Access', description: 'Access customer gateway data in reports', resource: 'data', action: 'customer_gateway' },
      { name: 'data:vpc_endpoint', displayName: 'VPC Endpoint Data Access', description: 'Access VPC endpoint data in reports', resource: 'data', action: 'vpc_endpoint' },
      { name: 'data:sensitive', displayName: 'Sensitive Data Access', description: 'Access sensitive network configuration data', resource: 'data', action: 'sensitive' },
      { name: 'data:compliance', displayName: 'Compliance Data Access', description: 'Access compliance and audit data', resource: 'data', action: 'compliance' },

      // Advanced report features
      { name: 'report:template_create', displayName: 'Create Templates', description: 'Create custom report templates', resource: 'report', action: 'template_create' },
      { name: 'report:template_manage', displayName: 'Manage Templates', description: 'Manage system and custom templates', resource: 'report', action: 'template_manage' },
      { name: 'report:analytics', displayName: 'Report Analytics', description: 'View report usage analytics and metrics', resource: 'report', action: 'analytics' },
      { name: 'report:audit', displayName: 'Report Audit', description: 'View report audit logs and access history', resource: 'report', action: 'audit' }
    ];

    const permissionsToInsert = reportPermissions.map((perm, index) => ({
      id: `c${(index + 1).toString().padStart(7, '0')}-0000-4000-8000-000000000000`,
      ...perm,
      isSystem: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await queryInterface.bulkInsert('permissions', permissionsToInsert);

    // Create report audit log table
    const helper = createMigrationHelper(queryInterface);

    await helper.createTableWithCommonFields('report_audit_logs', {
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
      }
    }, {
      comment: 'Audit log for all report-related actions and access'
    });

    // Create report access controls table
    await helper.createTableWithCommonFields('report_access_controls', {
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'User ID for access control'
      },
      resourceType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Type of resource (vpc, subnet, etc.)'
      },
      resourceId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Specific resource ID (null = all resources of type)'
      },
      accessLevel: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'Access level (read, write, admin)'
      },
      filters: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Additional data filters for this user'
      },
      grantedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User who granted this access'
      },
      grantedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When access was granted'
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When access expires (null = never)'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether access is currently active'
      }
    }, {
      comment: 'Row-level access controls for report data'
    });

    // Create report sharing table
    await helper.createTableWithCommonFields('report_shares', {
      reportId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID of the shared report'
      },
      shareToken: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
        comment: 'Unique share token'
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'User who created the share'
      },
      accessType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'view',
        comment: 'Type of access granted (view, download)'
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Optional password protection (hashed)'
      },
      maxViews: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Maximum number of views (null = unlimited)'
      },
      currentViews: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Current number of views'
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When share expires (null = never)'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether share is active'
      },
      lastAccessedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When share was last accessed'
      },
      lastAccessedBy: {
        type: DataTypes.INET,
        allowNull: true,
        comment: 'IP address of last access'
      }
    }, {
      comment: 'Shared report access tokens and metadata'
    });

    // Add indexes for audit logs
    await helper.createIndex('report_audit_logs', 'userId', {
      name: 'idx_report_audit_logs_user_id'
    });

    await helper.createIndex('report_audit_logs', 'action', {
      name: 'idx_report_audit_logs_action'
    });

    await helper.createIndex('report_audit_logs', 'resource', {
      name: 'idx_report_audit_logs_resource'
    });

    await helper.createIndex('report_audit_logs', ['resource', 'resourceId'], {
      name: 'idx_report_audit_logs_resource_id'
    });

    await helper.createIndex('report_audit_logs', 'createdAt', {
      name: 'idx_report_audit_logs_created_at'
    });

    await helper.createIndex('report_audit_logs', 'status', {
      name: 'idx_report_audit_logs_status'
    });

    // Add indexes for access controls
    await helper.createIndex('report_access_controls', 'userId', {
      name: 'idx_report_access_controls_user_id'
    });

    await helper.createIndex('report_access_controls', 'resourceType', {
      name: 'idx_report_access_controls_resource_type'
    });

    await helper.createIndex('report_access_controls', ['userId', 'resourceType'], {
      name: 'idx_report_access_controls_user_resource'
    });

    await helper.createIndex('report_access_controls', ['isActive', 'expiresAt'], {
      name: 'idx_report_access_controls_active_not_expired'
    });

    // Add indexes for sharing
    await helper.createIndex('report_shares', 'shareToken', {
      unique: true,
      name: 'idx_report_shares_token_unique'
    });

    await helper.createIndex('report_shares', 'reportId', {
      name: 'idx_report_shares_report_id'
    });

    await helper.createIndex('report_shares', 'createdBy', {
      name: 'idx_report_shares_created_by'
    });

    await helper.createIndex('report_shares', ['isActive', 'expiresAt'], {
      name: 'idx_report_shares_active_not_expired'
    });

    // Add foreign key constraints
    await helper.addForeignKey('report_audit_logs', 'userId', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await helper.addForeignKey('report_access_controls', 'userId', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await helper.addForeignKey('report_access_controls', 'grantedBy', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await helper.addForeignKey('report_shares', 'createdBy', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Add check constraints
    await queryInterface.addConstraint('report_audit_logs', {
      type: 'check',
      fields: ['status'],
      name: 'chk_report_audit_logs_status',
      where: {
        status: {
          [Sequelize.Op.in]: ['success', 'failed', 'denied']
        }
      }
    });

    await queryInterface.addConstraint('report_access_controls', {
      type: 'check',
      fields: ['accessLevel'],
      name: 'chk_report_access_controls_level',
      where: {
        accessLevel: {
          [Sequelize.Op.in]: ['read', 'write', 'admin']
        }
      }
    });

    await queryInterface.addConstraint('report_shares', {
      type: 'check',
      fields: ['accessType'],
      name: 'chk_report_shares_access_type',
      where: {
        accessType: {
          [Sequelize.Op.in]: ['view', 'download']
        }
      }
    });

    await queryInterface.addConstraint('report_shares', {
      type: 'check',
      fields: ['maxViews'],
      name: 'chk_report_shares_max_views',
      where: {
        maxViews: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('report_shares', {
      type: 'check',
      fields: ['currentViews'],
      name: 'chk_report_shares_current_views',
      where: {
        currentViews: {
          [Sequelize.Op.gte]: 0
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraints first
    const foreignKeysToRemove = [
      { table: 'report_audit_logs', constraint: 'fk_report_audit_logs_userId' },
      { table: 'report_access_controls', constraint: 'fk_report_access_controls_userId' },
      { table: 'report_access_controls', constraint: 'fk_report_access_controls_grantedBy' },
      { table: 'report_shares', constraint: 'fk_report_shares_createdBy' }
    ];

    for (const fk of foreignKeysToRemove) {
      try {
        await queryInterface.removeConstraint(fk.table, fk.constraint);
      } catch (error) {
        console.warn(`Constraint ${fk.constraint} not found, skipping removal`);
      }
    }

    // Remove check constraints
    const checkConstraints = [
      { table: 'report_audit_logs', constraint: 'chk_report_audit_logs_status' },
      { table: 'report_access_controls', constraint: 'chk_report_access_controls_level' },
      { table: 'report_shares', constraint: 'chk_report_shares_access_type' },
      { table: 'report_shares', constraint: 'chk_report_shares_max_views' },
      { table: 'report_shares', constraint: 'chk_report_shares_current_views' }
    ];

    for (const check of checkConstraints) {
      try {
        await queryInterface.removeConstraint(check.table, check.constraint);
      } catch (error) {
        console.warn(`Check constraint ${check.constraint} not found, skipping removal`);
      }
    }

    // Drop tables in reverse order
    await queryInterface.dropTable('report_shares');
    await queryInterface.dropTable('report_access_controls');
    await queryInterface.dropTable('report_audit_logs');

    // Remove report permissions (use name to identify them)
    await queryInterface.bulkDelete('permissions', {
      resource: {
        [Sequelize.Op.in]: ['report', 'data']
      },
      name: {
        [Sequelize.Op.like]: 'report:%'
      }
    });

    await queryInterface.bulkDelete('permissions', {
      resource: 'data',
      name: {
        [Sequelize.Op.like]: 'data:%'
      }
    });
  }
};