/**
 * VPC Repository Implementation
 * Handles CRUD operations for AWS VPC resources
 */

import { WhereOptions, Op } from 'sequelize';
import { NetworkResourceRepository } from './NetworkResourceRepository';
import Vpc from '../models/Vpc';
import { VpcCreateInput, VpcUpdateInput, VpcFilters } from '../types/network/VpcTypes';
import { QueryOptions, PaginatedResult } from './interfaces/IBaseRepository';

/**
 * VPC Repository class
 */
export class VpcRepository extends NetworkResourceRepository<Vpc, VpcCreateInput, VpcUpdateInput> {
  
  constructor() {
    super(Vpc);
  }

  /**
   * Get the AWS ID field name for VPC resources
   */
  protected getAwsIdField(): string {
    return 'awsVpcId';
  }

  /**
   * Find VPCs by CIDR block
   */
  async findByCidrBlock(cidrBlock: string, options?: QueryOptions): Promise<PaginatedResult<Vpc>> {
    try {
      return await this.findBy({ cidrBlock }, options);
    } catch (error) {
      throw new Error(`Failed to find VPCs by CIDR block ${cidrBlock}: ${error.message}`);
    }
  }

  /**
   * Find default VPCs
   */
  async findDefaultVpcs(options?: QueryOptions): Promise<PaginatedResult<Vpc>> {
    try {
      return await this.findBy({ isDefault: true }, options);
    } catch (error) {
      throw new Error(`Failed to find default VPCs: ${error.message}`);
    }
  }

  /**
   * Find VPCs by instance tenancy
   */
  async findByInstanceTenancy(
    instanceTenancy: 'default' | 'dedicated' | 'host', 
    options?: QueryOptions
  ): Promise<PaginatedResult<Vpc>> {
    try {
      return await this.findBy({ instanceTenancy }, options);
    } catch (error) {
      throw new Error(`Failed to find VPCs by instance tenancy ${instanceTenancy}: ${error.message}`);
    }
  }

  /**
   * Find VPCs with DNS hostnames enabled
   */
  async findWithDnsHostnamesEnabled(options?: QueryOptions): Promise<PaginatedResult<Vpc>> {
    try {
      return await this.findBy({ enableDnsHostnames: true }, options);
    } catch (error) {
      throw new Error(`Failed to find VPCs with DNS hostnames enabled: ${error.message}`);
    }
  }

  /**
   * Find VPCs with DNS support enabled
   */
  async findWithDnsSupportEnabled(options?: QueryOptions): Promise<PaginatedResult<Vpc>> {
    try {
      return await this.findBy({ enableDnsSupport: true }, options);
    } catch (error) {
      throw new Error(`Failed to find VPCs with DNS support enabled: ${error.message}`);
    }
  }

  /**
   * Find VPCs by DHCP Options ID
   */
  async findByDhcpOptionsId(dhcpOptionsId: string, options?: QueryOptions): Promise<PaginatedResult<Vpc>> {
    try {
      return await this.findBy({ dhcpOptionsId }, options);
    } catch (error) {
      throw new Error(`Failed to find VPCs by DHCP options ID ${dhcpOptionsId}: ${error.message}`);
    }
  }

