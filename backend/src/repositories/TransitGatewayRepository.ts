/**
 * Transit Gateway Repository Implementation
 * Handles CRUD operations for AWS Transit Gateway resources
 */

import { WhereOptions, Op } from 'sequelize';
import { NetworkResourceRepository } from './NetworkResourceRepository';
import TransitGateway from '../models/TransitGateway';
import { TransitGatewayCreateInput, TransitGatewayUpdateInput, TransitGatewayFilter } from '../types/network/TransitGatewayTypes';
import { QueryOptions, PaginatedResult } from './interfaces/IBaseRepository';

/**
 * Transit Gateway Repository class
 */
export class TransitGatewayRepository extends NetworkResourceRepository<TransitGateway, TransitGatewayCreateInput, TransitGatewayUpdateInput> {
  
  constructor() {
    super(TransitGateway);
  }

  /**
   * Get the AWS ID field name for Transit Gateway resources
   */
  protected getAwsIdField(): string {
    return 'awsTransitGatewayId';
  }

  /**
   * Find Transit Gateways by Amazon Side ASN
   */
  async findByAmazonSideAsn(amazonSideAsn: number, options?: QueryOptions): Promise<PaginatedResult<TransitGateway>> {
    try {
      return await this.findBy({ amazonSideAsn }, options);
    } catch (error) {
      throw new Error(`Failed to find Transit Gateways by Amazon Side ASN ${amazonSideAsn}: ${error.message}`);
    }
  }

  /**
   * Find Transit Gateways by type (hub, spoke, inspection)
   */
  async findByType(
    transitGatewayType: 'hub' | 'spoke' | 'inspection', 
    options?: QueryOptions
  ): Promise<PaginatedResult<TransitGateway>> {
    try {
      return await this.findBy({ transitGatewayType }, options);
    } catch (error) {
      throw new Error(`Failed to find Transit Gateways by type ${transitGatewayType}: ${error.message}`);
    }
  }

  /**
   * Find primary Transit Gateways
   */
  async findPrimaryGateways(options?: QueryOptions): Promise<PaginatedResult<TransitGateway>> {
    try {
      return await this.findBy({ isPrimary: true }, options);
    } catch (error) {
      throw new Error(`Failed to find primary Transit Gateways: ${error.message}`);
    }
  }

  /**
   * Find Transit Gateways with auto accept shared attachments enabled
   */
  async findWithAutoAcceptEnabled(options?: QueryOptions): Promise<PaginatedResult<TransitGateway>> {
    try {
      return await this.findBy({ autoAcceptSharedAttachments: 'enable' }, options);
    } catch (error) {
      throw new Error(`Failed to find Transit Gateways with auto accept enabled: ${error.message}`);
    }
  }

  /**
   * Find Transit Gateways with DNS support enabled
   */
  async findWithDnsSupportEnabled(options?: QueryOptions): Promise<PaginatedResult<TransitGateway>> {
    try {
      return await this.findBy({ dnsSupport: 'enable' }, options);
    } catch (error) {
      throw new Error(`Failed to find Transit Gateways with DNS support enabled: ${error.message}`);
    }
  }

  /**
   * Find Transit Gateways with multicast enabled
   */
  async findWithMulticastEnabled(options?: QueryOptions): Promise<PaginatedResult<TransitGateway>> {
    try {
      return await this.findBy({ multicast: 'enable' }, options);
    } catch (error) {
      throw new Error(`Failed to find Transit Gateways with multicast enabled: ${error.message}`);
    }
  }

