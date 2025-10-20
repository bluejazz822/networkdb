/**
 * Dynamic VPC Endpoint Page
 *
 * Example of using the DynamicTable component
 * This demonstrates the new architecture where adding database columns
 * requires no frontend code changes
 */

import DynamicTable from '../components/DynamicTable'
import { ApiOutlined } from '@ant-design/icons'

export default function VpcEndpointInfo() {
  return (
    <DynamicTable
      apiEndpoint="/api/vpcendpoints"
      title="VPC Endpoint Management"
      icon={<ApiOutlined />}
      autoRefresh={true}
      refreshInterval={30000}
    />
  )
}
