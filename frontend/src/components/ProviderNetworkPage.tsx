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
        // Other providers return null to show empty state
        return null
      case 'subnets':
        // No data association needed for any providers yet
        return null
      case 'transit-gateways':
        // No data association needed for any providers yet
        return null
      case 'devices':
        // No data association needed for any providers yet
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
      'devices': 'Network Devices'
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