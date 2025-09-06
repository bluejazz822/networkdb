'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SavedQueries', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Human-readable name for the saved query'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional description of what the query does'
      },
      query: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'The search query as a JSON object'
      },
      userId: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'ID of the user who created this saved query'
      },
      isPublic: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this query is visible to other users'
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: JSON.stringify([]),
        comment: 'Tags for categorizing saved queries'
      },
      resourceType: {
        type: Sequelize.ENUM('vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all'),
        allowNull: false,
        comment: 'The type of resource this query searches'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the saved query was created'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment: 'When the saved query was last modified'
      },
      lastUsedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the saved query was last executed'
      },
      useCount: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of times this query has been executed'
      }
    }, {
      comment: 'Stores saved search queries for users'
    });

    // Create indexes
    await queryInterface.addIndex('SavedQueries', ['userId'], {
      name: 'idx_saved_queries_user_id',
      comment: 'Index for finding queries by user'
    });

    await queryInterface.addIndex('SavedQueries', ['userId', 'resourceType'], {
      name: 'idx_saved_queries_user_resource',
      comment: 'Composite index for user queries by resource type'
    });

    await queryInterface.addIndex('SavedQueries', ['isPublic', 'resourceType'], {
      name: 'idx_saved_queries_public_resource',
      comment: 'Index for finding public queries by resource type'
    });

    await queryInterface.addIndex('SavedQueries', ['lastUsedAt'], {
      name: 'idx_saved_queries_last_used',
      comment: 'Index for finding recently used queries'
    });

    await queryInterface.addIndex('SavedQueries', ['useCount'], {
      name: 'idx_saved_queries_use_count',
      comment: 'Index for finding popular queries'
    });

    await queryInterface.addIndex('SavedQueries', ['name'], {
      name: 'idx_saved_queries_name',
      comment: 'Index for searching queries by name'
    });

    // Add unique constraint for user + name combination
    await queryInterface.addIndex('SavedQueries', ['userId', 'name'], {
      name: 'idx_saved_queries_user_name_unique',
      unique: true,
      comment: 'Ensure query names are unique per user'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop indexes first
    await queryInterface.removeIndex('SavedQueries', 'idx_saved_queries_user_name_unique');
    await queryInterface.removeIndex('SavedQueries', 'idx_saved_queries_name');
    await queryInterface.removeIndex('SavedQueries', 'idx_saved_queries_use_count');
    await queryInterface.removeIndex('SavedQueries', 'idx_saved_queries_last_used');
    await queryInterface.removeIndex('SavedQueries', 'idx_saved_queries_public_resource');
    await queryInterface.removeIndex('SavedQueries', 'idx_saved_queries_user_resource');
    await queryInterface.removeIndex('SavedQueries', 'idx_saved_queries_user_id');

    // Drop table
    await queryInterface.dropTable('SavedQueries');
  }
};