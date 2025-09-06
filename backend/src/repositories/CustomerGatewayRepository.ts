/**
 * Customer Gateway Repository Implementation
 * Handles CRUD operations for AWS Customer Gateway resources
 */

import { WhereOptions, Op } from 'sequelize';
import { NetworkResourceRepository } from './NetworkResourceRepository';
import CustomerGateway from '../models/CustomerGateway';
import { CustomerGatewayCreateInput, CustomerGatewayUpdateInput, CustomerGatewayFilter } from '../types/network/CustomerGatewayTypes';
import { QueryOptions, PaginatedResult } from './interfaces/IBaseRepository';

/**
 * Customer Gateway Repository class
 */
export class CustomerGatewayRepository extends NetworkResourceRepository<CustomerGateway, CustomerGatewayCreateInput, CustomerGatewayUpdateInput> {
  
  constructor() {
    super(CustomerGateway);
  }

  /**
   * Get the AWS ID field name for Customer Gateway resources
   */
  protected getAwsIdField(): string {
    return 'awsCustomerGatewayId';
  }

  /**
   * Find Customer Gateways by IP address
   */
  async findByIpAddress(ipAddress: string, options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      return await this.findBy({ ipAddress }, options);
    } catch (error) {
      throw new Error(`Failed to find Customer Gateways by IP address ${ipAddress}: ${error.message}`);
    }
  }

  /**
   * Find Customer Gateways by BGP ASN
   */
  async findByBgpAsn(bgpAsn: number, options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      return await this.findBy({ bgpAsn }, options);
    } catch (error) {
      throw new Error(`Failed to find Customer Gateways by BGP ASN ${bgpAsn}: ${error.message}`);
    }
  }

  /**
   * Find Customer Gateways by type
   */
  async findByType(type: 'ipsec.1', options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      return await this.findBy({ type }, options);
    } catch (error) {
      throw new Error(`Failed to find Customer Gateways by type ${type}: ${error.message}`);
    }
  }

  /**
   * Find primary Customer Gateways
   */
  async findPrimaryGateways(options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      return await this.findBy({ isPrimary: true }, options);
    } catch (error) {
      throw new Error(`Failed to find primary Customer Gateways: ${error.message}`);
    }
  }

  /**
   * Find Customer Gateways by site location
   */
  async findBySiteLocation(siteLocation: string, options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      const where: WhereOptions = {
        siteLocation: {
          [Op.iLike]: `%${siteLocation}%`
        }
      };
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find Customer Gateways by site location ${siteLocation}: ${error.message}`);
    }
  }

  /**
   * Find Customer Gateways by redundancy group
   */
  async findByRedundancyGroup(redundancyGroup: string, options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      return await this.findBy({ redundancyGroup }, options);
    } catch (error) {
      throw new Error(`Failed to find Customer Gateways by redundancy group ${redundancyGroup}: ${error.message}`);
    }
  }

  /**
   * Find Customer Gateways by device vendor
   */
  async findByDeviceVendor(deviceVendor: string, options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      const where: WhereOptions = {
        deviceVendor: {
          [Op.iLike]: `%${deviceVendor}%`
        }
      };
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find Customer Gateways by device vendor ${deviceVendor}: ${error.message}`);
    }
  }

  /**
   * Find Customer Gateways with certificate authentication
   */
  async findWithCertificateAuth(options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      const where: WhereOptions = {
        certificateArn: {
          [Op.ne]: null
        }
      };
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find Customer Gateways with certificate authentication: ${error.message}`);
    }
  }

  /**
   * Find Customer Gateways by contact information
   */
  async findByContact(contactFilter: {
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
  }, options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      const where: WhereOptions = {};
      
      if (contactFilter.contactPerson) {
        where.contactPerson = {
          [Op.iLike]: `%${contactFilter.contactPerson}%`
        };
      }
      
      if (contactFilter.contactEmail) {
        where.contactEmail = {
          [Op.iLike]: `%${contactFilter.contactEmail}%`
        };
      }
      
      if (contactFilter.contactPhone) {
        where.contactPhone = {
          [Op.iLike]: `%${contactFilter.contactPhone}%`
        };
      }
      
      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to find Customer Gateways by contact info: ${error.message}`);
    }
  }

  /**
   * Advanced Customer Gateway search with multiple filters
   */
  async searchCustomerGateways(filters: CustomerGatewayFilter, options?: QueryOptions): Promise<PaginatedResult<CustomerGateway>> {
    try {
      const where: WhereOptions = {};
      
      if (filters.awsCustomerGatewayId) {
        where.awsCustomerGatewayId = filters.awsCustomerGatewayId;
      }
      
      if (filters.type) {
        where.type = filters.type;
      }
      
      if (filters.ipAddress) {
        where.ipAddress = filters.ipAddress;
      }
      
      if (filters.bgpAsn) {
        where.bgpAsn = filters.bgpAsn;
      }
      
      if (filters.deviceVendor) {
        where.deviceVendor = {
          [Op.iLike]: `%${filters.deviceVendor}%`
        };
      }
      
      if (filters.deviceModel) {
        where.deviceModel = {
          [Op.iLike]: `%${filters.deviceModel}%`
        };
      }
      
      if (filters.siteLocation) {
        where.siteLocation = {
          [Op.iLike]: `%${filters.siteLocation}%`
        };
      }
      
      if (filters.isPrimary !== undefined) {
        where.isPrimary = filters.isPrimary;
      }
      
      if (filters.redundancyGroup) {
        where.redundancyGroup = filters.redundancyGroup;
      }
      
      if (filters.hasCertificateAuth !== undefined) {
        if (filters.hasCertificateAuth) {
          where.certificateArn = { [Op.ne]: null };
        } else {
          where.certificateArn = { [Op.is]: null };
        }
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
      throw new Error(`Failed to search Customer Gateways: ${error.message}`);
    }
  }

  /**
   * Get Customer Gateway statistics
   */
  async getCustomerGatewayStatistics(): Promise<{
    totalCustomerGateways: number;
    primaryCustomerGateways: number;
    customerGatewaysByState: Record<string, number>;
    customerGatewaysByRegion: Record<string, number>;
    customerGatewaysByVendor: Record<string, number>;
    customerGatewaysWithCerts: number;
    redundancyGroups: number;
    uniqueLocations: number;
  }> {
    try {
      // Total Customer Gateways
      const totalCustomerGateways = await this.count();
      
      // Primary Customer Gateways
      const primaryCustomerGateways = await this.count({ isPrimary: true });
      
      // Customer Gateways with certificates
      const customerGatewaysWithCerts = await this.count({
        certificateArn: { [Op.ne]: null }
      });
      
      // Count unique redundancy groups
      const redundancyGroupsResult = await this.model.findAll({
        attributes: [[this.model.sequelize!.fn('COUNT', this.model.sequelize!.fn('DISTINCT', this.model.sequelize!.col('redundancyGroup'))), 'count']],
        where: { redundancyGroup: { [Op.ne]: null } },
        raw: true
      }) as any[];
      const redundancyGroups = parseInt(redundancyGroupsResult[0]?.count || '0');
      
      // Count unique site locations
      const uniqueLocationsResult = await this.model.findAll({
        attributes: [[this.model.sequelize!.fn('COUNT', this.model.sequelize!.fn('DISTINCT', this.model.sequelize!.col('siteLocation'))), 'count']],
        where: { siteLocation: { [Op.ne]: null } },
        raw: true
      }) as any[];
      const uniqueLocations = parseInt(uniqueLocationsResult[0]?.count || '0');
      
      // Customer Gateways by state
      const stateStats = await this.model.findAll({
        attributes: [
          'state',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['state'],
        raw: true
      }) as any[];
      
      const customerGatewaysByState = stateStats.reduce((acc, stat) => {
        acc[stat.state] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      // Customer Gateways by region
      const regionStats = await this.model.findAll({
        attributes: [
          'region',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['region'],
        raw: true
      }) as any[];
      
      const customerGatewaysByRegion = regionStats.reduce((acc, stat) => {
        acc[stat.region] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      // Customer Gateways by vendor
      const vendorStats = await this.model.findAll({
        attributes: [
          'deviceVendor',
          [this.model.sequelize!.fn('COUNT', '*'), 'count']
        ],
        group: ['deviceVendor'],
        raw: true
      }) as any[];
      
      const customerGatewaysByVendor = vendorStats.reduce((acc, stat) => {
        acc[stat.deviceVendor || 'unknown'] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);
      
      return {
        totalCustomerGateways,
        primaryCustomerGateways,
        customerGatewaysByState,
        customerGatewaysByRegion,
        customerGatewaysByVendor,
        customerGatewaysWithCerts,
        redundancyGroups,
        uniqueLocations
      };
    } catch (error) {
      throw new Error(`Failed to get Customer Gateway statistics: ${error.message}`);
    }
  }

  /**
   * Update Customer Gateway contact information
   */
  async updateContactInfo(
    awsCustomerGatewayId: string, 
    contactInfo: {
      contactPerson?: string;
      contactPhone?: string;
      contactEmail?: string;
    }
  ): Promise<CustomerGateway | null> {
    try {
      const cgw = await this.findByAwsId(awsCustomerGatewayId);
      if (!cgw) {
        return null;
      }
      
      return await this.updateById(cgw.id, contactInfo as CustomerGatewayUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update contact info for Customer Gateway ${awsCustomerGatewayId}: ${error.message}`);
    }
  }

  /**
   * Update Customer Gateway device information
   */
  async updateDeviceInfo(
    awsCustomerGatewayId: string, 
    deviceInfo: {
      deviceName?: string;
      deviceModel?: string;
      deviceVendor?: string;
      deviceSoftwareVersion?: string;
    }
  ): Promise<CustomerGateway | null> {
    try {
      const cgw = await this.findByAwsId(awsCustomerGatewayId);
      if (!cgw) {
        return null;
      }
      
      return await this.updateById(cgw.id, deviceInfo as CustomerGatewayUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update device info for Customer Gateway ${awsCustomerGatewayId}: ${error.message}`);
    }
  }

  /**
   * Update Customer Gateway network configuration
   */
  async updateNetworkConfig(
    awsCustomerGatewayId: string, 
    networkConfig: {
      insideIpv4NetworkCidr?: string;
      outsideIpAddress?: string;
      certificateArn?: string;
    }
  ): Promise<CustomerGateway | null> {
    try {
      const cgw = await this.findByAwsId(awsCustomerGatewayId);
      if (!cgw) {
        return null;
      }
      
      return await this.updateById(cgw.id, networkConfig as CustomerGatewayUpdateInput);
    } catch (error) {
      throw new Error(`Failed to update network config for Customer Gateway ${awsCustomerGatewayId}: ${error.message}`);
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
        { awsCustomerGatewayId: { [Op.iLike]: searchPattern } },
        { ipAddress: { [Op.iLike]: searchPattern } },
        { deviceName: { [Op.iLike]: searchPattern } },
        { deviceVendor: { [Op.iLike]: searchPattern } },
        { deviceModel: { [Op.iLike]: searchPattern } },
        { siteLocation: { [Op.iLike]: searchPattern } },
        { contactPerson: { [Op.iLike]: searchPattern } },
        { contactEmail: { [Op.iLike]: searchPattern } },
        { project: { [Op.iLike]: searchPattern } },
        { owner: { [Op.iLike]: searchPattern } },
        { environment: { [Op.iLike]: searchPattern } },
        { redundancyGroup: { [Op.iLike]: searchPattern } }
      ]
    };
  }
}

export default CustomerGatewayRepository;