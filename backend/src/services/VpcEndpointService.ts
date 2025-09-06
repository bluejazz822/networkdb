/**
 * VPC Endpoint Service
 * Business logic layer for VPC Endpoint resource management
 */

import { VpcEndpointRepository } from '../repositories/VpcEndpointRepository';
import { BaseService, ServiceResponse, QueryOptions, PaginatedResponse } from './BaseService';
import { NetworkValidationSchemas, BusinessRuleValidators } from '../schemas';
import { VpcEndpoint } from '../models/VpcEndpoint';

export interface VpcEndpointCreateData {
  vpcEndpointId: string;
  region: string;
  vpcId: string;
  serviceName: string;
  vpcEndpointType: string;
  state: string;
  name?: string;
  environment?: string;
  owner?: string;
  policyDocument?: string;
  routeTableIds?: string[];
  subnetIds?: string[];
  securityGroupIds?: string[];
  tags?: Record<string, string>;
  awsAccountId?: string;
}

export interface VpcEndpointUpdateData extends Partial<VpcEndpointCreateData> {
  id?: never;
}

export interface VpcEndpointQueryFilters {
  region?: string;
  vpcId?: string;
  serviceName?: string;
  vpcEndpointType?: string;
  state?: string;
  environment?: string;
  owner?: string;
  searchTerm?: string;
}

export class VpcEndpointService extends BaseService<VpcEndpoint, VpcEndpointRepository> {
  constructor(private vpcEndpointRepository: VpcEndpointRepository) {
    super(vpcEndpointRepository);
  }

  async create(data: VpcEndpointCreateData, userId?: string): Promise<ServiceResponse<VpcEndpoint>> {
    try {
      const { error, value } = NetworkValidationSchemas.vpcEndpoint.create.validate(data);
      if (error) {
        return this.createErrorResponse(this.handleValidationError(error));
      }

      const businessRuleResult = await BusinessRuleValidators.vpcEndpoint(value);
      if (!businessRuleResult.valid) {
        return this.createErrorResponse(businessRuleResult.errors.map(err => ({
          code: 'BUSINESS_RULE_VIOLATION',
          message: err.message,
          field: err.field,
          details: err.details
        })));
      }

      const existing = await this.vpcEndpointRepository.findByVpcEndpointId(value.vpcEndpointId, value.region);
      if (existing) {
        return this.createSingleErrorResponse(
          'DUPLICATE_VPC_ENDPOINT',
          `VPC Endpoint with ID ${value.vpcEndpointId} already exists in region ${value.region}`,
          'vpcEndpointId'
        );
      }

      const vpcEndpoint = await this.vpcEndpointRepository.create(value);
      
      this.logOperation('CREATE', 'VPC_ENDPOINT', vpcEndpoint.id, userId, {
        vpcEndpointId: vpcEndpoint.vpcEndpointId,
        region: vpcEndpoint.region,
        serviceName: vpcEndpoint.serviceName
      });

      return this.createSuccessResponse(vpcEndpoint, 'VPC Endpoint created successfully');

    } catch (error) {
      console.error('Error creating VPC Endpoint:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async findById(id: string | number): Promise<ServiceResponse<VpcEndpoint>> {
    try {
      const vpcEndpoint = await this.vpcEndpointRepository.findById(Number(id));
      
      if (!vpcEndpoint) {
        return this.createSingleErrorResponse(
          'VPC_ENDPOINT_NOT_FOUND',
          `VPC Endpoint with ID ${id} not found`
        );
      }

      return this.createSuccessResponse(vpcEndpoint);

    } catch (error) {
      console.error('Error finding VPC Endpoint by ID:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async update(id: string | number, data: VpcEndpointUpdateData, userId?: string): Promise<ServiceResponse<VpcEndpoint>> {
    try {
      const { error, value } = NetworkValidationSchemas.vpcEndpoint.update.validate(data);
      if (error) {
        return this.createErrorResponse(this.handleValidationError(error));
      }

      const existingVpcEndpoint = await this.vpcEndpointRepository.findById(Number(id));
      if (!existingVpcEndpoint) {
        return this.createSingleErrorResponse(
          'VPC_ENDPOINT_NOT_FOUND',
          `VPC Endpoint with ID ${id} not found`
        );
      }

      const mergedData = { ...existingVpcEndpoint, ...value };
      const businessRuleResult = await BusinessRuleValidators.vpcEndpoint(mergedData);
      if (!businessRuleResult.valid) {
        return this.createErrorResponse(businessRuleResult.errors.map(err => ({
          code: 'BUSINESS_RULE_VIOLATION',
          message: err.message,
          field: err.field,
          details: err.details
        })));
      }

      const updatedVpcEndpoint = await this.vpcEndpointRepository.update(Number(id), value);

      this.logOperation('UPDATE', 'VPC_ENDPOINT', id, userId, { changes: value });

      return this.createSuccessResponse(updatedVpcEndpoint, 'VPC Endpoint updated successfully');

    } catch (error) {
      console.error('Error updating VPC Endpoint:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async delete(id: string | number, userId?: string): Promise<ServiceResponse<boolean>> {
    try {
      const existingVpcEndpoint = await this.vpcEndpointRepository.findById(Number(id));
      if (!existingVpcEndpoint) {
        return this.createSingleErrorResponse(
          'VPC_ENDPOINT_NOT_FOUND',
          `VPC Endpoint with ID ${id} not found`
        );
      }

      await this.vpcEndpointRepository.delete(Number(id));

      this.logOperation('DELETE', 'VPC_ENDPOINT', id, userId, {
        vpcEndpointId: existingVpcEndpoint.vpcEndpointId,
        region: existingVpcEndpoint.region,
        serviceName: existingVpcEndpoint.serviceName
      });

      return this.createSuccessResponse(true, 'VPC Endpoint deleted successfully');

    } catch (error) {
      console.error('Error deleting VPC Endpoint:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async findAll(options: QueryOptions & { filters?: VpcEndpointQueryFilters } = {}): Promise<ServiceResponse<PaginatedResponse<VpcEndpoint>>> {
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
        if (filters.vpcId) queryParams.vpcId = filters.vpcId;
        if (filters.serviceName) queryParams.serviceName = filters.serviceName;
        if (filters.vpcEndpointType) queryParams.vpcEndpointType = filters.vpcEndpointType;
        if (filters.state) queryParams.state = filters.state;
        if (filters.environment) queryParams.environment = filters.environment;
        if (filters.owner) queryParams.owner = filters.owner;
        if (filters.searchTerm) queryParams.searchTerm = filters.searchTerm;
      }

      const { vpcEndpoints, totalCount } = await this.vpcEndpointRepository.findAllWithPagination(queryParams);

      const paginatedResponse = this.createPaginatedResponse(vpcEndpoints, totalCount, page, limit);

      return this.createSuccessResponse(paginatedResponse);

    } catch (error) {
      console.error('Error finding VPC Endpoints:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async findByVpcId(vpcId: string, options: QueryOptions = {}): Promise<ServiceResponse<PaginatedResponse<VpcEndpoint>>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, vpcId }
    });
  }

  async findByServiceName(serviceName: string, options: QueryOptions = {}): Promise<ServiceResponse<PaginatedResponse<VpcEndpoint>>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, serviceName }
    });
  }
}