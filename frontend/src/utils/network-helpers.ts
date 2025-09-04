import type { 
  VPC, 
  TransitGateway, 
  CustomerGateway, 
  VpcEndpoint,
  ResourceRelationship,
  TopologyNode,
  TopologyEdge,
  NetworkResource
} from '../types';

/**
 * Network utility functions for resource management
 */

// Resource type guards
export const isVPC = (resource: any): resource is VPC => {
  return resource && typeof resource === 'object' && 'awsVpcId' in resource;
};

export const isTransitGateway = (resource: any): resource is TransitGateway => {
  return resource && typeof resource === 'object' && 'awsTgwId' in resource;
};

export const isCustomerGateway = (resource: any): resource is CustomerGateway => {
  return resource && typeof resource === 'object' && 'awsCgwId' in resource;
};

export const isVpcEndpoint = (resource: any): resource is VpcEndpoint => {
  return resource && typeof resource === 'object' && 'awsVpeId' in resource;
};

// Resource identification helpers
export const getResourceTypeFromId = (awsId: string): string | null => {
  if (awsId.startsWith('vpc-')) return 'vpc';
  if (awsId.startsWith('tgw-')) return 'transit-gateway';
  if (awsId.startsWith('cgw-')) return 'customer-gateway';
  if (awsId.startsWith('vpce-')) return 'vpc-endpoint';
  return null;
};

export const getAwsResourceId = (resource: NetworkResource): string => {
  if (isVPC(resource)) return resource.awsVpcId;
  if (isTransitGateway(resource)) return resource.awsTgwId;
  if (isCustomerGateway(resource)) return resource.awsCgwId;
  if (isVpcEndpoint(resource)) return resource.awsVpeId;
  return resource.id;
};

export const getResourceDisplayName = (resource: NetworkResource): string => {
  const awsId = getAwsResourceId(resource);
  return resource.name || awsId;
};

export const getResourceTypeLabel = (resourceType: string): string => {
  const labels = {
    'vpc': 'VPC',
    'transit-gateway': 'Transit Gateway',
    'customer-gateway': 'Customer Gateway',
    'vpc-endpoint': 'VPC Endpoint'
  };
  return labels[resourceType as keyof typeof labels] || resourceType;
};

// Status and health helpers
export const getResourceStatus = (resource: NetworkResource): {
  status: string;
  color: string;
  text: string;
} => {
  let status = '';
  
  if (isVPC(resource)) status = resource.state;
  else if (isTransitGateway(resource)) status = resource.state;
  else if (isCustomerGateway(resource)) status = resource.state;
  else if (isVpcEndpoint(resource)) status = resource.state;

  const statusConfig = {
    'available': { color: 'green', text: 'Available' },
    'pending': { color: 'orange', text: 'Pending' },
    'modifying': { color: 'blue', text: 'Modifying' },
    'deleting': { color: 'red', text: 'Deleting' },
    'deleted': { color: 'grey', text: 'Deleted' },
    'failed': { color: 'red', text: 'Failed' },
    'PendingAcceptance': { color: 'orange', text: 'Pending Acceptance' },
    'Rejected': { color: 'red', text: 'Rejected' },
    'Expired': { color: 'grey', text: 'Expired' }
  };

  return statusConfig[status as keyof typeof statusConfig] || { 
    color: 'default', 
    text: status || 'Unknown',
    status: status || 'unknown'
  };
};

export const getHealthStatusColor = (status: string): string => {
  const colors = {
    'healthy': 'green',
    'warning': 'orange',
    'critical': 'red',
    'unknown': 'grey'
  };
  return colors[status as keyof typeof colors] || 'grey';
};

// Network validation helpers
export const validateCIDR = (cidr: string): boolean => {
  const cidrRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
  if (!cidrRegex.test(cidr)) return false;
  
  const [ip, mask] = cidr.split('/');
  const maskNum = parseInt(mask, 10);
  
  if (maskNum < 0 || maskNum > 32) return false;
  
  const octets = ip.split('.').map(o => parseInt(o, 10));
  return octets.every(octet => octet >= 0 && octet <= 255);
};

export const validateIPAddress = (ip: string): boolean => {
  const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;
  
  const octets = ip.split('.').map(o => parseInt(o, 10));
  return octets.every(octet => octet >= 0 && octet <= 255);
};

export const validateASN = (asn: number): boolean => {
  return asn >= 1 && asn <= 4294967295; // 32-bit ASN range
};

export const isPrivateIP = (ip: string): boolean => {
  if (!validateIPAddress(ip)) return false;
  
  const octets = ip.split('.').map(o => parseInt(o, 10));
  const [a, b] = octets;
  
  // 10.0.0.0/8
  if (a === 10) return true;
  
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  
  return false;
};

// Filtering and search helpers
export const createResourceFilter = (field: string, value: any, operator = 'eq') => ({
  field,
  operator: operator as any,
  value,
  label: `${field} ${operator} ${value}`
});

