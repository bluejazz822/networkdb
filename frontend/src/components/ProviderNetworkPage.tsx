import { useParams } from 'react-router-dom'
import DynamicTable from './DynamicTable'
import { 
  AmazonOutlined,
  WindowsOutlined,
  AlipayOutlined,
  ApiOutlined,
  GoogleOutlined,
  CloudOutlined,
  GlobalOutlined
} from '@ant-design/icons'

interface ProviderNetworkPageProps {
  networkType: string
}

const providerConfig = {
  aws: {
    name: 'Amazon Web Services',
    icon: <AmazonOutlined />,
    color: '#FF9900'
  },
  azure: {
    name: 'Microsoft Azure',
    icon: <WindowsOutlined />,
    color: '#0078D4'
  },
  ali: {
    name: 'Alibaba Cloud',
    icon: <AlipayOutlined />,
    color: '#FF6A00'
  },
  oci: {
    name: 'Oracle Cloud Infrastructure',
    icon: <ApiOutlined />,
    color: '#F80000'
  },
  gcp: {
    name: 'Google Cloud Platform',
    icon: <GoogleOutlined />,
    color: '#4285F4'
  },
  huawei: {
    name: 'Huawei Cloud',
    icon: <CloudOutlined />,
    color: '#FF0000'
  },
  others: {
    name: 'Other Providers',
    icon: <GlobalOutlined />,
    color: '#722ED1'
  }
}

export default function ProviderNetworkPage({ networkType }: ProviderNetworkPageProps) {
  const { provider } = useParams<{ provider: string }>()
  
  if (!provider || !providerConfig[provider as keyof typeof providerConfig]) {
    return <div>Provider not found</div>
  }

  const config = providerConfig[provider as keyof typeof providerConfig]
  
  // Map network types to API endpoints and table names
  const getApiEndpoint = (networkType: string, provider: string) => {
    switch (networkType) {
      case 'vpcs':
        // All providers with data available
        const supportedVpcProviders = ['aws', 'ali', 'azure', 'huawei', 'oci', 'others']
        if (supportedVpcProviders.includes(provider)) {
          return `/api/vpcs/${provider}`
        }
        return null
      case 'loadbalancers':
        // Load balancers: AWS, Alibaba, Azure, Huawei, Oracle
        const supportedLbProviders = ['aws', 'ali', 'azure', 'huawei', 'oci']
        if (supportedLbProviders.includes(provider)) {
          return `/api/loadbalancers/${provider}`
        }
        return null
      case 'natgateways':
        // NAT Gateways: AWS, Alibaba, Azure, Huawei, Oracle
        const supportedNgwProviders = ['aws', 'ali', 'azure', 'huawei', 'oci']
        if (supportedNgwProviders.includes(provider)) {
          return `/api/natgateways/${provider}`
        }
        return null
      case 'vpnconnections':
        // VPN Connections: AWS, Alibaba, Azure, Huawei, Oracle
        const supportedVpnProviders = ['aws', 'ali', 'azure', 'huawei', 'oci']
        if (supportedVpnProviders.includes(provider)) {
          return `/api/vpnconnections/${provider}`
        }
        return null
      case 'transitgatewayattachments':
        // Transit Gateway Attachments: Support all providers
        const supportedTgwProviders = ['aws', 'azure', 'ali', 'oci', 'gcp', 'huawei', 'others']
        if (supportedTgwProviders.includes(provider)) {
          return `/api/transitgatewayattachments/${provider}`
        }
        return null
      case 'vpcendpoints':
        // VPC Endpoints (Private Link): Support all providers
        const supportedVpcEndpointProviders = ['aws', 'azure', 'ali', 'oci', 'gcp', 'huawei']
        if (supportedVpcEndpointProviders.includes(provider)) {
          return `/api/vpcendpoints/${provider}`
        }
        return null
      case 'subnets':
        return null
      case 'transit-gateways':
        return null
      case 'devices':
        return null
      default:
        return null
    }
  }

  const getTitle = (networkType: string) => {
    const networkTypeMap: { [key: string]: string } = {
      'vpcs': 'VPCs',
      'subnets': 'Subnets',
      'transit-gateways': 'Transit Gateways',
      'devices': 'Network Devices',
      'loadbalancers': 'Load Balancers',
      'natgateways': 'NAT Gateways',
      'vpnconnections': 'VPN Connections',
      'transitgatewayattachments': 'Transit Gateways',
      'vpcendpoints': 'Private Link'
    }

    return `${config.name} ${networkTypeMap[networkType] || networkType.toUpperCase()}`
  }

  const apiEndpoint = getApiEndpoint(networkType, provider)
  
  // Show placeholder for providers without data
  if (!apiEndpoint) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          {config.icon}
          <h2 style={{ margin: '0 0 0 8px' }}>{getTitle(networkType)}</h2>
        </div>
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#666',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <p>No data available for this provider yet.</p>
          <p>Data association will be configured in future updates.</p>
        </div>
      </div>
    )
  }

  return (
    <DynamicTable
      apiEndpoint={apiEndpoint}
      title={getTitle(networkType)}
      icon={config.icon}
      autoRefresh={true}
      refreshInterval={30000}
    />
  )
}