/**
 * VPC (Virtual Private Cloud) TypeScript interfaces and DTOs
 */

import { 
  AwsResource, 
  BusinessContext, 
  NetworkResourceState, 
  InstanceTenancy,
  CreateDto,
  UpdateDto,
  NetworkResourceFilter,
  QueryParams
} from '../common';

// VPC CIDR Block Association
export interface VpcCidrBlockAssociation {
  associationId: string;
  cidrBlock: string;
  cidrBlockState: {
    state: 'associating' | 'associated' | 'disassociating' | 'disassociated' | 'failing' | 'failed';
    statusMessage?: string;
  };
}

// Core VPC interface extending AWS resource base
export interface Vpc extends AwsResource, BusinessContext {
  // AWS identifiers
  awsVpcId: string;
  
  // Network configuration
  cidrBlock: string;
  cidrBlockAssociationSet?: VpcCidrBlockAssociation[] | null;
  dhcpOptionsId?: string | null;
  
  // State information
  state: NetworkResourceState;
  
  // Location and availability zones
  availabilityZones?: string[] | null;
  
  // VPC Configuration
  isDefault: boolean;
  instanceTenancy: InstanceTenancy;
  enableDnsHostnames: boolean;
  enableDnsSupport: boolean;
  enableNetworkAddressUsageMetrics: boolean;
}

// VPC creation DTO
export interface CreateVpcDto extends CreateDto, BusinessContext {
  // AWS identifiers - awsVpcId should be provided from AWS API
  awsVpcId: string;
  awsAccountId: string;
  region: string;
  regionId: string;
  statusId: string;
  
  // Network configuration
  cidrBlock: string;
  cidrBlockAssociationSet?: VpcCidrBlockAssociation[];
  dhcpOptionsId?: string;
  
  // State - usually 'pending' for new VPCs
  state?: NetworkResourceState;
  
  // Location
  availabilityZones?: string[];
  
  // Configuration
  isDefault?: boolean;
  instanceTenancy?: InstanceTenancy;
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
  enableNetworkAddressUsageMetrics?: boolean;
  
  // Metadata
  tags?: Record<string, string>;
  name?: string;
  description?: string;
  
  // Sync information
  sourceSystem?: string;
  lastSyncAt?: Date;
  syncVersion?: number;
  
  // Business context
  environment?: string;
  project?: string;
  costCenter?: string;
  owner?: string;
}

// VPC update DTO - all fields optional except where business logic requires them
export interface UpdateVpcDto extends UpdateDto, Partial<BusinessContext> {
  // Network configuration updates
  cidrBlockAssociationSet?: VpcCidrBlockAssociation[];
  dhcpOptionsId?: string;
  
  // State updates
  state?: NetworkResourceState;
  statusId?: string;
  
  // Configuration updates
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
  enableNetworkAddressUsageMetrics?: boolean;
  
  // Metadata updates
  tags?: Record<string, string>;
  name?: string;
  description?: string;
  
  // Sync information updates
  lastSyncAt?: Date;
  syncVersion?: number;
  
  // Business context updates
  environment?: string;
  project?: string;
  costCenter?: string;
  owner?: string;
}

// VPC-specific filter interface
export interface VpcFilter extends NetworkResourceFilter {
  awsVpcId?: string;
  cidrBlock?: string;
  isDefault?: boolean;
  instanceTenancy?: InstanceTenancy;
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
  dhcpOptionsId?: string;
  availabilityZone?: string; // Filter by any availability zone in the list
}

// VPC query parameters combining filter and pagination
export interface VpcQueryParams extends QueryParams {
  // VPC-specific filters
  awsVpcId?: string;
  awsAccountId?: string;
  region?: string;
  cidrBlock?: string;
  state?: NetworkResourceState;
  isDefault?: boolean;
  instanceTenancy?: InstanceTenancy;
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
  environment?: string;
  project?: string;
  owner?: string;
  
  // Date range filters
  createdAfter?: string; // ISO date string
  createdBefore?: string;
  lastSyncAfter?: string;
  lastSyncBefore?: string;
  
  // Search in name, description, or tags
  search?: string;
  
  // Sorting options specific to VPC
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'awsVpcId' | 'cidrBlock' | 'region' | 'lastSyncAt';
  sortOrder?: 'ASC' | 'DESC';
}

// VPC response DTO - what gets returned from API
export interface VpcResponseDto extends Vpc {
  // Include computed or joined fields that might be added by business logic
  attachmentCount?: number;
  subnetCount?: number;
  routeTableCount?: number;
  securityGroupCount?: number;
  
  // Status information resolved from statusId
  status?: {
    id: string;
    key: string;
    value: string;
    description?: string;
  };
  
  // Region information resolved from regionId
  regionInfo?: {
    id: string;
    key: string;
    value: string;
    description?: string;
  };
}

// VPC list response with additional metadata
export interface VpcListResponseDto {
  vpcs: VpcResponseDto[];
  totalCount: number;
  filteredCount: number;
}

// VPC creation response
export interface CreateVpcResponseDto {
  vpc: VpcResponseDto;
  message: string;
}

// VPC update response
export interface UpdateVpcResponseDto {
  vpc: VpcResponseDto;
  message: string;
  changedFields?: string[];
}

// VPC bulk operations
export interface BulkVpcOperation {
  operation: 'update' | 'delete' | 'sync';
  vpcIds: string[];
  updateData?: UpdateVpcDto; // For bulk updates
}

export interface BulkVpcResponse {
  success: number;
  failed: number;
  errors?: Array<{
    vpcId: string;
    error: string;
  }>;
}

// VPC synchronization from AWS
export interface VpcSyncDto {
  awsVpcId: string;
  awsAccountId: string;
  region: string;
  forceSync?: boolean; // Override existing data even if sync version is newer
}

export interface VpcSyncResponse {
  synced: VpcResponseDto;
  isNewRecord: boolean;
  changes?: Record<string, { from: any; to: any }>;
  syncTimestamp: Date;
}