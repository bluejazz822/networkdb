/**
 * VPC Endpoint Repository Implementation
 * Handles CRUD operations for AWS VPC Endpoint resources
 */

import { WhereOptions, Op } from 'sequelize';
import { NetworkResourceRepository } from './NetworkResourceRepository';
import VpcEndpoint from '../models/VpcEndpoint';
import { VpcEndpointCreateInput, VpcEndpointUpdateInput, VpcEndpointFilter } from '../types/network/VpcEndpointTypes';
import { QueryOptions, PaginatedResult } from './interfaces/IBaseRepository';

/**
 * VPC Endpoint Repository class
 */
export class VpcEndpointRepository extends NetworkResourceRepository<VpcEndpoint, VpcEndpointCreateInput, VpcEndpointUpdateInput> {
  
  constructor() {
    super(VpcEndpoint);
  }

  /**
   * Get the AWS ID field name for VPC Endpoint resources
   */
  protected getAwsIdField(): string {
    return 'awsVpcEndpointId';
  }

  /**
   * Find VPC Endpoints by VPC ID
   */
  async findByVpcId(vpcId: string, options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      return await this.findBy({ vpcId }, options);
    } catch (error) {
      throw new Error(`Failed to find VPC Endpoints by VPC ID ${vpcId}: ${error.message}`);
    }
  }

  /**
   * Find VPC Endpoints by service name
   */
  async findByServiceName(serviceName: string, options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      const where: WhereOptions = {
        serviceName: {
          [Op.iLike]: `%${serviceName}%`
        }
      };
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find VPC Endpoints by service name ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Find VPC Endpoints by service type
   */
  async findByServiceType(
    serviceType: 'Interface' | 'Gateway' | 'GatewayLoadBalancer', 
    options?: QueryOptions
  ): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      return await this.findBy({ serviceType }, options);
    } catch (error) {
      throw new Error(`Failed to find VPC Endpoints by service type ${serviceType}: ${error.message}`);
    }
  }

  /**
   * Find interface VPC Endpoints (those with network interfaces)
   */
  async findInterfaceEndpoints(options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      return await this.findBy({ serviceType: 'Interface' }, options);
    } catch (error) {
      throw new Error(`Failed to find interface VPC Endpoints: ${error.message}`);
    }
  }

  /**
   * Find gateway VPC Endpoints (those with route table associations)
   */
  async findGatewayEndpoints(options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      return await this.findBy({ serviceType: 'Gateway' }, options);
    } catch (error) {
      throw new Error(`Failed to find gateway VPC Endpoints: ${error.message}`);
    }
  }

  /**
   * Find VPC Endpoints with private DNS enabled
   */
  async findWithPrivateDnsEnabled(options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      return await this.findBy({ privateDnsEnabled: true }, options);
    } catch (error) {
      throw new Error(`Failed to find VPC Endpoints with private DNS enabled: ${error.message}`);
    }
  }

  /**
   * Find VPC Endpoints that require acceptance
   */
  async findRequiringAcceptance(options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      return await this.findBy({ acceptanceRequired: true }, options);
    } catch (error) {
      throw new Error(`Failed to find VPC Endpoints requiring acceptance: ${error.message}`);
    }
  }

  /**
   * Find VPC Endpoints managed by AWS
   */
  async findManagedByAws(options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      return await this.findBy({ managedByAws: true }, options);
    } catch (error) {
      throw new Error(`Failed to find AWS-managed VPC Endpoints: ${error.message}`);
    }
  }

  /**
   * Find VPC Endpoints by subnet ID
   */
  async findBySubnetId(subnetId: string, options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      // Use JSON query to find endpoints that have this subnet ID in their subnetIds array
      const where: WhereOptions = {
        subnetIds: {
          [Op.contains]: [subnetId]
        }
      };
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find VPC Endpoints by subnet ID ${subnetId}: ${error.message}`);
    }
  }

  /**
   * Find VPC Endpoints by route table ID
   */
  async findByRouteTableId(routeTableId: string, options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      // Use JSON query to find endpoints that have this route table ID in their routeTableIds array
      const where: WhereOptions = {
        routeTableIds: {
          [Op.contains]: [routeTableId]
        }
      };
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find VPC Endpoints by route table ID ${routeTableId}: ${error.message}`);
    }
  }

  /**
   * Find VPC Endpoints by security group ID
   */
  async findBySecurityGroupId(securityGroupId: string, options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      // Use JSON query to find endpoints that have this security group ID in their securityGroupIds array
      const where: WhereOptions = {
        securityGroupIds: {
          [Op.contains]: [securityGroupId]
        }
      };
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find VPC Endpoints by security group ID ${securityGroupId}: ${error.message}`);
    }
  }

  /**
   * Advanced VPC Endpoint search with multiple filters
   */
  async searchVpcEndpoints(filters: VpcEndpointFilter, options?: QueryOptions): Promise<PaginatedResult<VpcEndpoint>> {
    try {
      const where: WhereOptions = {};
      
      if (filters.awsVpcEndpointId) {
        where.awsVpcEndpointId = filters.awsVpcEndpointId;
      }
      
      if (filters.vpcId) {
        where.vpcId = filters.vpcId;
      }
      
      if (filters.serviceName) {
        where.serviceName = {
          [Op.iLike]: `%${filters.serviceName}%`
        };
      }
      
      if (filters.serviceType) {
        where.serviceType = filters.serviceType;
      }
      
      if (filters.privateDnsEnabled !== undefined) {
        where.privateDnsEnabled = filters.privateDnsEnabled;
      }
      
      if (filters.acceptanceRequired !== undefined) {
        where.acceptanceRequired = filters.acceptanceRequired;
      }
      
      if (filters.managedByAws !== undefined) {
        where.managedByAws = filters.managedByAws;
      }
      
      if (filters.hasPolicy !== undefined) {
        if (filters.hasPolicy) {
          where.policyDocument = { [Op.ne]: null };
        } else {
          where.policyDocument = { [Op.is]: null };
        }
      }
      
      if (filters.subnetId) {
        where.subnetIds = {
          [Op.contains]: [filters.subnetId]
        };
      }
      
      if (filters.routeTableId) {
        where.routeTableIds = {
          [Op.contains]: [filters.routeTableId]
        };
      }
      
      if (filters.securityGroupId) {
        where.securityGroupIds = {
          [Op.contains]: [filters.securityGroupId]
        };
      }
      
      // Add common network resource filters
      if (filters.awsAccountId) {
        where.awsAccountId = filters.awsAccountId;
      }
      
      if (filters.region) {
        where.region = filters.region;
      }
      
      if (filters.state) {
        where.state = filters.state;
      }
      
      if (filters.environment) {
        where.environment = filters.environment;
      }
      
      if (filters.project) {
        where.project = filters.project;
      }
      
      if (filters.owner) {
        where.owner = {
          [Op.iLike]: `%${filters.owner}%`
        };
      }
      
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to search VPC Endpoints: ${error.message}`);
    }
  }

  /**
   * Get VPC Endpoint statistics
   */
  async getVpcEndpointStatistics(): Promise<{
    totalVpcEndpoints: number;
    interfaceEndpoints: number;
    gatewayEndpoints: number;
    gatewayLoadBalancerEndpoints: number;
    endpointsByState: Record<string, number>;
    endpointsByRegion: Record<string, number>;
    endpointsByService: Record<string, number>;
    endpointsWithPrivateDns: number;
    endpointsRequiringAcceptance: number;
    awsManagedEndpoints: number;
  }> {
    try {
      // Total VPC Endpoints
      const totalVpcEndpoints = await this.count();
      
      // Endpoints by service type
      const interfaceEndpoints = await this.count({ serviceType: 'Interface' });
      const gatewayEndpoints = await this.count({ serviceType: 'Gateway' });
      const gatewayLoadBalancerEndpoints = await this.count({ serviceType: 'GatewayLoadBalancer' });
      
      // Other statistics
      const endpointsWithPrivateDns = await this.count({ privateDnsEnabled: true });
      const endpointsRequiringAcceptance = await this.count({ acceptanceRequired: true });
      const awsManagedEndpoints = await this.count({ managedByAws: true });
      
      // Endpoints by state
      const stateStats = await this.model.findAll({
        attributes: [
          'state',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['state'],
        raw: true
      }) as any[];
      
      const endpointsByState = stateStats.reduce((acc, stat) => {
        acc[stat.state] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      // Endpoints by region
      const regionStats = await this.model.findAll({
        attributes: [
          'region',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['region'],
        raw: true
      }) as any[];
      
      const endpointsByRegion = regionStats.reduce((acc, stat) => {
        acc[stat.region] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      // Endpoints by service
      const serviceStats = await this.model.findAll({
        attributes: [
          'serviceName',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['serviceName'],
        raw: true,
        order: [[this.model.sequelize!.fn('COUNT', '*'), 'DESC']],
        limit: 20 // Top 20 services
      }) as any[];
      
      const endpointsByService = serviceStats.reduce((acc, stat) => {
        acc[stat.serviceName] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      return {
        totalVpcEndpoints,
        interfaceEndpoints,
        gatewayEndpoints,
        gatewayLoadBalancerEndpoints,
        endpointsByState,
        endpointsByRegion,
        endpointsByService,
        endpointsWithPrivateDns,
        endpointsRequiringAcceptance,
        awsManagedEndpoints
      };
    } catch (error) {
      throw new Error(`Failed to get VPC Endpoint statistics: ${error.message}`);
    }
  }

  /**
   * Update VPC Endpoint DNS configuration
   */
  async updateDnsConfiguration(
    awsVpcEndpointId: string, 
    dnsConfig: {
      privateDnsEnabled?: boolean;
      dnsOptions?: any;
      dnsEntries?: any[];
    }
  ): Promise<VpcEndpoint | null> {
    try {
      const endpoint = await this.findByAwsId(awsVpcEndpointId);
      if (!endpoint) {
        return null;
      }
      
      return await this.updateById(endpoint.id, dnsConfig as VpcEndpointUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update DNS configuration for VPC Endpoint ${awsVpcEndpointId}: ${error.message}`);
    }
  }

  /**
   * Update VPC Endpoint policy
   */
  async updatePolicy(
    awsVpcEndpointId: string, 
    policyDocument: any
  ): Promise<VpcEndpoint | null> {
    try {
      const endpoint = await this.findByAwsId(awsVpcEndpointId);
      if (!endpoint) {
        return null;
      }
      
      return await this.updateById(endpoint.id, { policyDocument } as VpcEndpointUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update policy for VPC Endpoint ${awsVpcEndpointId}: ${error.message}`);
    }
  }

  /**
   * Update VPC Endpoint network configuration
   */
  async updateNetworkConfiguration(
    awsVpcEndpointId: string, 
    networkConfig: {
      subnetIds?: string[];
      routeTableIds?: string[];
      securityGroupIds?: string[];
      networkInterfaceIds?: string[];
    }
  ): Promise<VpcEndpoint | null> {
    try {
      const endpoint = await this.findByAwsId(awsVpcEndpointId);
      if (!endpoint) {
        return null;
      }
      
      return await this.updateById(endpoint.id, networkConfig as VpcEndpointUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update network configuration for VPC Endpoint ${awsVpcEndpointId}: ${error.message}`);
    }
  }

  /**
   * Enhanced search that includes various searchable fields
   */
  protected buildSearchWhere(search: string, existingWhere: WhereOptions): WhereOptions {
    const searchPattern = `%${search}%`;
    
    return {
      ...existingWhere,
      [Op.or]: [
        { name: { [Op.iLike]: searchPattern } },
        { description: { [Op.iLike]: searchPattern } },
        { awsVpcEndpointId: { [Op.iLike]: searchPattern } },
        { vpcId: { [Op.iLike]: searchPattern } },
        { serviceName: { [Op.iLike]: searchPattern } },
        { prefixListId: { [Op.iLike]: searchPattern } },
        { project: { [Op.iLike]: searchPattern } },
        { owner: { [Op.iLike]: searchPattern } },
        { environment: { [Op.iLike]: searchPattern } }
      ]
    };
  }
}

export default VpcEndpointRepository;