import React, { useState } from 'react';
import { Tabs, Card, Modal, message } from 'antd';
import {
  DatabaseOutlined,
  NodeIndexOutlined,
  MonitorOutlined,
  LinkOutlined,
  PlusOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import { ResourceListPage } from './ResourceListPage';
import { ResourceDetailPage } from './ResourceDetailPage';
import { NetworkTopologyView } from '../../components/network/NetworkTopologyView';
import { MonitoringDashboard } from '../../components/monitoring/MonitoringDashboard';
import { ResourceRelationshipManager } from '../../components/resources/ResourceRelationshipManager';
import { BulkOperationsPanel } from '../../components/resources/BulkOperationsPanel';
import { useNetworkManagement } from '../../hooks/useNetworkManagement';
import type { TransitGateway } from '../../types';

const { TabPane } = Tabs;

type ViewMode = 'list' | 'detail' | 'topology' | 'monitoring' | 'relationships';

export const TransitGatewayManagementPage: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<ViewMode>('list');
  const [selectedTgw, setSelectedTgw] = useState<TransitGateway | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [bulkOperationsVisible, setBulkOperationsVisible] = useState(false);

  // Hooks
  const {
    resources,
    selectedItems,
    hasSelection,
    refresh
  } = useNetworkManagement({ resourceType: 'transit-gateway' });

  // Handle view TGW details
  const handleViewTgw = (tgw: TransitGateway) => {
    setSelectedTgw(tgw);
    setActiveTab('detail');
  };

  // Handle edit TGW
  const handleEditTgw = (tgw: TransitGateway) => {
    // TODO: Implement edit functionality
    message.info('Edit functionality will be implemented');
  };

  // Handle create new TGW
  const handleCreateTgw = () => {
    setCreateModalVisible(true);
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedTgw(null);
    setActiveTab('list');
  };

  // Handle bulk operations
  const handleBulkOperations = () => {
    if (!hasSelection) {
      message.warning('Please select Transit Gateways to perform bulk operations');
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
          Transit Gateways ({resources.length})
        </span>
      ),
      children: (
        <ResourceListPage
          resourceType=\"transit-gateway\"
          title=\"AWS Transit Gateways\"
          description=\"Manage your AWS Transit Gateways with advanced routing, attachment monitoring, and cross-region connectivity.\"
          onCreateNew={handleCreateTgw}
          onViewResource={handleViewTgw}
          onEditResource={handleEditTgw}
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
            selectedResourceTypes={['transit-gateway', 'vpc', 'customer-gateway']}
            onNodeClick={(node) => {
              const tgw = resources.find(r => r.id === node.id);
              if (tgw) handleViewTgw(tgw);
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
          Performance Monitoring
        </span>
      ),
      children: (
        <MonitoringDashboard
          resourceTypes={['transit-gateway']}
          refreshInterval={30}
        />
      )
    },
    {
      key: 'relationships',
      label: (
        <span>
          <LinkOutlined />
          Attachments & Routes
        </span>
      ),
      children: (
        <ResourceRelationshipManager
          selectedResource={selectedTgw || undefined}
          onResourceSelect={(resource) => {
            if (resource && 'awsTgwId' in resource) {
              setSelectedTgw(resource as TransitGateway);
            }
          }}
        />
      )
    }
  ];

  // If viewing details, show detail page instead of tabs
  if (activeTab === 'detail' && selectedTgw) {
    return (
      <ResourceDetailPage
        resourceType=\"transit-gateway\"
        resourceId={selectedTgw.id}
        onEdit={handleEditTgw}
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

      {/* Create Transit Gateway Modal - Placeholder */}
      <Modal
        title=\"Create New Transit Gateway\"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => {
          // TODO: Implement TGW creation
          message.success('Transit Gateway creation functionality will be implemented');
          setCreateModalVisible(false);
        }}
        width={600}
      >
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <BranchesOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
          <p>Transit Gateway creation form will be implemented here.</p>
          <p>Features will include:</p>
          <ul style={{ textAlign: 'left', display: 'inline-block' }}>
            <li>Amazon Side ASN configuration</li>
            <li>Auto-accept shared attachments</li>
            <li>Default route table settings</li>
            <li>DNS and multicast support</li>
            <li>Cross-region peering setup</li>
            <li>Tag management</li>
          </ul>
        </div>
      </Modal>

      {/* Bulk Operations Panel */}
      <BulkOperationsPanel
        resourceType=\"transit-gateway\"
        selectedResources={selectedItems as TransitGateway[]}
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