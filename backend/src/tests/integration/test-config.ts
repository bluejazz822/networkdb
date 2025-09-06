/**
 * Integration Test Configuration
 * Shared configuration and utilities for integration tests
 */

import { Router } from 'express';
import express from 'express';
import { ServiceFactory } from '../../services';

// Test application setup
export function createTestApp() {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Import API routes
  const vpcRoutes = require('../../api/routes/vpc').default;
  const transitGatewayRoutes = require('../../api/routes/transitGateway').default;
  const customerGatewayRoutes = require('../../api/routes/customerGateway').default;
  const vpcEndpointRoutes = require('../../api/routes/vpcEndpoint').default;
  
  // Mount API routes
  app.use('/api/vpcs', vpcRoutes);
  app.use('/api/transit-gateways', transitGatewayRoutes);
  app.use('/api/customer-gateways', customerGatewayRoutes);
  app.use('/api/vpc-endpoints', vpcEndpointRoutes);
  
  return app;
}

// Test data factories
export const TestDataFactory = {
  createVpcData: (overrides: any = {}) => ({
    awsVpcId: 'vpc-1234567890abcdef0',
    region: 'us-east-1',
    cidrBlock: '10.0.0.0/16',
    state: 'available',
    name: 'test-vpc',
    environment: 'test',
    owner: 'test-team',
    awsAccountId: '123456789012',
    tags: { Environment: 'test', Team: 'test-team' },
    ...overrides
  }),

  createTransitGatewayData: (overrides: any = {}) => ({
    awsTransitGatewayId: 'tgw-1234567890abcdef0',
    region: 'us-east-1',
    state: 'available',
    name: 'test-tgw',
    description: 'Test Transit Gateway',
    amazonSideAsn: 64512,
    defaultRouteTableId: 'tgw-rtb-1234567890abcdef0',
    defaultRouteTableAssociation: 'enable',
    defaultRouteTablePropagation: 'enable',
    dnsSupport: 'enable',
    multicast: 'disable',
    environment: 'test',
    owner: 'test-team',
    awsAccountId: '123456789012',
    tags: { Environment: 'test', Team: 'test-team' },
    ...overrides
  }),

  createCustomerGatewayData: (overrides: any = {}) => ({
    awsCustomerGatewayId: 'cgw-1234567890abcdef0',
    region: 'us-east-1',
    state: 'available',
    type: 'ipsec.1',
    name: 'test-cgw',
    ipAddress: '203.0.113.12',
    bgpAsn: 65000,
    deviceName: 'Test Device',
    environment: 'test',
    owner: 'test-team',
    awsAccountId: '123456789012',
    tags: { Environment: 'test', Team: 'test-team' },
    ...overrides
  }),

  createVpcEndpointData: (overrides: any = {}) => ({
    awsVpcEndpointId: 'vpce-1234567890abcdef0',
    vpcId: 'vpc-1234567890abcdef0',
    region: 'us-east-1',
    state: 'available',
    type: 'Gateway',
    serviceName: 'com.amazonaws.us-east-1.s3',
    name: 'test-vpce',
    routeTableIds: ['rtb-1234567890abcdef0'],
    privateDnsEnabled: false,
    requesterManaged: false,
    environment: 'test',
    owner: 'test-team',
    awsAccountId: '123456789012',
    tags: { Environment: 'test', Team: 'test-team' },
    ...overrides
  })
};

// Test utilities
export const TestUtils = {
  // Helper to check API response structure
  expectApiSuccess: (response: any, expectedData?: any) => {
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    if (expectedData) {
      expect(response.data).toMatchObject(expectedData);
    }
  },

  expectApiError: (response: any, expectedStatus?: number) => {
    expect(response.success).toBe(false);
    expect(response.errors).toBeDefined();
    expect(Array.isArray(response.errors)).toBe(true);
  },

  expectPaginatedResponse: (response: any) => {
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data.data).toBeDefined();
    expect(Array.isArray(response.data.data)).toBe(true);
    expect(typeof response.data.totalCount).toBe('number');
    expect(typeof response.data.page).toBe('number');
    expect(typeof response.data.limit).toBe('number');
    expect(typeof response.data.hasNextPage).toBe('boolean');
    expect(typeof response.data.hasPrevPage).toBe('boolean');
  },

  // Generate unique test data
  generateUniqueId: () => Math.random().toString(36).substr(2, 9),
  
  generateUniqueVpcId: () => `vpc-${Math.random().toString(16).substr(2, 17)}`,
  generateUniqueTransitGatewayId: () => `tgw-${Math.random().toString(16).substr(2, 17)}`,
  generateUniqueCustomerGatewayId: () => `cgw-${Math.random().toString(16).substr(2, 17)}`,
  generateUniqueVpcEndpointId: () => `vpce-${Math.random().toString(16).substr(2, 17)}`,
  
  generateUniqueAccountId: () => Math.floor(Math.random() * 900000000000 + 100000000000).toString(),
};

// Mock service responses for testing
export const MockServiceResponses = {
  success: (data: any) => ({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }),

  error: (code: string, message: string) => ({
    success: false,
    errors: [{ code, message }],
    timestamp: new Date().toISOString()
  }),

  paginatedSuccess: (data: any[], totalCount: number, page: number = 1, limit: number = 20) => ({
    success: true,
    data: {
      data,
      totalCount,
      page,
      limit,
      hasNextPage: (page * limit) < totalCount,
      hasPrevPage: page > 1
    },
    timestamp: new Date().toISOString()
  })
};