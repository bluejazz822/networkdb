import { QueryInterface, DataTypes, Sequelize } from 'sequelize';

/**
 * Common column definitions for network CMDB tables
 */
export const CommonColumns = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
};

/**
 * Common indexes for network CMDB tables
 */
export const CommonIndexes = {
  createdAt: {
    fields: ['createdAt']
  },
  updatedAt: {
    fields: ['updatedAt']
  },
  deletedAt: {
    fields: ['deletedAt']
  }
};

/**
 * Helper class for database migrations
 */
export class MigrationHelper {
  private queryInterface: QueryInterface;

  constructor(queryInterface: QueryInterface) {
    this.queryInterface = queryInterface;
  }

  /**
   * Create a table with common columns and indexes
   */
  async createTableWithCommonFields(
    tableName: string,
    tableDefinition: any,
    options: any = {}
  ): Promise<void> {
    const finalDefinition = {
      ...tableDefinition,
      ...CommonColumns
    };

    const tableOptions = {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
      ...options
    };

    await this.queryInterface.createTable(tableName, finalDefinition, tableOptions);

    // Add common indexes
    await this.addCommonIndexes(tableName);
  }

  /**
   * Add common indexes to a table
   */
  async addCommonIndexes(tableName: string): Promise<void> {
    const indexes = [
      { name: `idx_${tableName}_created_at`, fields: ['createdAt'] },
      { name: `idx_${tableName}_updated_at`, fields: ['updatedAt'] },
      { name: `idx_${tableName}_deleted_at`, fields: ['deletedAt'] }
    ];

    for (const index of indexes) {
      await this.queryInterface.addIndex(tableName, {
        fields: index.fields,
        name: index.name
      });
    }
  }

  /**
   * Add foreign key constraint
   */
  async addForeignKey(
    tableName: string,
    columnName: string,
    referencedTable: string,
    referencedColumn: string = 'id',
    options: any = {}
  ): Promise<void> {
    const constraintName = `fk_${tableName}_${columnName}`;
    
    await this.queryInterface.addConstraint(tableName, {
      fields: [columnName],
      type: 'foreign key',
      name: constraintName,
      references: {
        table: referencedTable,
        field: referencedColumn
      },
      onUpdate: options.onUpdate || 'CASCADE',
      onDelete: options.onDelete || 'SET NULL'
    });
  }

  /**
   * Remove foreign key constraint
   */
  async removeForeignKey(
    tableName: string,
    columnName: string
  ): Promise<void> {
    const constraintName = `fk_${tableName}_${columnName}`;
    
    await this.queryInterface.removeConstraint(tableName, constraintName);
  }

  /**
   * Add a column with proper options
   */
  async addColumn(
    tableName: string,
    columnName: string,
    columnDefinition: any
  ): Promise<void> {
    await this.queryInterface.addColumn(tableName, columnName, columnDefinition);
  }

  /**
   * Remove a column
   */
  async removeColumn(
    tableName: string,
    columnName: string
  ): Promise<void> {
    await this.queryInterface.removeColumn(tableName, columnName);
  }

  /**
   * Create an index
   */
  async createIndex(
    tableName: string,
    fields: string | string[],
    options: any = {}
  ): Promise<void> {
    const indexName = options.name || `idx_${tableName}_${Array.isArray(fields) ? fields.join('_') : fields}`;
    
    await this.queryInterface.addIndex(tableName, {
      fields: Array.isArray(fields) ? fields : [fields],
      name: indexName,
      ...options
    });
  }

  /**
   * Remove an index
   */
  async removeIndex(
    tableName: string,
    indexName: string
  ): Promise<void> {
    await this.queryInterface.removeIndex(tableName, indexName);
  }

  /**
   * Execute raw SQL query
   */
  async executeRaw(sql: string, replacements: any = {}): Promise<any> {
    return await this.queryInterface.sequelize.query(sql, {
      type: 'RAW',
      replacements
    });
  }

  /**
   * Check if table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.queryInterface.describeTable(tableName);
      return Object.keys(result).length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if column exists in table
   */
  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const tableDescription = await this.queryInterface.describeTable(tableName);
      return columnName in tableDescription;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create enum type (for MySQL, this creates a table for lookups)
   */
  async createEnumTable(
    enumName: string,
    values: Array<{ key: string; value: string; description?: string }>
  ): Promise<void> {
    const tableName = `enum_${enumName}`;
    
    await this.createTableWithCommonFields(tableName, {
      key: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      value: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    });

    // Insert enum values
    if (values.length > 0) {
      const enumValues = values.map(item => ({
        id: DataTypes.UUIDV4,
        key: item.key,
        value: item.value,
        description: item.description || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await this.queryInterface.bulkInsert(tableName, enumValues);
    }
  }

  /**
   * Remove enum table
   */
  async removeEnumTable(enumName: string): Promise<void> {
    const tableName = `enum_${enumName}`;
    await this.queryInterface.dropTable(tableName);
  }
}

/**
 * Helper function to create migration helper instance
 */
export function createMigrationHelper(queryInterface: QueryInterface): MigrationHelper {
  return new MigrationHelper(queryInterface);
}

/**
 * Common network resource status enum values
 */
export const NetworkResourceStatuses = [
  { key: 'ACTIVE', value: 'Active', description: 'Resource is active and operational' },
  { key: 'INACTIVE', value: 'Inactive', description: 'Resource is inactive but available' },
  { key: 'PENDING', value: 'Pending', description: 'Resource is being provisioned' },
  { key: 'FAILED', value: 'Failed', description: 'Resource provisioning failed' },
  { key: 'DELETING', value: 'Deleting', description: 'Resource is being deleted' },
  { key: 'DELETED', value: 'Deleted', description: 'Resource has been deleted' }
];

/**
 * Common AWS region enum values
 */
export const AwsRegions = [
  { key: 'US_EAST_1', value: 'us-east-1', description: 'US East (N. Virginia)' },
  { key: 'US_EAST_2', value: 'us-east-2', description: 'US East (Ohio)' },
  { key: 'US_WEST_1', value: 'us-west-1', description: 'US West (N. California)' },
  { key: 'US_WEST_2', value: 'us-west-2', description: 'US West (Oregon)' },
  { key: 'EU_WEST_1', value: 'eu-west-1', description: 'Europe (Ireland)' },
  { key: 'EU_WEST_2', value: 'eu-west-2', description: 'Europe (London)' },
  { key: 'EU_CENTRAL_1', value: 'eu-central-1', description: 'Europe (Frankfurt)' },
  { key: 'AP_SOUTHEAST_1', value: 'ap-southeast-1', description: 'Asia Pacific (Singapore)' },
  { key: 'AP_SOUTHEAST_2', value: 'ap-southeast-2', description: 'Asia Pacific (Sydney)' },
  { key: 'AP_NORTHEAST_1', value: 'ap-northeast-1', description: 'Asia Pacific (Tokyo)' }
];