/**
 * Dynamic VPC Page
 * 
 * Example of using the DynamicTable component
 * This demonstrates the new architecture where adding database columns
 * requires no frontend code changes
 */

import DynamicTable from '../components/DynamicTable'
import { CloudServerOutlined } from '@ant-design/icons'

export default function VPCDynamic() {
  return (
    <DynamicTable 
      apiEndpoint="/api/vpcs"
      title="VPC Management"
      icon={<CloudServerOutlined />}
      autoRefresh={true}
      refreshInterval={30000}
    />
  )
}