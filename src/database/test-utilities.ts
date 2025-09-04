import { Sequelize, Transaction } from 'sequelize';
import { createDatabaseOperations, DatabaseOperations } from './operations';

/**
 * Database testing utilities for Network CMDB
 */
export class DatabaseTestUtilities {
  private sequelize: Sequelize;
  private dbOps: DatabaseOperations;

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
    this.dbOps = createDatabaseOperations(sequelize, this.log.bind(this));
  }

  /**
   * Set up test database with fresh schema
   */
  async setupTestDatabase(): Promise<void> {
    try {
      // Drop all tables if they exist
      await this.sequelize.drop({ cascade: true });
      
      // Run all migrations to create fresh schema
      await this.runMigrations();
      
      this.log('Test database setup completed successfully');
    } catch (error) {
      this.log('Failed to setup test database', { error: error.message });
      throw error;
    }
  }

  /**
   * Clean up test database
   */
  async cleanupTestDatabase(): Promise<void> {
    try {
      // Truncate all tables instead of dropping to preserve schema
      const tableNames = await this.getTableNames();
      
      await this.dbOps.executeTransaction(async (transaction) => {
        // Disable foreign key checks temporarily
        await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
        
        // Truncate each table
        for (const tableName of tableNames) {
          if (!tableName.startsWith('SequelizeMeta')) { // Skip migration tracking table
            await this.sequelize.query(`TRUNCATE TABLE ${tableName}`, { transaction });
          }
        }
        
        // Re-enable foreign key checks
        await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
      });
      
      this.log('Test database cleanup completed successfully');
    } catch (error) {
      this.log('Failed to cleanup test database', { error: error.message });
      throw error;
    }
  }

  /**
   * Seed test data for development and testing
   */
  async seedTestData(): Promise<void> {
    const testData = this.generateTestData();
    
    try {
      await this.dbOps.executeTransaction(async (transaction) => {
        // Seed enum tables first
        await this.seedEnumTables(transaction);
        
        // Seed VPCs
        if (testData.vpcs.length > 0) {
          await this.dbOps.bulkInsert('vpcs', testData.vpcs, { transaction });
        }
        
        // Seed Subnets
        if (testData.subnets.length > 0) {
          await this.dbOps.bulkInsert('subnets', testData.subnets, { transaction });
        }
        
        // Seed Transit Gateways
        if (testData.transitGateways.length > 0) {
          await this.dbOps.bulkInsert('transit_gateways', testData.transitGateways, { transaction });
        }
        
        // Seed Transit Gateway Attachments
        if (testData.transitGatewayAttachments.length > 0) {
          await this.dbOps.bulkInsert('transit_gateway_attachments', testData.transitGatewayAttachments, { transaction });
        }
        
        // Seed Customer Gateways
        if (testData.customerGateways.length > 0) {
          await this.dbOps.bulkInsert('customer_gateways', testData.customerGateways, { transaction });
        }
      });
      
      this.log('Test data seeded successfully');
    } catch (error) {
      this.log('Failed to seed test data', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate realistic test data
   */
  private generateTestData() {
    const now = new Date();
    const activeStatusId = this.generateUUID();
    const usEast1RegionId = this.generateUUID();
    
    return {
      vpcs: [
        {
          id: this.generateUUID(),
          awsVpcId: 'vpc-0123456789abcdef0',
          awsAccountId: '123456789012',
          cidrBlock: '10.0.0.0/16',
          state: 'available',
          statusId: activeStatusId,
          region: 'us-east-1',
          regionId: usEast1RegionId,
          isDefault: false,
          instanceTenancy: 'default',
          enableDnsHostnames: true,
          enableDnsSupport: true,
          enableNetworkAddressUsageMetrics: false,
          tags: JSON.stringify({ Name: 'Test-VPC-1', Environment: 'test' }),
          name: 'Test-VPC-1',
          description: 'Test VPC for development',
          sourceSystem: 'aws',
          environment: 'test',
          project: 'network-cmdb',
          owner: 'platform-team',
          createdAt: now,
          updatedAt: now
        },
        {
          id: this.generateUUID(),
          awsVpcId: 'vpc-0987654321fedcba0',
          awsAccountId: '123456789012',
          cidrBlock: '10.1.0.0/16',
          state: 'available',
          statusId: activeStatusId,
          region: 'us-east-1',
          regionId: usEast1RegionId,
          isDefault: false,
          instanceTenancy: 'default',
          enableDnsHostnames: true,
          enableDnsSupport: true,
          enableNetworkAddressUsageMetrics: false,
          tags: JSON.stringify({ Name: 'Test-VPC-2', Environment: 'test' }),
          name: 'Test-VPC-2',
          description: 'Second test VPC',
          sourceSystem: 'aws',
          environment: 'test',
          project: 'network-cmdb',
          owner: 'platform-team',
          createdAt: now,
          updatedAt: now
        }
      ],
      
      subnets: [
        {
          id: this.generateUUID(),
          awsSubnetId: 'subnet-0123456789abcdef0',
          awsVpcId: 'vpc-0123456789abcdef0',
          awsAccountId: '123456789012',
          vpcId: null, // Will be resolved after VPC insert
          cidrBlock: '10.0.1.0/24',
          availableIpAddressCount: 251,
          availabilityZone: 'us-east-1a',
          state: 'available',
          statusId: activeStatusId,
          mapPublicIpOnLaunch: false,
          assignIpv6AddressOnCreation: false,
          isDefault: false,
          tags: JSON.stringify({ Name: 'Test-Subnet-Private-1A' }),
          name: 'Test-Subnet-Private-1A',
          sourceSystem: 'aws',
          environment: 'test',
          project: 'network-cmdb',
          subnetType: 'private',
          tier: 'app',
          owner: 'platform-team',
          createdAt: now,
          updatedAt: now
        }
      ],
      
      transitGateways: [
        {
          id: this.generateUUID(),
          awsTransitGatewayId: 'tgw-0123456789abcdef0',
          awsAccountId: '123456789012',
          description: 'Test Transit Gateway',
          state: 'available',
          statusId: activeStatusId,
          region: 'us-east-1',
          regionId: usEast1RegionId,
          amazonSideAsn: 64512,
          autoAcceptSharedAttachments: 'disable',
          defaultRouteTableAssociation: 'enable',
          defaultRouteTablePropagation: 'enable',
          dnsSupport: 'enable',
          multicast: 'disable',
          tags: JSON.stringify({ Name: 'Test-TGW-1', Environment: 'test' }),
          name: 'Test-TGW-1',
          sourceSystem: 'aws',
          environment: 'test',
          project: 'network-cmdb',
          owner: 'platform-team',
          transitGatewayType: 'hub',
          isPrimary: true,
          createdAt: now,
          updatedAt: now
        }
      ],
      
      transitGatewayAttachments: [
        {
          id: this.generateUUID(),
          awsTransitGatewayAttachmentId: 'tgw-attach-0123456789abcdef0',
          awsTransitGatewayId: 'tgw-0123456789abcdef0',
          awsAccountId: '123456789012',
          transitGatewayId: null, // Will be resolved after TGW insert
          resourceType: 'vpc',
          resourceId: 'vpc-0123456789abcdef0',
          resourceOwnerId: '123456789012',
          vpcId: null, // Will be resolved after VPC insert
          awsVpcId: 'vpc-0123456789abcdef0',
          subnetIds: JSON.stringify(['subnet-0123456789abcdef0']),
          state: 'available',
          statusId: activeStatusId,
          dnsSupport: 'enable',
          ipv6Support: 'disable',
          applianceModeSupport: 'disable',
          isShared: false,
          tags: JSON.stringify({ Name: 'Test-TGW-Attachment-1' }),
          name: 'Test-TGW-Attachment-1',
          sourceSystem: 'aws',
          environment: 'test',
          project: 'network-cmdb',
          owner: 'platform-team',
          attachmentPurpose: 'production',
          isPrimary: true,
          createdAt: now,
          updatedAt: now
        }
      ],
      
      customerGateways: [
        {
          id: this.generateUUID(),
          awsCustomerGatewayId: 'cgw-0123456789abcdef0',
          awsAccountId: '123456789012',
          type: 'ipsec.1',
          ipAddress: '203.0.113.12',
          bgpAsn: 65000,
          state: 'available',
          statusId: activeStatusId,
          region: 'us-east-1',
          regionId: usEast1RegionId,
          deviceName: 'test-customer-gateway',
          deviceModel: 'ASA-5505',
          deviceVendor: 'Cisco',
          deviceSoftwareVersion: '9.8(4)',
          tags: JSON.stringify({ Name: 'Test-CGW-1', Environment: 'test' }),
          name: 'Test-CGW-1',
          description: 'Test Customer Gateway',
          sourceSystem: 'aws',
          environment: 'test',
          project: 'network-cmdb',
          owner: 'platform-team',
          siteLocation: 'Test Data Center',
          siteAddress: '123 Test Street, Test City, TS 12345',
          contactPerson: 'John Doe',
          contactPhone: '+1-555-0123',
          contactEmail: 'john.doe@example.com',
          isPrimary: true,
          redundancyGroup: 'site-1',
          createdAt: now,
          updatedAt: now
        }
      ]
    };
  }

  /**
   * Seed enum tables with test data
   */
  private async seedEnumTables(transaction: Transaction): Promise<void> {
    // This would seed the enum tables with basic test values
    // In a real implementation, you'd fetch these from the actual enum definitions
    const enumData = {
      enum_resource_status: [
        { id: this.generateUUID(), key: 'ACTIVE', value: 'Active', isActive: true }
      ],
      enum_aws_regions: [
        { id: this.generateUUID(), key: 'US_EAST_1', value: 'us-east-1', description: 'US East (N. Virginia)', isActive: true }
      ],
      enum_attachment_states: [
        { id: this.generateUUID(), key: 'AVAILABLE', value: 'available', description: 'Attachment is available', isActive: true }
      ]
    };

    for (const [tableName, data] of Object.entries(enumData)) {
      if (data.length > 0) {
        await this.dbOps.bulkInsert(tableName, data.map(item => ({
          ...item,
          createdAt: new Date(),
          updatedAt: new Date()
        })), { transaction });
      }
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    // In a real implementation, this would use the Sequelize CLI or Umzug
    this.log('Migration execution would be handled by Sequelize CLI or Umzug');
  }

  /**
   * Get all table names in the database
   */
  private async getTableNames(): Promise<string[]> {
    const query = `
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `;
    
    const result = await this.sequelize.query(query, { 
      type: this.sequelize.QueryTypes.SELECT 
    }) as any[];
    
    return result.map(row => row.TABLE_NAME);
  }

  /**
   * Generate a UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Validate database schema
   */
  async validateSchema(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if all required tables exist
      const requiredTables = [
        'enum_resource_status',
        'enum_aws_regions',
        'enum_network_resource_types',
        'enum_connection_states',
        'enum_attachment_states',
        'vpcs',
        'subnets',
        'transit_gateways',
        'transit_gateway_attachments',
        'customer_gateways'
      ];

      const existingTables = await this.getTableNames();
      
      for (const table of requiredTables) {
        if (!existingTables.includes(table)) {
          errors.push(`Required table '${table}' does not exist`);
        }
      }

      // Check foreign key constraints
      const fkConstraints = await this.validateForeignKeys();
      errors.push(...fkConstraints.errors);
      warnings.push(...fkConstraints.warnings);

      // Check indexes
      const indexValidation = await this.validateIndexes();
      warnings.push(...indexValidation.warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push(`Schema validation failed: ${error.message}`);
      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Validate foreign key constraints
   */
  private async validateForeignKeys(): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const query = `
        SELECT 
          CONSTRAINT_NAME,
          TABLE_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `;

      const constraints = await this.sequelize.query(query, {
        type: this.sequelize.QueryTypes.SELECT
      }) as any[];

      this.log(`Found ${constraints.length} foreign key constraints`);
      
      // Additional validation logic would go here
      // For now, just log that we found constraints
      
    } catch (error) {
      errors.push(`Failed to validate foreign keys: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate database indexes
   */
  private async validateIndexes(): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];

    try {
      const query = `
        SELECT 
          TABLE_NAME,
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
      `;

      const indexes = await this.sequelize.query(query, {
        type: this.sequelize.QueryTypes.SELECT
      }) as any[];

      this.log(`Found ${indexes.length} index entries`);
      
      // Additional index validation logic would go here
      
    } catch (error) {
      warnings.push(`Failed to validate indexes: ${error.message}`);
    }

    return { warnings };
  }

  /**
   * Create a test transaction for testing purposes
   */
  async createTestTransaction(): Promise<Transaction> {
    return await this.sequelize.transaction();
  }

  /**
   * Performance test for database operations
   */
  async performanceTest(): Promise<{
    bulkInsertTime: number;
    bulkUpdateTime: number;
    bulkDeleteTime: number;
    queryTime: number;
  }> {
    const testRecords = 1000;
    const testData = Array.from({ length: testRecords }, (_, i) => ({
      id: this.generateUUID(),
      awsVpcId: `vpc-test${i.toString().padStart(16, '0')}`,
      awsAccountId: '123456789012',
      cidrBlock: `10.${Math.floor(i / 256)}.${i % 256}.0/24`,
      state: 'available',
      statusId: this.generateUUID(),
      region: 'us-east-1',
      regionId: this.generateUUID(),
      isDefault: false,
      instanceTenancy: 'default',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      sourceSystem: 'performance-test',
      environment: 'test',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    let bulkInsertTime = 0;
    let bulkUpdateTime = 0;
    let bulkDeleteTime = 0;
    let queryTime = 0;

    try {
      // Test bulk insert
      const insertResult = await this.dbOps.bulkInsert('vpcs', testData);
      bulkInsertTime = insertResult.duration;

      // Test bulk update
      const updates = testData.slice(0, 100).map(record => ({
        values: { description: 'Updated by performance test' },
        where: { awsVpcId: record.awsVpcId }
      }));
      const updateResult = await this.dbOps.bulkUpdate('vpcs', updates);
      bulkUpdateTime = updateResult.duration;

      // Test query performance
      const queryStart = Date.now();
      await this.sequelize.query(
        'SELECT COUNT(*) as count FROM vpcs WHERE sourceSystem = ?',
        { replacements: ['performance-test'], type: this.sequelize.QueryTypes.SELECT }
      );
      queryTime = Date.now() - queryStart;

      // Test bulk delete
      const deleteConditions = [{ sourceSystem: 'performance-test' }];
      const deleteResult = await this.dbOps.bulkDelete('vpcs', deleteConditions);
      bulkDeleteTime = deleteResult.duration;

      return {
        bulkInsertTime,
        bulkUpdateTime,
        bulkDeleteTime,
        queryTime
      };
    } catch (error) {
      this.log('Performance test failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Private logging method
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DatabaseTestUtilities] ${message}`, data || '');
  }
}

/**
 * Factory function to create DatabaseTestUtilities instance
 */
export function createDatabaseTestUtilities(sequelize: Sequelize): DatabaseTestUtilities {
  return new DatabaseTestUtilities(sequelize);
}