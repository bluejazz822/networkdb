/**
 * Customer Gateway TypeScript interfaces and DTOs
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

// Customer Gateway type enum
export type CustomerGatewayType = 'ipsec.1';

// Physical location and contact information
export interface CustomerGatewayContactInfo {
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  siteLocation?: string | null;
  siteAddress?: string | null;
}

// Device information
export interface CustomerGatewayDeviceInfo {
  deviceName?: string | null;
  deviceModel?: string | null;
  deviceVendor?: string | null;
  deviceSoftwareVersion?: string | null;
}

// Operational information
export interface CustomerGatewayOperationalInfo {
  maintenanceWindow?: string | null;
  isPrimary: boolean; // Primary customer gateway for the site
  redundancyGroup?: string | null;
}

// Core Customer Gateway interface
export interface CustomerGateway extends AwsResource, BusinessContext {
  // AWS identifiers
  awsCustomerGatewayId: string;
  
  // Basic Configuration
  type: CustomerGatewayType;
  ipAddress: string; // Public IP address
  bgpAsn: number; // BGP Autonomous System Number
  
  // State information
  state: NetworkResourceState;
  
  // Device Configuration
  deviceName?: string | null;
  deviceModel?: string | null;
  deviceVendor?: string | null;
  deviceSoftwareVersion?: string | null;
  
  // Network Configuration
  insideIpv4NetworkCidr?: string | null;
  outsideIpAddress?: string | null;
  
  // Certificate-based Authentication
  certificateArn?: string | null;
  
  // Physical Location and Contact
  siteLocation?: string | null;
  siteAddress?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  
  // Operational Information
  maintenanceWindow?: string | null;
  isPrimary: boolean;
  redundancyGroup?: string | null;
}

// Customer Gateway creation DTO
export interface CreateCustomerGatewayDto extends CreateDto, BusinessContext {
  // AWS identifiers
  awsCustomerGatewayId: string;
  awsAccountId: string;
  region: string;
  regionId: string;
  statusId: string;
  
  // Basic Configuration
  type?: CustomerGatewayType;
  ipAddress: string;
  bgpAsn: number;
  
  // State - usually 'pending' for new CGWs
  state?: NetworkResourceState;
  
  // Device Configuration
  deviceName?: string;
  deviceModel?: string;
  deviceVendor?: string;
  deviceSoftwareVersion?: string;
  
  // Network Configuration
  insideIpv4NetworkCidr?: string;
  outsideIpAddress?: string;
  
  // Certificate-based Authentication
  certificateArn?: string;
  
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
  
  // Physical Location and Contact
  siteLocation?: string;
  siteAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  
  // Operational Information
  maintenanceWindow?: string;
  isPrimary?: boolean;
  redundancyGroup?: string;
}

// Customer Gateway update DTO
export interface UpdateCustomerGatewayDto extends UpdateDto, Partial<BusinessContext> {
  // Basic Configuration updates (IP and BGP ASN typically cannot be changed)
  // ipAddress and bgpAsn updates would require recreation in AWS
  
  // State updates
  state?: NetworkResourceState;
  statusId?: string;
  
  // Device Configuration updates
  deviceName?: string;
  deviceModel?: string;
  deviceVendor?: string;
  deviceSoftwareVersion?: string;
  
  // Network Configuration updates
  insideIpv4NetworkCidr?: string;
  outsideIpAddress?: string;
  
  // Certificate-based Authentication updates
  certificateArn?: string;
  
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
  
  // Physical Location and Contact updates
  siteLocation?: string;
  siteAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  
  // Operational Information updates
  maintenanceWindow?: string;
  isPrimary?: boolean;
  redundancyGroup?: string;
}

// Customer Gateway-specific filter interface
export interface CustomerGatewayFilter extends NetworkResourceFilter {
  awsCustomerGatewayId?: string;
  type?: CustomerGatewayType;
  ipAddress?: string;
  bgpAsn?: number;
  bgpAsnRange?: { min: number; max: number };
  siteLocation?: string;
  isPrimary?: boolean;
  redundancyGroup?: string;
  deviceVendor?: string;
  deviceModel?: string;
  hasInsideIpv4NetworkCidr?: boolean;
  hasOutsideIpAddress?: boolean;
  hasCertificateArn?: boolean;
  hasContactPerson?: boolean;
}

// Customer Gateway query parameters
export interface CustomerGatewayQueryParams extends QueryParams {
  // Customer Gateway-specific filters
  awsCustomerGatewayId?: string;
  awsAccountId?: string;
  region?: string;
  state?: NetworkResourceState;
  type?: CustomerGatewayType;
  ipAddress?: string;
  bgpAsn?: number;
  bgpAsnMin?: number;
  bgpAsnMax?: number;
  siteLocation?: string;
  isPrimary?: boolean;
  redundancyGroup?: string;
  deviceVendor?: string;
  deviceModel?: string;
  environment?: string;
  project?: string;
  owner?: string;
  
  // Date range filters
  createdAfter?: string; // ISO date string
  createdBefore?: string;
  lastSyncAfter?: string;
  lastSyncBefore?: string;
  
  // Search in name, description, siteLocation, or tags
  search?: string;
  
  // Sorting options specific to Customer Gateway
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'awsCustomerGatewayId' | 'ipAddress' | 'bgpAsn' | 'siteLocation' | 'region' | 'lastSyncAt';
  sortOrder?: 'ASC' | 'DESC';
}

// Customer Gateway response DTO
export interface CustomerGatewayResponseDto extends CustomerGateway {
  // Include computed or joined fields
  vpnConnectionCount?: number;
  
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
  
  // Grouped contact information for easier frontend handling
  contactInfo?: CustomerGatewayContactInfo;
  
  // Grouped device information
  deviceInfo?: CustomerGatewayDeviceInfo;
  
  // Grouped operational information
  operationalInfo?: CustomerGatewayOperationalInfo;
  
  // Related VPN connections
  vpnConnections?: Array<{
    vpnConnectionId: string;
    state: string;
    type: string;
  }>;
}

// Customer Gateway list response
export interface CustomerGatewayListResponseDto {
  customerGateways: CustomerGatewayResponseDto[];
  totalCount: number;
  filteredCount: number;
}

// Customer Gateway creation response
export interface CreateCustomerGatewayResponseDto {
  customerGateway: CustomerGatewayResponseDto;
  message: string;
}

// Customer Gateway update response
export interface UpdateCustomerGatewayResponseDto {
  customerGateway: CustomerGatewayResponseDto;
  message: string;
  changedFields?: string[];
}

// Customer Gateway bulk operations
export interface BulkCustomerGatewayOperation {
  operation: 'update' | 'delete' | 'sync';
  customerGatewayIds: string[];
  updateData?: UpdateCustomerGatewayDto; // For bulk updates
}

export interface BulkCustomerGatewayResponse {
  success: number;
  failed: number;
  errors?: Array<{
    customerGatewayId: string;
    error: string;
  }>;
}

// Customer Gateway synchronization from AWS
export interface CustomerGatewaySyncDto {
  awsCustomerGatewayId: string;
  awsAccountId: string;
  region: string;
  forceSync?: boolean;
}

export interface CustomerGatewaySyncResponse {
  synced: CustomerGatewayResponseDto;
  isNewRecord: boolean;
  changes?: Record<string, { from: any; to: any }>;
  syncTimestamp: Date;
}

// Customer Gateway site information for grouping
export interface CustomerGatewaySiteInfo {
  siteLocation: string;
  siteAddress?: string;
  customerGateways: CustomerGatewayResponseDto[];
  primaryGateway?: CustomerGatewayResponseDto;
  redundancyGroups: Record<string, CustomerGatewayResponseDto[]>;
}

// Customer Gateway statistics
export interface CustomerGatewayStats {
  totalCount: number;
  byRegion: Record<string, number>;
  byState: Record<NetworkResourceState, number>;
  bySiteLocation: Record<string, number>;
  byDeviceVendor: Record<string, number>;
  primaryGateways: number;
  withVpnConnections: number;
  redundancyGroupCount: number;
}