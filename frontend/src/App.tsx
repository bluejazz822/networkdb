import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import MainLayout from '@components/layout/MainLayout'
import Dashboard from '@pages/DashboardNew'
import NetworkDevices from '@pages/NetworkDevicesNew'
import VPCs from '@pages/VPCsNew'
import Subnets from '@pages/Subnets'
import TransitGateways from '@pages/TransitGateways'

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/devices" element={<NetworkDevices />} />
            <Route path="/vpcs" element={<VPCs />} />
            <Route path="/subnets" element={<Subnets />} />
            <Route path="/transit-gateways" element={<TransitGateways />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </MainLayout>
      </Layout>
    </Router>
  )
}

export default App