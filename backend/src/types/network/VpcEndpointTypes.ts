/**
 * VPC Endpoint TypeScript interfaces and DTOs
 * Note: VPC Endpoint migration not yet created, types designed from AWS VPC Endpoint specification
 */

import { 
  AwsResource, 
  BusinessContext, 
  NetworkResourceState,
  CreateDto,
  UpdateDto,
  NetworkResourceFilter,
  QueryParams
} from '../common';

// VPC Endpoint types
export type VpcEndpointType = 'Gateway' | 'Interface' | 'GatewayLoadBalancer';

// VPC Endpoint service types
export type VpcEndpointServiceType = 'com.amazonaws' | 'com.amazonaws.vpce' | 'custom';

// VPC Endpoint route table association
export interface VpcEndpointRouteTable {
  routeTableId: string;
  state: 'associating' | 'associated' | 'disassociating' | 'disassociated' | 'failed';
}

// VPC Endpoint subnet association (for Interface endpoints)
export interface VpcEndpointSubnet {
  subnetId: string;
  availabilityZone: string;
  networkInterfaceId?: string;
}

// VPC Endpoint security group (for Interface endpoints)
export interface VpcEndpointSecurityGroup {
  groupId: string;
  groupName: string;
}

// VPC Endpoint DNS entry
export interface VpcEndpointDnsEntry {
  dnsName: string;
  hostedZoneId?: string;
}

// Policy document for VPC Endpoint
export interface VpcEndpointPolicyDocument {
  Version: string;
  Statement: Array<{
    Effect: 'Allow' | 'Deny';
    Principal?: any;
    Action: string | string[];
    Resource?: string | string[];
    Condition?: Record<string, any>;
  }>;
}

// Core VPC Endpoint interface
export interface VpcEndpoint extends AwsResource, BusinessContext {
  // AWS identifiers
  awsVpcEndpointId: string;
  vpcId: string; // Associated VPC
  
  // Basic Configuration
  vpcEndpointType: VpcEndpointType;
  serviceName: string; // e.g., com.amazonaws.us-east-1.s3
  
  // State information
  state: NetworkResourceState;
  
  // Network Configuration
  routeTableIds?: string[] | null; // For Gateway endpoints
  subnetIds?: string[] | null; // For Interface endpoints
  securityGroupIds?: string[] | null; // For Interface endpoints
  
  // DNS Configuration (Interface endpoints)
  privateDnsEnabled?: boolean | null;
  dnsEntries?: VpcEndpointDnsEntry[] | null;
  
  // Policy Configuration
  policyDocument?: VpcEndpointPolicyDocument | null;
  
  // Service Configuration
  acceptanceRequired?: boolean | null;
  
  // Network details (computed from associations)
  networkInterfaceIds?: string[] | null;
  
  // Creation timestamp from AWS
  creationTimestamp?: Date | null;
}

// VPC Endpoint creation DTO
export interface CreateVpcEndpointDto extends CreateDto, BusinessContext {
  // AWS identifiers
  awsVpcEndpointId: string;
  awsAccountId: string;
  region: string;
  regionId: string;
  statusId: string;
  vpcId: string;
  
  // Basic Configuration
  vpcEndpointType: VpcEndpointType;
  serviceName: string;
  
  // State - usually 'pending' for new VPC Endpoints
  state?: NetworkResourceState;
  
  // Network Configuration
  routeTableIds?: string[]; // Required for Gateway endpoints
  subnetIds?: string[]; // Required for Interface endpoints
  securityGroupIds?: string[]; // Optional for Interface endpoints
  
  // DNS Configuration
  privateDnsEnabled?: boolean; // Interface endpoints only
  
  // Policy Configuration
  policyDocument?: VpcEndpointPolicyDocument;
  
  // Service Configuration
  acceptanceRequired?: boolean;
  
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
  
  // AWS creation timestamp
  creationTimestamp?: Date;
}

// VPC Endpoint update DTO
export interface UpdateVpcEndpointDto extends UpdateDto, Partial<BusinessContext> {
  // State updates
  state?: NetworkResourceState;
  statusId?: string;
  
  // Network Configuration updates
  routeTableIds?: string[];
  subnetIds?: string[];
  securityGroupIds?: string[];
  
  // DNS Configuration updates
  privateDnsEnabled?: boolean;
  
  // Policy Configuration updates
  policyDocument?: VpcEndpointPolicyDocument;
  
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
  
  // Updated network interface IDs (computed)
  networkInterfaceIds?: string[];
}

