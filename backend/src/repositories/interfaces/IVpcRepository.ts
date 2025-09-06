/**
 * VPC Repository Interface
 */

import { INetworkResourceRepository } from './IBaseRepository';
import Vpc from '../../models/Vpc';
import { VpcCreateInput, VpcUpdateInput, VpcFilters } from '../../types/network/VpcTypes';
import { QueryOptions, PaginatedResult } from './IBaseRepository';

export interface IVpcRepository extends INetworkResourceRepository<Vpc, VpcCreateInput, VpcUpdateInput> {
  /**
   * Find VPCs by CIDR block
   */
  findByCidrBlock(cidrBlock: string, options?: QueryOptions): Promise<PaginatedResult<Vpc>>;

  /**
   * Find default VPCs
   */
  findDefaultVpcs(options?: QueryOptions): Promise<PaginatedResult<Vpc>>;

  /**
   * Find VPCs by instance tenancy
   */
  findByInstanceTenancy(instanceTenancy: 'default' | 'dedicated' | 'host', options?: QueryOptions): Promise<PaginatedResult<Vpc>>;

  /**
   * Find VPCs with DNS hostnames enabled
   */
  findWithDnsHostnamesEnabled(options?: QueryOptions): Promise<PaginatedResult<Vpc>>;

  /**
   * Find VPCs with DNS support enabled
   */
  findWithDnsSupportEnabled(options?: QueryOptions): Promise<PaginatedResult<Vpc>>;

  /**
   * Find VPCs by DHCP Options ID
   */
  findByDhcpOptionsId(dhcpOptionsId: string, options?: QueryOptions): Promise<PaginatedResult<Vpc>>;

  /**
   * Advanced VPC search with multiple filters
   */
  searchVpcs(filters: VpcFilters, options?: QueryOptions): Promise<PaginatedResult<Vpc>>;

  /**
   * Get VPC statistics
   */
  getVpcStatistics(): Promise<{
    totalVpcs: number;
    defaultVpcs: number;
    customVpcs: number;
    vpcsByState: Record<string, number>;
    vpcsByRegion: Record<string, number>;
    vpcsByTenancy: Record<string, number>;
  }>;

  /**
   * Update VPC DNS settings
   */
  updateDnsSettings(awsVpcId: string, dnsSettings: {
    enableDnsHostnames?: boolean;
    enableDnsSupport?: boolean;
  }): Promise<Vpc | null>;
}