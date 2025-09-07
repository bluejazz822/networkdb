import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import MainLayout from '@components/layout/MainLayout'
import Dashboard from '@pages/DashboardNew'
import NetworkDevices from '@pages/NetworkDevicesNew'
import VPCs from '@pages/VPCsNew'
import Subnets from '@pages/Subnets'
import TransitGateways from '@pages/TransitGateways'

// Mock user context for development
const mockUser = {
  id: '1',
  username: 'admin',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  isActive: true,
  roles: [{ name: 'admin' }],
  permissions: ['*'] // All permissions
}

function BypassApp() {
  return (
    <Router>
      <Routes>
        {/* Root redirect to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Dashboard */}
        <Route path="/dashboard" element={
          <Layout style={{ minHeight: '100vh' }}>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </Layout>
        } />
        
        {/* Network resources */}
        <Route path="/devices" element={
          <Layout style={{ minHeight: '100vh' }}>
            <MainLayout>
              <NetworkDevices />
            </MainLayout>
          </Layout>
        } />
        
        <Route path="/vpcs" element={
          <Layout style={{ minHeight: '100vh' }}>
            <MainLayout>
              <VPCs />
            </MainLayout>
          </Layout>
        } />
        
        <Route path="/subnets" element={
          <Layout style={{ minHeight: '100vh' }}>
            <MainLayout>
              <Subnets />
            </MainLayout>
          </Layout>
        } />
        
        <Route path="/transit-gateways" element={
          <Layout style={{ minHeight: '100vh' }}>
            <MainLayout>
              <TransitGateways />
            </MainLayout>
          </Layout>
        } />
        
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}

export default BypassApp