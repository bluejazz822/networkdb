/**
 * Dynamic Transit Gateway Attachment Page
 *
 * Example of using the DynamicTable component
 * This demonstrates the new architecture where adding database columns
 * requires no frontend code changes
 */

import DynamicTable from '../components/DynamicTable'
import { ClusterOutlined } from '@ant-design/icons'

export default function TransitGatewayAttachment() {
  return (
    <DynamicTable
      apiEndpoint="/api/transitgatewayattachments"
      title="Transit Gateway Attachment Management"
      icon={<ClusterOutlined />}
      autoRefresh={true}
      refreshInterval={30000}
    />
  )
}
