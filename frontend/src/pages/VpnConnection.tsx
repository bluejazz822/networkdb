/**
 * Dynamic VPN Connection Page
 *
 * Example of using the DynamicTable component
 * This demonstrates the new architecture where adding database columns
 * requires no frontend code changes
 */

import DynamicTable from '../components/DynamicTable'
import { LockOutlined } from '@ant-design/icons'

export default function VpnConnection() {
  return (
    <DynamicTable
      apiEndpoint="/api/vpnconnections"
      title="VPN Connection Management"
      icon={<LockOutlined />}
      autoRefresh={true}
      refreshInterval={30000}
    />
  )
}
