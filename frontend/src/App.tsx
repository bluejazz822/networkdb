import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import MainLayout from '@components/layout/MainLayout'
import Dashboard from '@pages/Dashboard'
import NetworkDevices from '@pages/NetworkDevices'
import VPCs from '@pages/VPCs'
import Subnets from '@pages/Subnets'
import TransitGateways from '@pages/TransitGateways'

const { Content } = Layout

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <MainLayout>
          <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 6 }}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/devices" element={<NetworkDevices />} />
              <Route path="/vpcs" element={<VPCs />} />
              <Route path="/subnets" element={<Subnets />} />
              <Route path="/transit-gateways" element={<TransitGateways />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Content>
        </MainLayout>
      </Layout>
    </Router>
  )
}

export default App