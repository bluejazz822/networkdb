/**
 * Consolidated schemas export for easy import by other modules
 */

// Validation schemas
import { 
  vpcValidationSchemas,
  validateVpcWithBusinessRules
} from '../validation/network/vpcValidation';

import { 
  transitGatewayValidationSchemas,
  validateTransitGatewayWithBusinessRules
} from '../validation/network/transitGatewayValidation';

import { 
  customerGatewayValidationSchemas,
  validateCustomerGatewayWithBusinessRules
} from '../validation/network/customerGatewayValidation';

import { 
  vpcEndpointValidationSchemas,
  validateVpcEndpointWithBusinessRules
} from '../validation/network/vpcEndpointValidation';

import { 
  bulkOperationSchema,
  exportRequestSchema,
  awsSyncRequestSchema,
  baseQueryParamsSchema,
  validationOptions
} from '../validation/common';

// Consolidated validation schemas for all network resources
export const NetworkValidationSchemas = {
  vpc: vpcValidationSchemas,
  transitGateway: transitGatewayValidationSchemas,
  customerGateway: customerGatewayValidationSchemas,
  vpcEndpoint: vpcEndpointValidationSchemas,
  
  // Common schemas
  common: {
    bulkOperation: bulkOperationSchema,
    exportRequest: exportRequestSchema,
    awsSyncRequest: awsSyncRequestSchema,
    baseQueryParams: baseQueryParamsSchema
  }
};

// Business rule validators
export const BusinessRuleValidators = {
  vpc: validateVpcWithBusinessRules,
  transitGateway: validateTransitGatewayWithBusinessRules,
  customerGateway: validateCustomerGatewayWithBusinessRules,
  vpcEndpoint: validateVpcEndpointWithBusinessRules
};

// Export validation options
export { validationOptions };

// Export all validation schemas individually for convenience
export {
  vpcValidationSchemas,
  transitGatewayValidationSchemas,
  customerGatewayValidationSchemas,
  vpcEndpointValidationSchemas,
  
  // Business rule validators
  validateVpcWithBusinessRules,
  validateTransitGatewayWithBusinessRules,
  validateCustomerGatewayWithBusinessRules,
  validateVpcEndpointWithBusinessRules,
  
  // Common schemas
  bulkOperationSchema,
  exportRequestSchema,
  awsSyncRequestSchema,
  baseQueryParamsSchema
};