/**
 * Test Helpers and Utilities
 * Comprehensive utilities for testing the Cloud Network CMDB reporting system
 */

import { Sequelize, DataTypes } from 'sequelize';
import {
  ReportDefinition,
  ReportQuery,
  ReportFilter,
  ExportFormat,
  ReportExportOptions,
  FilterOperator,
  AggregationType
} from '../../src/types/reports';
import { ResourceType } from '../../src/types/search';

// ===================== DATABASE TEST UTILITIES =====================

/**
 * Create in-memory test database
 */
export function createTestDatabase(): Sequelize {
  const sequelize = new Sequelize('sqlite::memory:', {
    dialect: 'sqlite',
    logging: false,
    pool: {
      max: 1,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });

  return sequelize;
}

/**
 * Setup test models
 */
export async function setupTestModels(sequelize: Sequelize) {
  // VPC Model
  const Vpc = sequelize.define('Vpc', {
    vpc_id: { type: DataTypes.STRING, primaryKey: true },
    cidr_block: DataTypes.STRING,
    state: DataTypes.STRING,
    region: DataTypes.STRING,
    account_id: DataTypes.STRING,
    provider: DataTypes.STRING,
    name: DataTypes.STRING,
    is_default: DataTypes.BOOLEAN,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE
  }, {
    tableName: 'vpcs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Transit Gateway Model
  const TransitGateway = sequelize.define('TransitGateway', {
    transit_gateway_id: { type: DataTypes.STRING, primaryKey: true },
    state: DataTypes.STRING,
    region: DataTypes.STRING,
    account_id: DataTypes.STRING,
    provider: DataTypes.STRING,
    description: DataTypes.STRING,
    amazon_side_asn: DataTypes.INTEGER,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE
  }, {
    tableName: 'transit_gateways',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Customer Gateway Model
  const CustomerGateway = sequelize.define('CustomerGateway', {
    customer_gateway_id: { type: DataTypes.STRING, primaryKey: true },
    state: DataTypes.STRING,
    type: DataTypes.STRING,
    ip_address: DataTypes.STRING,
    bgp_asn: DataTypes.INTEGER,
    region: DataTypes.STRING,
    account_id: DataTypes.STRING,
    provider: DataTypes.STRING,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE
  }, {
    tableName: 'customer_gateways',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // VPC Endpoint Model
  const VpcEndpoint = sequelize.define('VpcEndpoint', {
    vpc_endpoint_id: { type: DataTypes.STRING, primaryKey: true },
    vpc_id: DataTypes.STRING,
    service_name: DataTypes.STRING,
    state: DataTypes.STRING,
    region: DataTypes.STRING,
    account_id: DataTypes.STRING,
    provider: DataTypes.STRING,
    endpoint_type: DataTypes.STRING,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE
  }, {
    tableName: 'vpc_endpoints',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  await sequelize.sync({ force: true });

  return { Vpc, TransitGateway, CustomerGateway, VpcEndpoint };
}

// ===================== TEST DATA GENERATORS =====================

/**
 * Generate mock VPC data
 */
export function generateMockVpcs(count: number = 10): any[] {
  const vpcs = [];
  for (let i = 1; i <= count; i++) {
    vpcs.push({
      vpc_id: `vpc-${i.toString().padStart(6, '0')}`,
      cidr_block: `10.${i}.0.0/16`,
      state: i % 5 === 0 ? 'pending' : 'available',
      region: i % 3 === 0 ? 'us-east-1' : i % 3 === 1 ? 'us-west-2' : 'eu-west-1',
      account_id: `12345678901${i % 10}`,
      provider: i % 4 === 0 ? 'azure' : i % 4 === 1 ? 'gcp' : 'aws',
      name: `test-vpc-${i}`,
      is_default: i === 1,
      created_at: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000),
      updated_at: new Date(Date.now() - (count - i) * 12 * 60 * 60 * 1000)
    });
  }
  return vpcs;
}

/**
 * Generate mock Transit Gateway data
 */
export function generateMockTransitGateways(count: number = 5): any[] {
  const tgws = [];
  for (let i = 1; i <= count; i++) {
    tgws.push({
      transit_gateway_id: `tgw-${i.toString().padStart(6, '0')}`,
      state: i % 4 === 0 ? 'pending' : 'available',
      region: i % 2 === 0 ? 'us-east-1' : 'us-west-2',
      account_id: `12345678901${i % 10}`,
      provider: 'aws',
      description: `Test Transit Gateway ${i}`,
      amazon_side_asn: 64512 + i,
      created_at: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000),
      updated_at: new Date(Date.now() - (count - i) * 12 * 60 * 60 * 1000)
    });
  }
  return tgws;
}

/**
 * Generate mock Customer Gateway data
 */
export function generateMockCustomerGateways(count: number = 3): any[] {
  const cgws = [];
  for (let i = 1; i <= count; i++) {
    cgws.push({
      customer_gateway_id: `cgw-${i.toString().padStart(6, '0')}`,
      state: i % 3 === 0 ? 'pending' : 'available',
      type: 'ipsec.1',
      ip_address: `203.0.113.${i}`,
      bgp_asn: 65000 + i,
      region: i % 2 === 0 ? 'us-east-1' : 'us-west-2',
      account_id: `12345678901${i % 10}`,
      provider: 'aws',
      created_at: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000),
      updated_at: new Date(Date.now() - (count - i) * 12 * 60 * 60 * 1000)
    });
  }
  return cgws;
}

/**
 * Generate mock VPC Endpoint data
 */
export function generateMockVpcEndpoints(count: number = 8): any[] {
  const endpoints = [];
  const services = ['s3', 'ec2', 'dynamodb', 'ssm', 'secretsmanager'];

  for (let i = 1; i <= count; i++) {
    endpoints.push({
      vpc_endpoint_id: `vpce-${i.toString().padStart(6, '0')}`,
      vpc_id: `vpc-${Math.ceil(i / 2).toString().padStart(6, '0')}`,
      service_name: `com.amazonaws.us-east-1.${services[i % services.length]}`,
      state: i % 6 === 0 ? 'pending' : 'available',
      region: i % 2 === 0 ? 'us-east-1' : 'us-west-2',
      account_id: `12345678901${i % 10}`,
      provider: 'aws',
      endpoint_type: i % 3 === 0 ? 'Interface' : 'Gateway',
      created_at: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000),
      updated_at: new Date(Date.now() - (count - i) * 12 * 60 * 60 * 1000)
    });
  }
  return endpoints;
}

/**
 * Generate large dataset for performance testing
 */
export function generateLargeDataset(resourceType: ResourceType, count: number = 3000): any[] {
  switch (resourceType) {
    case 'vpc':
      return generateMockVpcs(count);
    case 'transitGateway':
      return generateMockTransitGateways(count);
    case 'customerGateway':
      return generateMockCustomerGateways(count);
    case 'vpcEndpoint':
      return generateMockVpcEndpoints(count);
    default:
      return generateMockVpcs(count);
  }
}

// ===================== REPORT TEST UTILITIES =====================

/**
 * Create sample report query
 */
export function createSampleReportQuery(overrides: Partial<ReportQuery> = {}): ReportQuery {
  return {
    resourceTypes: ['vpc'],
    fields: ['vpc_id', 'cidr_block', 'state', 'region'],
    filters: [],
    groupBy: [],
    orderBy: [{ field: 'created_at', direction: 'DESC' }],
    limit: 100,
    ...overrides
  };
}

/**
 * Create sample report filters
 */
export function createSampleFilters(): ReportFilter[] {
  return [
    {
      field: 'state',
      operator: 'equals' as FilterOperator,
      value: 'available'
    },
    {
      field: 'region',
      operator: 'in' as FilterOperator,
      values: ['us-east-1', 'us-west-2']
    },
    {
      field: 'cidr_block',
      operator: 'exists' as FilterOperator
    }
  ];
}

/**
 * Create sample export options
 */
export function createSampleExportOptions(format: ExportFormat): ReportExportOptions {
  return {
    format,
    includeMetadata: true,
    compression: format === 'csv' ? 'gzip' : undefined,
    customFields: format === 'excel' ? ['vpc_id', 'cidr_block', 'state'] : undefined
  };
}

// ===================== ASSERTION HELPERS =====================

/**
 * Assert API response structure
 */
export function assertApiResponse(response: any, shouldSucceed: boolean = true) {
  expect(response).toHaveProperty('success');
  expect(response.success).toBe(shouldSucceed);

  if (shouldSucceed) {
    expect(response).toHaveProperty('data');
  } else {
    expect(response).toHaveProperty('errors');
    expect(Array.isArray(response.errors)).toBe(true);
  }
}

/**
 * Assert report data structure
 */
export function assertReportData(data: any[], expectedFields: string[]) {
  expect(Array.isArray(data)).toBe(true);
  if (data.length > 0) {
    expectedFields.forEach(field => {
      expect(data[0]).toHaveProperty(field);
    });
  }
}

/**
 * Assert export file properties
 */
export function assertExportFile(result: any) {
  expect(result).toHaveProperty('filePath');
  expect(result).toHaveProperty('fileName');
  expect(result).toHaveProperty('size');
  expect(typeof result.size).toBe('number');
  expect(result.size).toBeGreaterThan(0);
}

/**
 * Assert performance metrics
 */
export function assertPerformanceMetrics(executionTime: number, maxTime: number = 5000) {
  expect(typeof executionTime).toBe('number');
  expect(executionTime).toBeGreaterThan(0);
  expect(executionTime).toBeLessThan(maxTime);
}

// ===================== MOCK UTILITIES =====================

/**
 * Mock Sequelize instance
 */
export function createMockSequelize() {
  return {
    query: jest.fn(),
    col: jest.fn((field: string) => field),
    fn: jest.fn((func: string, col: any) => `${func}(${col})`),
    literal: jest.fn((value: string) => value)
  };
}

/**
 * Mock model instances
 */
export function createMockModels() {
  const mockModel = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    bulkCreate: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  };

  return {
    vpc: mockModel,
    transitGateway: { ...mockModel },
    customerGateway: { ...mockModel },
    vpcEndpoint: { ...mockModel }
  };
}

// ===================== ERROR TESTING UTILITIES =====================

/**
 * Create database error for testing
 */
export function createDatabaseError(message: string = 'Database connection failed') {
  const error = new Error(message);
  (error as any).name = 'SequelizeDatabaseError';
  return error;
}

/**
 * Create validation error for testing
 */
export function createValidationError(field: string, message: string = 'Validation failed') {
  const error = new Error(message);
  (error as any).name = 'SequelizeValidationError';
  (error as any).errors = [{ path: field, message }];
  return error;
}

// ===================== ASYNC TESTING UTILITIES =====================

/**
 * Wait for specified time (useful for testing async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries) break;

      const delay = baseDelay * Math.pow(2, i);
      await wait(delay);
    }
  }

  throw lastError!;
}

// ===================== CLEANUP UTILITIES =====================

/**
 * Cleanup test database
 */
export async function cleanupTestDatabase(sequelize: Sequelize) {
  try {
    await sequelize.close();
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  }
}

/**
 * Cleanup test files
 */
export function cleanupTestFiles(filePaths: string[]) {
  const fs = require('fs');
  filePaths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  });
}