  /**
   * Find Transit Gateways by route table configuration
   */
  async findByRouteTableConfig(
    config: {
      defaultRouteTableAssociation?: 'enable' | 'disable';
      defaultRouteTablePropagation?: 'enable' | 'disable';
    },
    options?: QueryOptions
  ): Promise<PaginatedResult<TransitGateway>> {
    try {
      const where: WhereOptions = {};
      
      if (config.defaultRouteTableAssociation) {
        where.defaultRouteTableAssociation = config.defaultRouteTableAssociation;
      }
      
      if (config.defaultRouteTablePropagation) {
        where.defaultRouteTablePropagation = config.defaultRouteTablePropagation;
      }
      
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find Transit Gateways by route table config: ${error.message}`);
    }
  }

  /**
   * Advanced Transit Gateway search with multiple filters
   */
  async searchTransitGateways(filters: TransitGatewayFilter, options?: QueryOptions): Promise<PaginatedResult<TransitGateway>> {
    try {
      const where: WhereOptions = {};
      
      if (filters.awsTransitGatewayId) {
        where.awsTransitGatewayId = filters.awsTransitGatewayId;
      }
      
      if (filters.amazonSideAsn) {
        where.amazonSideAsn = filters.amazonSideAsn;
      }
      
      if (filters.transitGatewayType) {
        where.transitGatewayType = filters.transitGatewayType;
      }
      
      if (filters.isPrimary !== undefined) {
        where.isPrimary = filters.isPrimary;
      }
      
      if (filters.autoAcceptSharedAttachments) {
        where.autoAcceptSharedAttachments = filters.autoAcceptSharedAttachments;
      }
      
      if (filters.defaultRouteTableAssociation) {
        where.defaultRouteTableAssociation = filters.defaultRouteTableAssociation;
      }
      
      if (filters.defaultRouteTablePropagation) {
        where.defaultRouteTablePropagation = filters.defaultRouteTablePropagation;
      }
      
      if (filters.dnsSupport) {
        where.dnsSupport = filters.dnsSupport;
      }
      
      if (filters.multicast) {
        where.multicast = filters.multicast;
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
      throw new Error(`Failed to search Transit Gateways: ${error.message}`);
    }
  }

  /**
   * Get Transit Gateway statistics
   */
  async getTransitGatewayStatistics(): Promise<{
    totalTransitGateways: number;
    primaryTransitGateways: number;
    transitGatewaysByState: Record<string, number>;
    transitGatewaysByRegion: Record<string, number>;
    transitGatewaysByType: Record<string, number>;
    transitGatewaysWithDnsSupport: number;
    transitGatewaysWithMulticast: number;
  }> {
    try {
      // Total Transit Gateways
      const totalTransitGateways = await this.count();
      
      // Primary Transit Gateways
      const primaryTransitGateways = await this.count({ isPrimary: true });
      
      // Transit Gateways with DNS support
      const transitGatewaysWithDnsSupport = await this.count({ dnsSupport: 'enable' });
      
      // Transit Gateways with multicast
      const transitGatewaysWithMulticast = await this.count({ multicast: 'enable' });
      
      // Transit Gateways by state
      const stateStats = await this.model.findAll({
        attributes: [
          'state',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['state'],
        raw: true
      }) as any[];
      
      const transitGatewaysByState = stateStats.reduce((acc, stat) => {
        acc[stat.state] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      // Transit Gateways by region
      const regionStats = await this.model.findAll({
        attributes: [
          'region',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['region'],
        raw: true
      }) as any[];
      
      const transitGatewaysByRegion = regionStats.reduce((acc, stat) => {
        acc[stat.region] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      // Transit Gateways by type
      const typeStats = await this.model.findAll({
        attributes: [
          'transitGatewayType',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['transitGatewayType'],
        raw: true
      }) as any[];
      
      const transitGatewaysByType = typeStats.reduce((acc, stat) => {
        acc[stat.transitGatewayType || 'unspecified'] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      return {
        totalTransitGateways,
        primaryTransitGateways,
        transitGatewaysByState,
        transitGatewaysByRegion,
        transitGatewaysByType,
        transitGatewaysWithDnsSupport,
        transitGatewaysWithMulticast
      };
    } catch (error) {
      throw new Error(`Failed to get Transit Gateway statistics: ${error.message}`);
    }
  }

  /**
   * Update Transit Gateway configuration
   */
  async updateConfiguration(
    awsTransitGatewayId: string, 
    config: {
      autoAcceptSharedAttachments?: 'enable' | 'disable';
      defaultRouteTableAssociation?: 'enable' | 'disable';
      defaultRouteTablePropagation?: 'enable' | 'disable';
      dnsSupport?: 'enable' | 'disable';
      multicast?: 'enable' | 'disable';
    }
  ): Promise<TransitGateway | null> {
    try {
      const tgw = await this.findByAwsId(awsTransitGatewayId);
      if (!tgw) {
        return null;
      }
      
      const updateData: Partial<TransitGatewayUpdateInput> = {};
      
      if (config.autoAcceptSharedAttachments !== undefined) {
        updateData.autoAcceptSharedAttachments = config.autoAcceptSharedAttachments;
      }
      
      if (config.defaultRouteTableAssociation !== undefined) {
        updateData.defaultRouteTableAssociation = config.defaultRouteTableAssociation;
      }
      
      if (config.defaultRouteTablePropagation !== undefined) {
        updateData.defaultRouteTablePropagation = config.defaultRouteTablePropagation;
      }
      
      if (config.dnsSupport !== undefined) {
        updateData.dnsSupport = config.dnsSupport;
      }
      
      if (config.multicast !== undefined) {
        updateData.multicast = config.multicast;
      }
      
      return await this.updateById(tgw.id, updateData as TransitGatewayUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update configuration for Transit Gateway ${awsTransitGatewayId}: ${error.message}`);
    }
  }

  /**
   * Update Transit Gateway route table IDs
   */
  async updateRouteTableIds(
    awsTransitGatewayId: string, 
    routeTableIds: {
      associationDefaultRouteTableId?: string;
      propagationDefaultRouteTableId?: string;
    }
  ): Promise<TransitGateway | null> {
    try {
      const tgw = await this.findByAwsId(awsTransitGatewayId);
      if (!tgw) {
        return null;
      }
      
      return await this.updateById(tgw.id, routeTableIds as TransitGatewayUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update route table IDs for Transit Gateway ${awsTransitGatewayId}: ${error.message}`);
    }
  }

  /**
   * Update Transit Gateway CIDR blocks
   */
  async updateCidrBlocks(
    awsTransitGatewayId: string, 
    transitGatewayCidrBlocks: string[]
  ): Promise<TransitGateway | null> {
    try {
      const tgw = await this.findByAwsId(awsTransitGatewayId);
      if (!tgw) {
        return null;
      }
      
      return await this.updateById(tgw.id, { transitGatewayCidrBlocks } as TransitGatewayUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update CIDR blocks for Transit Gateway ${awsTransitGatewayId}: ${error.message}`);
    }
  }

  /**
   * Enhanced search that includes name, description, and tag searching
   */
  protected buildSearchWhere(search: string, existingWhere: WhereOptions): WhereOptions {
    const searchPattern = `%${search}%`;
    
    return {
      ...existingWhere,
      [Op.or]: [
        { name: { [Op.iLike]: searchPattern } },
        { description: { [Op.iLike]: searchPattern } },
        { awsTransitGatewayId: { [Op.iLike]: searchPattern } },
        { project: { [Op.iLike]: searchPattern } },
        { owner: { [Op.iLike]: searchPattern } },
        { environment: { [Op.iLike]: searchPattern } },
        { associationDefaultRouteTableId: { [Op.iLike]: searchPattern } },
        { propagationDefaultRouteTableId: { [Op.iLike]: searchPattern } }
      ]
    };
  }
}

export default TransitGatewayRepository;