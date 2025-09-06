/**
 * Main validation export file for Network CMDB
 */

// Common validation schemas
export * from './common';

// Network resource validation schemas
export * from './network/vpcValidation';
export * from './network/transitGatewayValidation';
export * from './network/customerGatewayValidation';
export * from './network/vpcEndpointValidation';