export const buildQuickFilters = (resourceType: string) => {
  const baseFilters = [
    { label: 'Active', filter: createResourceFilter('state', 'available') },
    { label: 'Pending', filter: createResourceFilter('state', 'pending') },
    { label: 'This Week', filter: createResourceFilter('createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), 'gte') },
    { label: 'This Month', filter: createResourceFilter('createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), 'gte') }
  ];

  const typeSpecificFilters = {
    'vpc': [
      { label: 'Default VPCs', filter: createResourceFilter('isDefault', true) },
      { label: 'DNS Enabled', filter: createResourceFilter('enableDnsSupport', true) }
    ],
    'transit-gateway': [
      { label: 'Auto Accept', filter: createResourceFilter('autoAcceptSharedAttachments', true) },
      { label: 'DNS Support', filter: createResourceFilter('dnsSupport', 'enable') }
    ],
    'customer-gateway': [
      { label: 'IPsec.1', filter: createResourceFilter('type', 'ipsec.1') }
    ],
    'vpc-endpoint': [
      { label: 'Interface', filter: createResourceFilter('vpcEndpointType', 'Interface') },
      { label: 'Gateway', filter: createResourceFilter('vpcEndpointType', 'Gateway') }
    ]
  };

  return [
    ...baseFilters,
    ...(typeSpecificFilters[resourceType as keyof typeof typeSpecificFilters] || [])
  ];
};

// Topology helpers
export const createTopologyNode = (resource: NetworkResource): TopologyNode => {
  const resourceType = getResourceTypeFromId(getAwsResourceId(resource)) || 'unknown';
  const status = getResourceStatus(resource);
  
  return {
    id: resource.id,
    type: resourceType as any,
    label: getResourceDisplayName(resource),
    properties: {
      awsId: getAwsResourceId(resource),
      region: (resource as any).region,
      state: status.status,
      ...resource
    },
    status: 'healthy' // TODO: Map from actual health data
  };
};

export const findResourceRelationships = (
  resources: NetworkResource[],
  relationships: ResourceRelationship[]
): TopologyEdge[] => {
  return relationships
    .filter(rel => 
      resources.some(r => r.id === rel.sourceId) &&
      resources.some(r => r.id === rel.targetId)
    )
    .map(rel => ({
      id: rel.id,
      source: rel.sourceId,
      target: rel.targetId,
      type: rel.relationshipType as any,
      label: rel.relationshipType.replace('_', ' '),
      properties: rel.metadata || {},
      status: 'active'
    }));
};

// Resource comparison helpers
export const compareResources = (a: NetworkResource, b: NetworkResource, field: string): number => {
  const aValue = (a as any)[field];
  const bValue = (b as any)[field];
  
  if (aValue === bValue) return 0;
  if (aValue == null) return 1;
  if (bValue == null) return -1;
  
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return aValue.localeCompare(bValue);
  }
  
  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return aValue - bValue;
  }
  
  if (aValue instanceof Date && bValue instanceof Date) {
    return aValue.getTime() - bValue.getTime();
  }
  
  return String(aValue).localeCompare(String(bValue));
};

export const sortResources = (
  resources: NetworkResource[], 
  field: string, 
  order: 'asc' | 'desc' = 'asc'
): NetworkResource[] => {
  return [...resources].sort((a, b) => {
    const result = compareResources(a, b, field);
    return order === 'asc' ? result : -result;
  });
};

// Export helpers
export const prepareResourceForExport = (resource: NetworkResource) => {
  const baseFields = {
    id: resource.id,
    name: resource.name,
    awsId: getAwsResourceId(resource),
    region: (resource as any).region,
    state: getResourceStatus(resource).status,
    environment: resource.environment,
    project: resource.project,
    costCenter: resource.costCenter,
    owner: resource.owner,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt
  };

  // Add type-specific fields
  if (isVPC(resource)) {
    return {
      ...baseFields,
      cidrBlock: resource.cidrBlock,
      isDefault: resource.isDefault,
      instanceTenancy: resource.instanceTenancy,
      enableDnsSupport: resource.enableDnsSupport,
      enableDnsHostnames: resource.enableDnsHostnames
    };
  }

  if (isTransitGateway(resource)) {
    return {
      ...baseFields,
      amazonSideAsn: resource.amazonSideAsn,
      autoAcceptSharedAttachments: resource.autoAcceptSharedAttachments,
      defaultRouteTableAssociation: resource.defaultRouteTableAssociation,
      defaultRouteTablePropagation: resource.defaultRouteTablePropagation,
      dnsSupport: resource.dnsSupport
    };
  }

  if (isCustomerGateway(resource)) {
    return {
      ...baseFields,
      bgpAsn: resource.bgpAsn,
      ipAddress: resource.ipAddress,
      type: resource.type,
      deviceName: resource.deviceName
    };
  }

  if (isVpcEndpoint(resource)) {
    return {
      ...baseFields,
      serviceName: resource.serviceName,
      vpcEndpointType: resource.vpcEndpointType,
      vpcId: resource.vpcId,
      privateDnsEnabled: resource.privateDnsEnabled
    };
  }

  return baseFields;
};

// Color and styling helpers
export const getResourceTypeColor = (resourceType: string): string => {
  const colors = {
    'vpc': '#1890ff',
    'transit-gateway': '#52c41a',
    'customer-gateway': '#faad14',
    'vpc-endpoint': '#eb2f96'
  };
  return colors[resourceType as keyof typeof colors] || '#666666';
};

export const getRegionColor = (region: string): string => {
  // Generate consistent colors for regions
  const hash = region.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
};

// AWS region helpers
export const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ca-central-1', 'sa-east-1'
];

export const getRegionDisplayName = (region: string): string => {
  const regionNames: Record<string, string> = {
    'us-east-1': 'N. Virginia',
    'us-east-2': 'Ohio',
    'us-west-1': 'N. California',
    'us-west-2': 'Oregon',
    'eu-west-1': 'Ireland',
    'eu-west-2': 'London',
    'eu-west-3': 'Paris',
    'eu-central-1': 'Frankfurt',
    'ap-southeast-1': 'Singapore',
    'ap-southeast-2': 'Sydney',
    'ap-northeast-1': 'Tokyo',
    'ap-northeast-2': 'Seoul',
    'ca-central-1': 'Canada Central',
    'sa-east-1': 'São Paulo'
  };
  
  return regionNames[region] || region;
};