  /**
   * Find VPCs that overlap with a given CIDR block
   */
  async findOverlappingCidr(cidrBlock: string, options?: QueryOptions): Promise<PaginatedResult<Vpc>> {
    try {
      // This is a simplified implementation - actual CIDR overlap detection
      // would require more sophisticated logic or database functions
      const [network, prefixLength] = cidrBlock.split('/');
      const networkParts = network.split('.').map(Number);
      
      // For now, just return VPCs with the same network prefix
      // In production, you might want to use database functions or 
      // more sophisticated CIDR matching
      const where: WhereOptions = {
        cidrBlock: {
          [Op.like]: `${networkParts[0]}.${networkParts[1]}.%`
        }
      };
      
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find VPCs with overlapping CIDR: ${error.message}`);
    }
  }

  /**
   * Advanced VPC search with multiple filters
   */
  async searchVpcs(filters: VpcFilters, options?: QueryOptions): Promise<PaginatedResult<Vpc>> {
    try {
      const where: WhereOptions = {};
      
      if (filters.awsVpcId) {
        where.awsVpcId = filters.awsVpcId;
      }
      
      if (filters.cidrBlock) {
        where.cidrBlock = {
          [Op.like]: `%${filters.cidrBlock}%`
        };
      }
      
      if (filters.isDefault !== undefined) {
        where.isDefault = filters.isDefault;
      }
      
      if (filters.instanceTenancy) {
        where.instanceTenancy = filters.instanceTenancy;
      }
      
      if (filters.enableDnsHostnames !== undefined) {
        where.enableDnsHostnames = filters.enableDnsHostnames;
      }
      
      if (filters.enableDnsSupport !== undefined) {
        where.enableDnsSupport = filters.enableDnsSupport;
      }
      
      if (filters.dhcpOptionsId) {
        where.dhcpOptionsId = filters.dhcpOptionsId;
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
      throw new Error(`Failed to search VPCs: ${error.message}`);
    }
  }

  /**
   * Get VPC statistics
   */
  async getVpcStatistics(): Promise<{
    totalVpcs: number;
    defaultVpcs: number;
    customVpcs: number;
    vpcsByState: Record<string, number>;
    vpcsByRegion: Record<string, number>;
    vpcsByTenancy: Record<string, number>;
  }> {
    try {
      // Total VPCs
      const totalVpcs = await this.count();
      
      // Default vs Custom VPCs
      const defaultVpcs = await this.count({ isDefault: true });
      const customVpcs = totalVpcs - defaultVpcs;
      
      // VPCs by state
      const stateStats = await this.model.findAll({
        attributes: [
          'state',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['state'],
        raw: true
      }) as any[];
      
      const vpcsByState = stateStats.reduce((acc, stat) => {
        acc[stat.state] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      // VPCs by region
      const regionStats = await this.model.findAll({
        attributes: [
          'region',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['region'],
        raw: true
      }) as any[];
      
      const vpcsByRegion = regionStats.reduce((acc, stat) => {
        acc[stat.region] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      // VPCs by tenancy
      const tenancyStats = await this.model.findAll({
        attributes: [
          'instanceTenancy',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['instanceTenancy'],
        raw: true
      }) as any[];
      
      const vpcsByTenancy = tenancyStats.reduce((acc, stat) => {
        acc[stat.instanceTenancy] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      return {
        totalVpcs,
        defaultVpcs,
        customVpcs,
        vpcsByState,
        vpcsByRegion,
        vpcsByTenancy
      };
    } catch (error) {
      throw new Error(`Failed to get VPC statistics: ${error.message}`);
    }
  }

  /**
   * Update VPC DNS settings
   */
  async updateDnsSettings(
    awsVpcId: string, 
    dnsSettings: {
      enableDnsHostnames?: boolean;
      enableDnsSupport?: boolean;
    }
  ): Promise<Vpc | null> {
    try {
      const vpc = await this.findByAwsId(awsVpcId);
      if (!vpc) {
        return null;
      }
      
      const updateData: Partial<VpcUpdateInput> = {};
      
      if (dnsSettings.enableDnsHostnames !== undefined) {
        updateData.enableDnsHostnames = dnsSettings.enableDnsHostnames;
      }
      
      if (dnsSettings.enableDnsSupport !== undefined) {
        updateData.enableDnsSupport = dnsSettings.enableDnsSupport;
      }
      
      return await this.updateById(vpc.id, updateData as VpcUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update DNS settings for VPC ${awsVpcId}: ${error.message}`);
    }
  }

  /**
   * Add or update CIDR block associations
   */
  async updateCidrBlockAssociations(
    awsVpcId: string, 
    cidrBlockAssociationSet: any[]
  ): Promise<Vpc | null> {
    try {
      const vpc = await this.findByAwsId(awsVpcId);
      if (!vpc) {
        return null;
      }
      
      return await this.updateById(vpc.id, { cidrBlockAssociationSet } as VpcUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update CIDR block associations for VPC ${awsVpcId}: ${error.message}`);
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
        { awsVpcId: { [Op.iLike]: searchPattern } },
        { cidrBlock: { [Op.iLike]: searchPattern } },
        { project: { [Op.iLike]: searchPattern } },
        { owner: { [Op.iLike]: searchPattern } },
        { environment: { [Op.iLike]: searchPattern } },
        { dhcpOptionsId: { [Op.iLike]: searchPattern } }
        // Note: For JSON tag searching, you might need database-specific functions
        // Example for PostgreSQL: { tags: { [Op.contains]: { [search]: '' } } }
      ]
    };
  }
}

export default VpcRepository;