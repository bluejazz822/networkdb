/**
 * Dynamic NAT Gateway Page
 *
 * Example of using the DynamicTable component
 * This demonstrates the new architecture where adding database columns
 * requires no frontend code changes
 */

import DynamicTable from '../components/DynamicTable'
import { GlobalOutlined } from '@ant-design/icons'

export default function NatGateway() {
  return (
    <DynamicTable
      apiEndpoint="/api/natgateways"
      title="NAT Gateway Management"
      icon={<GlobalOutlined />}
      autoRefresh={true}
      refreshInterval={30000}
    />
  )
}
