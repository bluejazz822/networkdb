'use strict';

const { createMigrationHelper } = require('../utils/migration-helper');
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    // Create users table
    await helper.createTableWithCommonFields('users', {
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Unique username for login'
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'User email address (unique)'
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Bcrypt hashed password'
      },
      firstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'User first name'
      },
      lastName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'User last name'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether user account is active'
      },
      isEmailVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether user email has been verified'
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last successful login timestamp'
      },
      passwordResetToken: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Token for password reset (temporary)'
      },
      passwordResetExpires: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Password reset token expiration time'
      },
      emailVerificationToken: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Token for email verification (temporary)'
      },
      emailVerificationExpires: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Email verification token expiration time'
      },
      mfaEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether multi-factor authentication is enabled'
      },
      mfaSecret: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'MFA secret key (encrypted)'
      },
      loginAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of failed login attempts'
      },
      accountLockedUntil: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Account lock expiration time'
      }
    }, {
      comment: 'User accounts for authentication and authorization'
    });

    // Add specific indexes for users table
    await helper.createIndex('users', 'username', {
      unique: true,
      name: 'idx_users_username_unique'
    });

    await helper.createIndex('users', 'email', {
      unique: true,
      name: 'idx_users_email_unique'
    });

    await helper.createIndex('users', ['isActive', 'deletedAt'], {
      name: 'idx_users_active_not_deleted'
    });

    await helper.createIndex('users', 'isEmailVerified', {
      name: 'idx_users_email_verified'
    });

    await helper.createIndex('users', 'lastLoginAt', {
      name: 'idx_users_last_login'
    });

    await helper.createIndex('users', 'passwordResetToken', {
      name: 'idx_users_password_reset_token'
    });

    await helper.createIndex('users', 'emailVerificationToken', {
      name: 'idx_users_email_verification_token'
    });

    await helper.createIndex('users', 'accountLockedUntil', {
      name: 'idx_users_account_locked_until'
    });

    await helper.createIndex('users', ['loginAttempts', 'accountLockedUntil'], {
      name: 'idx_users_login_security'
    });

    // Add check constraints for data integrity
    await queryInterface.addConstraint('users', {
      type: 'check',
      fields: ['loginAttempts'],
      name: 'chk_users_login_attempts_positive',
      where: {
        loginAttempts: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    // Add comment to table
    await queryInterface.sequelize.query(`
      ALTER TABLE users COMMENT = 'User accounts for authentication and authorization in Network CMDB'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    const indexesToRemove = [
      'idx_users_username_unique',
      'idx_users_email_unique', 
      'idx_users_active_not_deleted',
      'idx_users_email_verified',
      'idx_users_last_login',
      'idx_users_password_reset_token',
      'idx_users_email_verification_token',
      'idx_users_account_locked_until',
      'idx_users_login_security'
    ];

    for (const indexName of indexesToRemove) {
      try {
        await queryInterface.removeIndex('users', indexName);
      } catch (error) {
        // Index might not exist, continue
        console.warn(`Index ${indexName} not found, skipping removal`);
      }
    }

    // Remove check constraints
    try {
      await queryInterface.removeConstraint('users', 'chk_users_login_attempts_positive');
    } catch (error) {
      // Constraint might not exist, continue
      console.warn('Check constraint chk_users_login_attempts_positive not found, skipping removal');
    }

    // Drop the table
    await queryInterface.dropTable('users');
  }
};