// VPC Endpoint-specific filter interface
export interface VpcEndpointFilter extends NetworkResourceFilter {
  awsVpcEndpointId?: string;
  vpcId?: string;
  vpcEndpointType?: VpcEndpointType;
  serviceName?: string;
  serviceNamePattern?: string; // For pattern matching like 'com.amazonaws.*.s3'
  privateDnsEnabled?: boolean;
  acceptanceRequired?: boolean;
  hasRouteTableAssociations?: boolean;
  hasSubnetAssociations?: boolean;
  hasSecurityGroupAssociations?: boolean;
  hasPolicyDocument?: boolean;
  routeTableId?: string; // Filter by specific route table association
  subnetId?: string; // Filter by specific subnet association
  securityGroupId?: string; // Filter by specific security group association
}

// VPC Endpoint query parameters
export interface VpcEndpointQueryParams extends QueryParams {
  // VPC Endpoint-specific filters
  awsVpcEndpointId?: string;
  awsAccountId?: string;
  region?: string;
  vpcId?: string;
  state?: NetworkResourceState;
  vpcEndpointType?: VpcEndpointType;
  serviceName?: string;
  serviceNamePattern?: string;
  privateDnsEnabled?: boolean;
  acceptanceRequired?: boolean;
  routeTableId?: string;
  subnetId?: string;
  securityGroupId?: string;
  environment?: string;
  project?: string;
  owner?: string;
  
  // Date range filters
  createdAfter?: string; // ISO date string
  createdBefore?: string;
  lastSyncAfter?: string;
  lastSyncBefore?: string;
  creationTimestampAfter?: string;
  creationTimestampBefore?: string;
  
  // Search in name, description, serviceName, or tags
  search?: string;
  
  // Sorting options specific to VPC Endpoint
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'awsVpcEndpointId' | 'serviceName' | 'vpcEndpointType' | 'region' | 'lastSyncAt' | 'creationTimestamp';
  sortOrder?: 'ASC' | 'DESC';
}

// VPC Endpoint response DTO
export interface VpcEndpointResponseDto extends VpcEndpoint {
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
  
  // VPC information
  vpc?: {
    awsVpcId: string;
    name?: string;
    cidrBlock: string;
  };
  
  // Detailed route table associations
  routeTables?: VpcEndpointRouteTable[];
  
  // Detailed subnet associations
  subnets?: VpcEndpointSubnet[];
  
  // Detailed security group associations
  securityGroups?: VpcEndpointSecurityGroup[];
  
  // Service type classification
  serviceType?: VpcEndpointServiceType;
  
  // Cost and usage metrics (if available)
  monthlyDataTransferGB?: number;
  monthlyRequestCount?: number;
}

// VPC Endpoint list response
export interface VpcEndpointListResponseDto {
  vpcEndpoints: VpcEndpointResponseDto[];
  totalCount: number;
  filteredCount: number;
}

// VPC Endpoint creation response
export interface CreateVpcEndpointResponseDto {
  vpcEndpoint: VpcEndpointResponseDto;
  message: string;
}

// VPC Endpoint update response
export interface UpdateVpcEndpointResponseDto {
  vpcEndpoint: VpcEndpointResponseDto;
  message: string;
  changedFields?: string[];
}

// VPC Endpoint bulk operations
export interface BulkVpcEndpointOperation {
  operation: 'update' | 'delete' | 'sync';
  vpcEndpointIds: string[];
  updateData?: UpdateVpcEndpointDto;
}

export interface BulkVpcEndpointResponse {
  success: number;
  failed: number;
  errors?: Array<{
    vpcEndpointId: string;
    error: string;
  }>;
}

// VPC Endpoint synchronization from AWS
export interface VpcEndpointSyncDto {
  awsVpcEndpointId: string;
  awsAccountId: string;
  region: string;
  forceSync?: boolean;
}

export interface VpcEndpointSyncResponse {
  synced: VpcEndpointResponseDto;
  isNewRecord: boolean;
  changes?: Record<string, { from: any; to: any }>;
  syncTimestamp: Date;
}

// VPC Endpoint service discovery
export interface VpcEndpointService {
  serviceName: string;
  serviceType: VpcEndpointServiceType;
  acceptanceRequired: boolean;
  owner: string;
  supportedVpcEndpointTypes: VpcEndpointType[];
  availabilityZones?: string[];
  baseEndpointDnsNames?: string[];
  privateDnsNames?: string[];
  tags?: Record<string, string>;
}

// VPC Endpoint statistics
export interface VpcEndpointStats {
  totalCount: number;
  byType: Record<VpcEndpointType, number>;
  byRegion: Record<string, number>;
  byState: Record<NetworkResourceState, number>;
  byServiceType: Record<VpcEndpointServiceType, number>;
  topServices: Array<{
    serviceName: string;
    count: number;
  }>;
  withPrivateDns: number;
  withCustomPolicy: number;
}