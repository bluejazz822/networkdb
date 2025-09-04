/**
 * Transit Gateway TypeScript interfaces and DTOs
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

// Transit Gateway configuration enums
export type TgwFeatureState = 'enable' | 'disable';
export type TransitGatewayType = 'hub' | 'spoke' | 'inspection';

// Transit Gateway CIDR block
export interface TransitGatewayCidrBlock {
  cidr: string;
  state: 'pending' | 'available' | 'deleting' | 'deleted' | 'failed';
}

// Core Transit Gateway interface
export interface TransitGateway extends AwsResource, BusinessContext {
  // AWS identifiers
  awsTransitGatewayId: string;
  
  // Basic information
  description?: string | null;
  
  // State information
  state: NetworkResourceState;
  
  // Configuration
  amazonSideAsn: number; // BGP ASN
  autoAcceptSharedAttachments: TgwFeatureState;
  defaultRouteTableAssociation: TgwFeatureState;
  defaultRouteTablePropagation: TgwFeatureState;
  dnsSupport: TgwFeatureState;
  multicast: TgwFeatureState;
  
  // Route Tables
  associationDefaultRouteTableId?: string | null;
  propagationDefaultRouteTableId?: string | null;
  
  // Transit Gateway CIDR Blocks
  transitGatewayCidrBlocks?: TransitGatewayCidrBlock[] | null;
  
  // Network Architecture
  transitGatewayType?: TransitGatewayType | null;
  isPrimary: boolean; // Primary transit gateway for the region
}

// Transit Gateway creation DTO
export interface CreateTransitGatewayDto extends CreateDto, BusinessContext {
  // AWS identifiers
  awsTransitGatewayId: string;
  awsAccountId: string;
  region: string;
  regionId: string;
  statusId: string;
  
  // Basic information
  description?: string;
  
  // State - usually 'pending' for new TGWs
  state?: NetworkResourceState;
  
  // Configuration
  amazonSideAsn: number;
  autoAcceptSharedAttachments?: TgwFeatureState;
  defaultRouteTableAssociation?: TgwFeatureState;
  defaultRouteTablePropagation?: TgwFeatureState;
  dnsSupport?: TgwFeatureState;
  multicast?: TgwFeatureState;
  
  // Route Tables
  associationDefaultRouteTableId?: string;
  propagationDefaultRouteTableId?: string;
  
  // Transit Gateway CIDR Blocks
  transitGatewayCidrBlocks?: TransitGatewayCidrBlock[];
  
  // Metadata
  tags?: Record<string, string>;
  name?: string;
  
  // Sync information
  sourceSystem?: string;
  lastSyncAt?: Date;
  syncVersion?: number;
  
  // Business context
  environment?: string;
  project?: string;
  costCenter?: string;
  owner?: string;
  
  // Network Architecture
  transitGatewayType?: TransitGatewayType;
  isPrimary?: boolean;
}

// Transit Gateway update DTO
export interface UpdateTransitGatewayDto extends UpdateDto, Partial<BusinessContext> {
  // Basic information updates
  description?: string;
  
  // State updates
  state?: NetworkResourceState;
  statusId?: string;
  
  // Configuration updates
  autoAcceptSharedAttachments?: TgwFeatureState;
  defaultRouteTableAssociation?: TgwFeatureState;
  defaultRouteTablePropagation?: TgwFeatureState;
  dnsSupport?: TgwFeatureState;
  multicast?: TgwFeatureState;
  
  // Route Tables updates
  associationDefaultRouteTableId?: string;
  propagationDefaultRouteTableId?: string;
  
  // Transit Gateway CIDR Blocks updates
  transitGatewayCidrBlocks?: TransitGatewayCidrBlock[];
  
  // Metadata updates
  tags?: Record<string, string>;
  name?: string;
  
  // Sync information updates
  lastSyncAt?: Date;
  syncVersion?: number;
  
  // Business context updates
  environment?: string;
  project?: string;
  costCenter?: string;
  owner?: string;
  
  // Network Architecture updates
  transitGatewayType?: TransitGatewayType;
  isPrimary?: boolean;
}

// Transit Gateway-specific filter interface
export interface TransitGatewayFilter extends NetworkResourceFilter {
  awsTransitGatewayId?: string;
  amazonSideAsn?: number;
  transitGatewayType?: TransitGatewayType;
  isPrimary?: boolean;
  autoAcceptSharedAttachments?: TgwFeatureState;
  defaultRouteTableAssociation?: TgwFeatureState;
  defaultRouteTablePropagation?: TgwFeatureState;
  dnsSupport?: TgwFeatureState;
  multicast?: TgwFeatureState;
  hasAssociationDefaultRouteTable?: boolean;
  hasPropagationDefaultRouteTable?: boolean;
}

// Transit Gateway query parameters
export interface TransitGatewayQueryParams extends QueryParams {
  // Transit Gateway-specific filters
  awsTransitGatewayId?: string;
  awsAccountId?: string;
  region?: string;
  state?: NetworkResourceState;
  amazonSideAsn?: number;
  transitGatewayType?: TransitGatewayType;
  isPrimary?: boolean;
  autoAcceptSharedAttachments?: TgwFeatureState;
  defaultRouteTableAssociation?: TgwFeatureState;
  defaultRouteTablePropagation?: TgwFeatureState;
  dnsSupport?: TgwFeatureState;
  multicast?: TgwFeatureState;
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
  
  // Sorting options specific to Transit Gateway
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'awsTransitGatewayId' | 'amazonSideAsn' | 'region' | 'lastSyncAt';
  sortOrder?: 'ASC' | 'DESC';
}

// Transit Gateway response DTO
export interface TransitGatewayResponseDto extends TransitGateway {
  // Include computed or joined fields
  attachmentCount?: number;
  routeTableCount?: number;
  
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
  
  // Related resources
  attachments?: {
    vpcAttachments: number;
    vpnAttachments: number;
    directConnectAttachments: number;
    peeringAttachments: number;
  };
}

// Transit Gateway list response
export interface TransitGatewayListResponseDto {
  transitGateways: TransitGatewayResponseDto[];
  totalCount: number;
  filteredCount: number;
}

// Transit Gateway creation response
export interface CreateTransitGatewayResponseDto {
  transitGateway: TransitGatewayResponseDto;
  message: string;
}

// Transit Gateway update response
export interface UpdateTransitGatewayResponseDto {
  transitGateway: TransitGatewayResponseDto;
  message: string;
  changedFields?: string[];
}

// Transit Gateway bulk operations
export interface BulkTransitGatewayOperation {
  operation: 'update' | 'delete' | 'sync';
  transitGatewayIds: string[];
  updateData?: UpdateTransitGatewayDto; // For bulk updates
}

export interface BulkTransitGatewayResponse {
  success: number;
  failed: number;
  errors?: Array<{
    transitGatewayId: string;
    error: string;
  }>;
}

// Transit Gateway synchronization from AWS
export interface TransitGatewaySyncDto {
  awsTransitGatewayId: string;
  awsAccountId: string;
  region: string;
  forceSync?: boolean;
}

export interface TransitGatewaySyncResponse {
  synced: TransitGatewayResponseDto;
  isNewRecord: boolean;
  changes?: Record<string, { from: any; to: any }>;
  syncTimestamp: Date;
}

// Transit Gateway attachment types for reference
export interface TransitGatewayAttachment {
  attachmentId: string;
  attachmentType: 'vpc' | 'vpn' | 'direct-connect-gateway' | 'peering';
  state: 'initiating' | 'pending-acceptance' | 'pending' | 'available' | 'modifying' | 'deleting' | 'deleted' | 'failed' | 'rejected' | 'rejecting';
  resourceId: string; // VPC ID, VPN ID, etc.
  resourceOwnerId?: string;
}

// Transit Gateway route table information
export interface TransitGatewayRouteTable {
  routeTableId: string;
  state: 'pending' | 'available' | 'deleting' | 'deleted' | 'failed';
  defaultAssociationRouteTable: boolean;
  defaultPropagationRouteTable: boolean;
  tags?: Record<string, string>;
}