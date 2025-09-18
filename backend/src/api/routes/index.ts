/**
 * API Routes Index
 * Central routing configuration for all API endpoints
 */

import { Router } from 'express';
import vpcRoutes from './vpc';
import transitGatewayRoutes from './transitGateway';
import customerGatewayRoutes from './customerGateway';
import vpcEndpointRoutes from './vpcEndpoint';
import importExportRoutes from './import-export';
import bulkRoutes from './bulk';
import searchRoutes from './search';
import reportsRoutes from './reports';
import workflowRoutes from './workflows';

const router: Router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Network CMDB API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API version info
router.get('/version', (req, res) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
      features: [
        'vpc-management',
        'transit-gateway-management', 
        'customer-gateway-management',
        'vpc-endpoint-management',
        'bulk-operations',
        'import-export',
        'python-scripts',
        'audit-logging',
        'advanced-search',
        'saved-queries',
        'auto-complete',
        'reporting-system',
        'dashboard-widgets',
        'scheduled-reports',
        'report-export',
        'workflow-management',
        'workflow-execution',
        'n8n-integration'
      ]
    }
  });
});

// Mount resource routes
router.use('/vpcs', vpcRoutes);
router.use('/transit-gateways', transitGatewayRoutes);
router.use('/customer-gateways', customerGatewayRoutes);
router.use('/vpc-endpoints', vpcEndpointRoutes);
router.use('/', importExportRoutes); // Import/export routes are at root level
router.use('/bulk', bulkRoutes); // Bulk operations routes
router.use('/search', searchRoutes); // Advanced search and filtering routes
router.use('/reports', reportsRoutes); // Reporting system routes
router.use('/workflows', workflowRoutes); // Workflow management and execution routes

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    errors: [{
      code: 'ENDPOINT_NOT_FOUND',
      message: `The endpoint ${req.method} ${req.originalUrl} does not exist`
    }]
  });
});

export default router;