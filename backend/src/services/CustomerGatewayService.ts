/**
 * Customer Gateway Service
 * Business logic layer for Customer Gateway resource management
 */

import { CustomerGatewayRepository } from '../repositories/CustomerGatewayRepository';
import { BaseService, ServiceResponse, QueryOptions, PaginatedResponse } from './BaseService';
import { NetworkValidationSchemas, BusinessRuleValidators } from '../schemas';
import { CustomerGateway } from '../models/CustomerGateway';

export interface CustomerGatewayCreateData {
  customerGatewayId: string;
  region: string;
  state: string;
  type: string;
  bgpAsn: number;
  ipAddress: string;
  name?: string;
  environment?: string;
  owner?: string;
  tags?: Record<string, string>;
  awsAccountId?: string;
}

export interface CustomerGatewayUpdateData extends Partial<CustomerGatewayCreateData> {
  id?: never;
}

export interface CustomerGatewayQueryFilters {
  region?: string;
  state?: string;
  type?: string;
  environment?: string;
  owner?: string;
  ipAddress?: string;
  searchTerm?: string;
}

export class CustomerGatewayService extends BaseService<CustomerGateway, CustomerGatewayRepository> {
  constructor(private customerGatewayRepository: CustomerGatewayRepository) {
    super(customerGatewayRepository);
  }

  async create(data: CustomerGatewayCreateData, userId?: string): Promise<ServiceResponse<CustomerGateway>> {
    try {
      const { error, value } = NetworkValidationSchemas.customerGateway.create.validate(data);
      if (error) {
        return this.createErrorResponse(this.handleValidationError(error));
      }

      const businessRuleResult = await BusinessRuleValidators.customerGateway(value);
      if (!businessRuleResult.valid) {
        return this.createErrorResponse(businessRuleResult.errors.map(err => ({
          code: 'BUSINESS_RULE_VIOLATION',
          message: err.message,
          field: err.field,
          details: err.details
        })));
      }

      const existing = await this.customerGatewayRepository.findByCustomerGatewayId(value.customerGatewayId, value.region);
      if (existing) {
        return this.createSingleErrorResponse(
          'DUPLICATE_CUSTOMER_GATEWAY',
          `Customer Gateway with ID ${value.customerGatewayId} already exists in region ${value.region}`,
          'customerGatewayId'
        );
      }

      const customerGateway = await this.customerGatewayRepository.create(value);
      
      this.logOperation('CREATE', 'CUSTOMER_GATEWAY', customerGateway.id, userId, {
        customerGatewayId: customerGateway.customerGatewayId,
        region: customerGateway.region
      });

      return this.createSuccessResponse(customerGateway, 'Customer Gateway created successfully');

    } catch (error) {
      console.error('Error creating Customer Gateway:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async findById(id: string | number): Promise<ServiceResponse<CustomerGateway>> {
    try {
      const customerGateway = await this.customerGatewayRepository.findById(Number(id));
      
      if (!customerGateway) {
        return this.createSingleErrorResponse(
          'CUSTOMER_GATEWAY_NOT_FOUND',
          `Customer Gateway with ID ${id} not found`
        );
      }

      return this.createSuccessResponse(customerGateway);

    } catch (error) {
      console.error('Error finding Customer Gateway by ID:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async update(id: string | number, data: CustomerGatewayUpdateData, userId?: string): Promise<ServiceResponse<CustomerGateway>> {
    try {
      const { error, value } = NetworkValidationSchemas.customerGateway.update.validate(data);
      if (error) {
        return this.createErrorResponse(this.handleValidationError(error));
      }

      const existingCustomerGateway = await this.customerGatewayRepository.findById(Number(id));
      if (!existingCustomerGateway) {
        return this.createSingleErrorResponse(
          'CUSTOMER_GATEWAY_NOT_FOUND',
          `Customer Gateway with ID ${id} not found`
        );
      }

      const mergedData = { ...existingCustomerGateway, ...value };
      const businessRuleResult = await BusinessRuleValidators.customerGateway(mergedData);
      if (!businessRuleResult.valid) {
        return this.createErrorResponse(businessRuleResult.errors.map(err => ({
          code: 'BUSINESS_RULE_VIOLATION',
          message: err.message,
          field: err.field,
          details: err.details
        })));
      }

      const updatedCustomerGateway = await this.customerGatewayRepository.update(Number(id), value);

      this.logOperation('UPDATE', 'CUSTOMER_GATEWAY', id, userId, { changes: value });

      return this.createSuccessResponse(updatedCustomerGateway, 'Customer Gateway updated successfully');

    } catch (error) {
      console.error('Error updating Customer Gateway:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async delete(id: string | number, userId?: string): Promise<ServiceResponse<boolean>> {
    try {
      const existingCustomerGateway = await this.customerGatewayRepository.findById(Number(id));
      if (!existingCustomerGateway) {
        return this.createSingleErrorResponse(
          'CUSTOMER_GATEWAY_NOT_FOUND',
          `Customer Gateway with ID ${id} not found`
        );
      }

      await this.customerGatewayRepository.delete(Number(id));

      this.logOperation('DELETE', 'CUSTOMER_GATEWAY', id, userId, {
        customerGatewayId: existingCustomerGateway.customerGatewayId,
        region: existingCustomerGateway.region
      });

      return this.createSuccessResponse(true, 'Customer Gateway deleted successfully');

    } catch (error) {
      console.error('Error deleting Customer Gateway:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async findAll(options: QueryOptions & { filters?: CustomerGatewayQueryFilters } = {}): Promise<ServiceResponse<PaginatedResponse<CustomerGateway>>> {
    try {
      const { page, limit, offset } = this.applyPagination(options);
      
      const queryParams: any = {
        limit,
        offset,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'DESC'
      };

      if (options.filters) {
        const { filters } = options;
        if (filters.region) queryParams.region = filters.region;
        if (filters.state) queryParams.state = filters.state;
        if (filters.type) queryParams.type = filters.type;
        if (filters.environment) queryParams.environment = filters.environment;
        if (filters.owner) queryParams.owner = filters.owner;
        if (filters.ipAddress) queryParams.ipAddress = filters.ipAddress;
        if (filters.searchTerm) queryParams.searchTerm = filters.searchTerm;
      }

      const { customerGateways, totalCount } = await this.customerGatewayRepository.findAllWithPagination(queryParams);

      const paginatedResponse = this.createPaginatedResponse(customerGateways, totalCount, page, limit);

      return this.createSuccessResponse(paginatedResponse);

    } catch (error) {
      console.error('Error finding Customer Gateways:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }
}