import React, { useState } from 'react';
import { Tabs, Card, Modal, message } from 'antd';
import {
  DatabaseOutlined,
  NodeIndexOutlined,
  MonitorOutlined,
  LinkOutlined,
  PlusOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { ResourceListPage } from './ResourceListPage';
import { ResourceDetailPage } from './ResourceDetailPage';
import { NetworkTopologyView } from '../../components/network/NetworkTopologyView';
import { MonitoringDashboard } from '../../components/monitoring/MonitoringDashboard';
import { ResourceRelationshipManager } from '../../components/resources/ResourceRelationshipManager';
import { BulkOperationsPanel } from '../../components/resources/BulkOperationsPanel';
import { useNetworkManagement } from '../../hooks/useNetworkManagement';
import type { VPC } from '../../types';

const { TabPane } = Tabs;

type ViewMode = 'list' | 'detail' | 'topology' | 'monitoring' | 'relationships';

export const VpcManagementPage: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<ViewMode>('list');
  const [selectedVpc, setSelectedVpc] = useState<VPC | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [bulkOperationsVisible, setBulkOperationsVisible] = useState(false);

  // Hooks
  const {
    resources,
    selectedItems,
    hasSelection,
    refresh
  } = useNetworkManagement({ resourceType: 'vpc' });

  // Handle view VPC details
  const handleViewVpc = (vpc: VPC) => {
    setSelectedVpc(vpc);
    setActiveTab('detail');
  };

  // Handle edit VPC
  const handleEditVpc = (vpc: VPC) => {
    // TODO: Implement edit functionality
    message.info('Edit functionality will be implemented');
  };

  // Handle create new VPC
  const handleCreateVpc = () => {
    setCreateModalVisible(true);
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedVpc(null);
    setActiveTab('list');
  };

  // Handle bulk operations
  const handleBulkOperations = () => {
    if (!hasSelection) {
      message.warning('Please select VPCs to perform bulk operations');
      return;
    }
    setBulkOperationsVisible(true);
  };

  // Tab items
  const tabItems = [
    {
      key: 'list',
      label: (
        <span>
          <DatabaseOutlined />
          VPC List ({resources.length})
        </span>
      ),
      children: (
        <ResourceListPage
          resourceType=\"vpc\"
          title=\"Virtual Private Clouds (VPCs)\"
          description=\"Manage your AWS VPCs with advanced filtering, bulk operations, and detailed monitoring.\"
          onCreateNew={handleCreateVpc}
          onViewResource={handleViewVpc}
          onEditResource={handleEditVpc}
        />
      )
    },
    {
      key: 'topology',
      label: (
        <span>
          <NodeIndexOutlined />
          Network Topology
        </span>
      ),
      children: (
        <Card>
          <NetworkTopologyView
            selectedResourceTypes={['vpc']}
            onNodeClick={(node) => {
              const vpc = resources.find(r => r.id === node.id);
              if (vpc) handleViewVpc(vpc);
            }}
            height={700}
          />
        </Card>
      )
    },
    {
      key: 'monitoring',
      label: (
        <span>
          <MonitorOutlined />
          Monitoring
        </span>
      ),
      children: (
        <MonitoringDashboard
          resourceTypes={['vpc']}
          refreshInterval={30}
        />
      )
    },
    {
      key: 'relationships',
      label: (
        <span>
          <LinkOutlined />
          Relationships
        </span>
      ),
      children: (
        <ResourceRelationshipManager
          selectedResource={selectedVpc || undefined}
          onResourceSelect={(resource) => {
            if (resource && 'awsVpcId' in resource) {
              setSelectedVpc(resource as VPC);
            }
          }}
        />
      )
    }
  ];

  // If viewing details, show detail page instead of tabs
  if (activeTab === 'detail' && selectedVpc) {
    return (
      <ResourceDetailPage
        resourceType=\"vpc\"
        resourceId={selectedVpc.id}
        onEdit={handleEditVpc}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as ViewMode)}
        items={tabItems}
        tabBarExtraContent={{
          right: (
            hasSelection && (
              <div style={{ marginRight: '16px' }}>
                <span
                  style={{
                    cursor: 'pointer',
                    color: '#1890ff',
                    textDecoration: 'underline'
                  }}
                  onClick={handleBulkOperations}
                >
                  {selectedItems.length} selected - Click for bulk operations
                </span>
              </div>
            )
          )
        }}
      />

      {/* Create VPC Modal - Placeholder */}
      <Modal
        title=\"Create New VPC\"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => {
          // TODO: Implement VPC creation
          message.success('VPC creation functionality will be implemented');
          setCreateModalVisible(false);
        }}
        width={600}
      >
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <PlusOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
          <p>VPC creation form will be implemented here.</p>
          <p>Features will include:</p>
          <ul style={{ textAlign: 'left', display: 'inline-block' }}>
            <li>CIDR block configuration</li>
            <li>DNS settings</li>
            <li>Tenancy options</li>
            <li>Tag management</li>
            <li>AWS integration</li>
          </ul>
        </div>
      </Modal>

      {/* Bulk Operations Panel */}
      <BulkOperationsPanel
        resourceType=\"vpc\"
        selectedResources={selectedItems as VPC[]}
        visible={bulkOperationsVisible}
        onClose={() => setBulkOperationsVisible(false)}
        onComplete={() => {
          setBulkOperationsVisible(false);
          refresh();
        }}
      />
    </div>
  );
};