/**
 * Transit Gateway Service
 * Business logic layer for Transit Gateway resource management
 */

import { TransitGatewayRepository } from '../repositories/TransitGatewayRepository';
import { BaseService, ServiceResponse, QueryOptions, PaginatedResponse } from './BaseService';
import { NetworkValidationSchemas, BusinessRuleValidators } from '../schemas';
import { TransitGateway } from '../models/TransitGateway';

export interface TransitGatewayCreateData {
  transitGatewayId: string;
  region: string;
  state: string;
  name?: string;
  description?: string;
  environment?: string;
  owner?: string;
  amazonSideAsn?: number;
  autoAcceptSharedAttachments?: string;
  defaultRouteTableAssociation?: string;
  defaultRouteTablePropagation?: string;
  dnsSupport?: string;
  multicast?: string;
  tags?: Record<string, string>;
  awsAccountId?: string;
}

export interface TransitGatewayUpdateData extends Partial<TransitGatewayCreateData> {
  id?: never;
}

export interface TransitGatewayQueryFilters {
  region?: string;
  state?: string;
  environment?: string;
  owner?: string;
  searchTerm?: string;
}

export class TransitGatewayService extends BaseService<TransitGateway, TransitGatewayRepository> {
  constructor(private transitGatewayRepository: TransitGatewayRepository) {
    super(transitGatewayRepository);
  }

  async create(data: TransitGatewayCreateData, userId?: string): Promise<ServiceResponse<TransitGateway>> {
    try {
      const { error, value } = NetworkValidationSchemas.transitGateway.create.validate(data);
      if (error) {
        return this.createErrorResponse(this.handleValidationError(error));
      }

      const businessRuleResult = await BusinessRuleValidators.transitGateway(value);
      if (!businessRuleResult.valid) {
        return this.createErrorResponse(businessRuleResult.errors.map(err => ({
          code: 'BUSINESS_RULE_VIOLATION',
          message: err.message,
          field: err.field,
          details: err.details
        })));
      }

      const existing = await this.transitGatewayRepository.findByTransitGatewayId(value.transitGatewayId, value.region);
      if (existing) {
        return this.createSingleErrorResponse(
          'DUPLICATE_TRANSIT_GATEWAY',
          `Transit Gateway with ID ${value.transitGatewayId} already exists in region ${value.region}`,
          'transitGatewayId'
        );
      }

      const transitGateway = await this.transitGatewayRepository.create(value);
      
      this.logOperation('CREATE', 'TRANSIT_GATEWAY', transitGateway.id, userId, {
        transitGatewayId: transitGateway.transitGatewayId,
        region: transitGateway.region
      });

      return this.createSuccessResponse(transitGateway, 'Transit Gateway created successfully');

    } catch (error) {
      console.error('Error creating Transit Gateway:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async findById(id: string | number): Promise<ServiceResponse<TransitGateway>> {
    try {
      const transitGateway = await this.transitGatewayRepository.findById(Number(id));
      
      if (!transitGateway) {
        return this.createSingleErrorResponse(
          'TRANSIT_GATEWAY_NOT_FOUND',
          `Transit Gateway with ID ${id} not found`
        );
      }

      return this.createSuccessResponse(transitGateway);

    } catch (error) {
      console.error('Error finding Transit Gateway by ID:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async findByTransitGatewayId(transitGatewayId: string, region: string): Promise<ServiceResponse<TransitGateway>> {
    try {
      const transitGateway = await this.transitGatewayRepository.findByTransitGatewayId(transitGatewayId, region);
      
      if (!transitGateway) {
        return this.createSingleErrorResponse(
          'TRANSIT_GATEWAY_NOT_FOUND',
          `Transit Gateway with AWS ID ${transitGatewayId} not found in region ${region}`
        );
      }

      return this.createSuccessResponse(transitGateway);

    } catch (error) {
      console.error('Error finding Transit Gateway by AWS ID:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async update(id: string | number, data: TransitGatewayUpdateData, userId?: string): Promise<ServiceResponse<TransitGateway>> {
    try {
      const { error, value } = NetworkValidationSchemas.transitGateway.update.validate(data);
      if (error) {
        return this.createErrorResponse(this.handleValidationError(error));
      }

      const existingTransitGateway = await this.transitGatewayRepository.findById(Number(id));
      if (!existingTransitGateway) {
        return this.createSingleErrorResponse(
          'TRANSIT_GATEWAY_NOT_FOUND',
          `Transit Gateway with ID ${id} not found`
        );
      }

      if (value.transitGatewayId && value.transitGatewayId !== existingTransitGateway.transitGatewayId) {
        const region = value.region || existingTransitGateway.region;
        const existing = await this.transitGatewayRepository.findByTransitGatewayId(value.transitGatewayId, region);
        if (existing && existing.id !== Number(id)) {
          return this.createSingleErrorResponse(
            'DUPLICATE_TRANSIT_GATEWAY',
            `Transit Gateway with ID ${value.transitGatewayId} already exists in region ${region}`,
            'transitGatewayId'
          );
        }
      }

      const mergedData = { ...existingTransitGateway, ...value };
      const businessRuleResult = await BusinessRuleValidators.transitGateway(mergedData);
      if (!businessRuleResult.valid) {
        return this.createErrorResponse(businessRuleResult.errors.map(err => ({
          code: 'BUSINESS_RULE_VIOLATION',
          message: err.message,
          field: err.field,
          details: err.details
        })));
      }

      const updatedTransitGateway = await this.transitGatewayRepository.update(Number(id), value);

      this.logOperation('UPDATE', 'TRANSIT_GATEWAY', id, userId, { changes: value });

      return this.createSuccessResponse(updatedTransitGateway, 'Transit Gateway updated successfully');

    } catch (error) {
      console.error('Error updating Transit Gateway:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async delete(id: string | number, userId?: string): Promise<ServiceResponse<boolean>> {
    try {
      const existingTransitGateway = await this.transitGatewayRepository.findById(Number(id));
      if (!existingTransitGateway) {
        return this.createSingleErrorResponse(
          'TRANSIT_GATEWAY_NOT_FOUND',
          `Transit Gateway with ID ${id} not found`
        );
      }

      await this.transitGatewayRepository.delete(Number(id));

      this.logOperation('DELETE', 'TRANSIT_GATEWAY', id, userId, {
        transitGatewayId: existingTransitGateway.transitGatewayId,
        region: existingTransitGateway.region
      });

      return this.createSuccessResponse(true, 'Transit Gateway deleted successfully');

    } catch (error) {
      console.error('Error deleting Transit Gateway:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async findAll(options: QueryOptions & { filters?: TransitGatewayQueryFilters } = {}): Promise<ServiceResponse<PaginatedResponse<TransitGateway>>> {
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
        if (filters.environment) queryParams.environment = filters.environment;
        if (filters.owner) queryParams.owner = filters.owner;
        if (filters.searchTerm) queryParams.searchTerm = filters.searchTerm;
      }

      const { transitGateways, totalCount } = await this.transitGatewayRepository.findAllWithPagination(queryParams);

      const paginatedResponse = this.createPaginatedResponse(transitGateways, totalCount, page, limit);

      return this.createSuccessResponse(paginatedResponse);

    } catch (error) {
      console.error('Error finding Transit Gateways:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  async findByRegion(region: string, options: QueryOptions = {}): Promise<ServiceResponse<PaginatedResponse<TransitGateway>>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, region }
    });
  }

  async findByEnvironment(environment: string, options: QueryOptions = {}): Promise<ServiceResponse<PaginatedResponse<TransitGateway>>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, environment }
    });
  }
}