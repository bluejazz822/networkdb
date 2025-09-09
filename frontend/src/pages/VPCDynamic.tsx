/**
 * Dynamic VPC Page
 * 
 * Example of using the DynamicTable component
 * This demonstrates the new architecture where adding database columns
 * requires no frontend code changes
 */

import { CloudServerOutlined } from '@ant-design/icons'
import DynamicTable from '../components/DynamicTable'

export default function VPCDynamic() {
  return (
    <DynamicTable
      apiEndpoint="/api/vpcs"
      title="VPC Inventory"
      icon={<CloudServerOutlined />}
      autoRefresh={true}
      refreshInterval={30000}
    />
  )
}