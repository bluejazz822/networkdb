/**
 * VPC Service
 * Business logic layer for VPC resource management
 */

import { VpcRepository } from '../repositories/VpcRepository';
import { BaseService, ServiceResponse, QueryOptions, PaginatedResponse } from './BaseService';
import { NetworkValidationSchemas, BusinessRuleValidators } from '../schemas';
import { Vpc } from '../models/Vpc';

export interface VpcCreateData {
  vpcId: string;
  region: string;
  cidrBlock: string;
  state: string;
  name?: string;
  environment?: string;
  owner?: string;
  tags?: Record<string, string>;
  awsAccountId?: string;
}

export interface VpcUpdateData extends Partial<VpcCreateData> {
  id?: never; // Prevent ID updates
}

export interface VpcQueryFilters {
  region?: string;
  state?: string;
  environment?: string;
  owner?: string;
  cidrBlock?: string;
  searchTerm?: string;
}

export class VpcService extends BaseService<Vpc, VpcRepository> {
  constructor(private vpcRepository: VpcRepository) {
    super(vpcRepository);
  }

  /**
   * Create a new VPC
   */
  async create(data: VpcCreateData, userId?: string): Promise<ServiceResponse<Vpc>> {
    try {
      // Validate input data
      const { error, value } = NetworkValidationSchemas.vpc.create.validate(data);
      if (error) {
        return this.createErrorResponse(this.handleValidationError(error));
      }

      // Apply business rules validation
      const businessRuleResult = await BusinessRuleValidators.vpc(value);
      if (!businessRuleResult.valid) {
        return this.createErrorResponse(businessRuleResult.errors.map(err => ({
          code: 'BUSINESS_RULE_VIOLATION',
          message: err.message,
          field: err.field,
          details: err.details
        })));
      }

      // Check for existing VPC with same vpcId in same region
      const existing = await this.vpcRepository.findByVpcId(value.vpcId, value.region);
      if (existing) {
        return this.createSingleErrorResponse(
          'DUPLICATE_VPC',
          `VPC with ID ${value.vpcId} already exists in region ${value.region}`,
          'vpcId'
        );
      }

      // Create the VPC
      const vpc = await this.vpcRepository.create(value);
      
      // Log the operation
      this.logOperation('CREATE', 'VPC', vpc.id, userId, { vpcId: vpc.vpcId, region: vpc.region });

      return this.createSuccessResponse(vpc, 'VPC created successfully');

    } catch (error) {
      console.error('Error creating VPC:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  /**
   * Find VPC by ID
   */
  async findById(id: string | number): Promise<ServiceResponse<Vpc>> {
    try {
      const vpc = await this.vpcRepository.findById(Number(id));
      
      if (!vpc) {
        return this.createSingleErrorResponse(
          'VPC_NOT_FOUND',
          `VPC with ID ${id} not found`
        );
      }

      return this.createSuccessResponse(vpc);

    } catch (error) {
      console.error('Error finding VPC by ID:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  /**
   * Find VPC by AWS VPC ID and region
   */
  async findByVpcId(vpcId: string, region: string): Promise<ServiceResponse<Vpc>> {
    try {
      const vpc = await this.vpcRepository.findByVpcId(vpcId, region);
      
      if (!vpc) {
        return this.createSingleErrorResponse(
          'VPC_NOT_FOUND',
          `VPC with AWS ID ${vpcId} not found in region ${region}`
        );
      }

      return this.createSuccessResponse(vpc);

    } catch (error) {
      console.error('Error finding VPC by AWS ID:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  /**
   * Update VPC
   */
  async update(id: string | number, data: VpcUpdateData, userId?: string): Promise<ServiceResponse<Vpc>> {
    try {
      // Validate input data
      const { error, value } = NetworkValidationSchemas.vpc.update.validate(data);
      if (error) {
        return this.createErrorResponse(this.handleValidationError(error));
      }

      // Check if VPC exists
      const existingVpc = await this.vpcRepository.findById(Number(id));
      if (!existingVpc) {
        return this.createSingleErrorResponse(
          'VPC_NOT_FOUND',
          `VPC with ID ${id} not found`
        );
      }

      // If updating vpcId or region, check for conflicts
      if (value.vpcId && value.vpcId !== existingVpc.vpcId) {
        const region = value.region || existingVpc.region;
        const existing = await this.vpcRepository.findByVpcId(value.vpcId, region);
        if (existing && existing.id !== Number(id)) {
          return this.createSingleErrorResponse(
            'DUPLICATE_VPC',
            `VPC with ID ${value.vpcId} already exists in region ${region}`,
            'vpcId'
          );
        }
      }

      // Apply business rules validation to merged data
      const mergedData = { ...existingVpc, ...value };
      const businessRuleResult = await BusinessRuleValidators.vpc(mergedData);
      if (!businessRuleResult.valid) {
        return this.createErrorResponse(businessRuleResult.errors.map(err => ({
          code: 'BUSINESS_RULE_VIOLATION',
          message: err.message,
          field: err.field,
          details: err.details
        })));
      }

      // Update the VPC
      const updatedVpc = await this.vpcRepository.update(Number(id), value);

      // Log the operation
      this.logOperation('UPDATE', 'VPC', id, userId, { changes: value });

      return this.createSuccessResponse(updatedVpc, 'VPC updated successfully');

    } catch (error) {
      console.error('Error updating VPC:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  /**
   * Delete VPC
   */
  async delete(id: string | number, userId?: string): Promise<ServiceResponse<boolean>> {
    try {
      // Check if VPC exists
      const existingVpc = await this.vpcRepository.findById(Number(id));
      if (!existingVpc) {
        return this.createSingleErrorResponse(
          'VPC_NOT_FOUND',
          `VPC with ID ${id} not found`
        );
      }

      // Check for dependent resources (this would be extended with actual dependency checks)
      // For now, we'll just delete
      await this.vpcRepository.delete(Number(id));

      // Log the operation
      this.logOperation('DELETE', 'VPC', id, userId, { 
        vpcId: existingVpc.vpcId, 
        region: existingVpc.region 
      });

      return this.createSuccessResponse(true, 'VPC deleted successfully');

    } catch (error) {
      console.error('Error deleting VPC:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  /**
   * Find all VPCs with filtering and pagination
   */
  async findAll(options: QueryOptions & { filters?: VpcQueryFilters } = {}): Promise<ServiceResponse<PaginatedResponse<Vpc>>> {
    try {
      const { page, limit, offset } = this.applyPagination(options);
      
      // Build query parameters
      const queryParams: any = {
        limit,
        offset,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'DESC'
      };

      // Apply filters
      if (options.filters) {
        const { filters } = options;
        if (filters.region) queryParams.region = filters.region;
        if (filters.state) queryParams.state = filters.state;
        if (filters.environment) queryParams.environment = filters.environment;
        if (filters.owner) queryParams.owner = filters.owner;
        if (filters.cidrBlock) queryParams.cidrBlock = filters.cidrBlock;
        if (filters.searchTerm) queryParams.searchTerm = filters.searchTerm;
      }

      const { vpcs, totalCount } = await this.vpcRepository.findAllWithPagination(queryParams);

      const paginatedResponse = this.createPaginatedResponse(vpcs, totalCount, page, limit);

      return this.createSuccessResponse(paginatedResponse);

    } catch (error) {
      console.error('Error finding VPCs:', error);
      const dbErrors = this.handleDatabaseError(error);
      return this.createErrorResponse(dbErrors);
    }
  }

  /**
   * Find VPCs by region
   */
  async findByRegion(region: string, options: QueryOptions = {}): Promise<ServiceResponse<PaginatedResponse<Vpc>>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, region }
    });
  }

  /**
   * Find VPCs by environment
   */
  async findByEnvironment(environment: string, options: QueryOptions = {}): Promise<ServiceResponse<PaginatedResponse<Vpc>>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, environment }
    });
  }

  /**
   * Bulk operations
   */
  async bulkCreate(vpcs: VpcCreateData[], userId?: string): Promise<ServiceResponse<{ created: Vpc[]; errors: any[] }>> {
    const created: Vpc[] = [];
    const errors: any[] = [];

    for (const [index, vpcData] of vpcs.entries()) {
      try {
        const result = await this.create(vpcData, userId);
        if (result.success && result.data) {
          created.push(result.data);
        } else {
          errors.push({
            index,
            vpcId: vpcData.vpcId,
            errors: result.errors
          });
        }
      } catch (error) {
        errors.push({
          index,
          vpcId: vpcData.vpcId,
          errors: [{ code: 'UNEXPECTED_ERROR', message: error.message }]
        });
      }
    }

    return this.createSuccessResponse(
      { created, errors },
      `Bulk create completed: ${created.length} created, ${errors.length} errors`
    );
  }

  /**
   * Bulk delete
   */
  async bulkDelete(ids: number[], userId?: string): Promise<ServiceResponse<{ deleted: number[]; errors: any[] }>> {
    const deleted: number[] = [];
    const errors: any[] = [];

    for (const id of ids) {
      try {
        const result = await this.delete(id, userId);
        if (result.success) {
          deleted.push(id);
        } else {
          errors.push({
            id,
            errors: result.errors
          });
        }
      } catch (error) {
        errors.push({
          id,
          errors: [{ code: 'UNEXPECTED_ERROR', message: error.message }]
        });
      }
    }

    return this.createSuccessResponse(
      { deleted, errors },
      `Bulk delete completed: ${deleted.length} deleted, ${errors.length} errors`
    );
  }
}