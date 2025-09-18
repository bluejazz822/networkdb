---
name: data-synchronization
prd: data-synchronization
created: 2025-09-16T17:11:59Z
status: active
---

# Epic: Data Synchronization

## Overview

This epic implements comprehensive monitoring and management of n8n workflow executions that synchronize cloud network resources into the Network CMDB. The implementation adds a new "Data Synchronization" module to the CMDB's left navigation, providing real-time visibility into workflow status, execution history, and automated alerting for failed synchronizations.

## Architecture Decisions

### Frontend Architecture
- **Framework**: React TypeScript with Ant Design components (consistent with existing codebase)
- **Navigation Integration**: New menu item in MinimalApp.tsx following existing patterns
- **Component Structure**: Reuse DynamicTable pattern from existing network components
- **State Management**: React hooks for real-time updates and manual refresh functionality
- **Routing**: New route `/data-sync` added to existing React Router configuration

### Backend Architecture  
- **API Design**: RESTful endpoints following existing `/api/*` patterns
- **n8n Integration**: HTTP client service with retry logic and error handling
- **Database Layer**: New tables for workflow metadata and execution history
- **Service Layer**: Dedicated WorkflowService and AlertService modules
- **Security**: API key management through environment variables

### Database Schema
```sql
-- Workflow registry
CREATE TABLE workflow_registry (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workflow_id VARCHAR(255) UNIQUE NOT NULL,
  workflow_name VARCHAR(255) NOT NULL,
  workflow_type ENUM('vpc', 'subnet', 'transit_gateway', 'nat_gateway', 'vpn') NOT NULL,
  provider ENUM('aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others') NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Execution history  
CREATE TABLE workflow_executions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workflow_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) UNIQUE NOT NULL,
  status ENUM('success', 'failure', 'running', 'cancelled') NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NULL,
  duration_ms INT NULL,
  resources_created INT DEFAULT 0,
  resources_updated INT DEFAULT 0,
  resources_failed INT DEFAULT 0,
  error_message TEXT NULL,
  execution_data JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflow_registry(workflow_id) ON DELETE CASCADE
);

-- Alert tracking
CREATE TABLE workflow_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  execution_id VARCHAR(255) NOT NULL,
  alert_type ENUM('failure', 'success', 'manual_trigger') NOT NULL,
  recipients TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(execution_id) ON DELETE CASCADE
);
```

### n8n API Integration
- **Base URL**: http://172.16.30.60:5678/api/v1
- **Authentication**: API key via X-N8N-API-KEY header
- **Rate Limiting**: Maximum 10 requests per minute to prevent service degradation
- **Polling Strategy**: Hourly automated polling with manual refresh capability
- **Retry Logic**: Exponential backoff with maximum 3 retries for failed requests

## Implementation Strategy

### Phase 1: Core Infrastructure (Week 1)
1. Database schema creation and migration scripts
2. Backend service layer for n8n API integration  
3. Basic REST API endpoints for workflow data
4. Frontend navigation and routing setup

### Phase 2: Monitoring Dashboard (Week 2)
1. Workflow status display component
2. Real-time status updates and manual refresh
3. Historical execution data visualization
4. Manual trigger functionality with confirmation dialogs

### Phase 3: Alerting System (Week 3)
1. Email notification service integration
2. Alert configuration and recipient management
3. Alert history tracking and resolution status
4. Graceful degradation when SMTP unavailable

### Phase 4: Advanced Features (Week 4)
1. Historical trend analysis and reporting
2. Performance metrics and dashboard optimization
3. Export functionality for compliance reporting
4. Comprehensive error handling and user feedback

## Key Components

### Frontend Components
- `DataSyncPage.tsx` - Main dashboard container
- `WorkflowStatusGrid.tsx` - Workflow status display grid
- `WorkflowHistoryModal.tsx` - Detailed execution history
- `ManualSyncModal.tsx` - Manual trigger confirmation
- `AlertConfigModal.tsx` - Alert settings management

### Backend Services
- `WorkflowService.ts` - n8n API integration and workflow management
- `AlertService.ts` - Email notification and alert management  
- `PollingService.ts` - Automated hourly status checking
- `WorkflowController.ts` - REST API endpoints

### Database Models
- `WorkflowRegistry` - Workflow registration and metadata
- `WorkflowExecution` - Execution history and performance data
- `WorkflowAlert` - Alert tracking and resolution status

## Task Breakdown Preview

1. **Database Setup** - Create schema and migration scripts for workflow tracking
2. **n8n API Integration** - Implement service layer for workflow status polling  
3. **Backend API Development** - Create REST endpoints for workflow data management
4. **Frontend Navigation** - Add Data Synchronization menu item and routing
5. **Workflow Dashboard** - Build main dashboard with status grid and refresh controls
6. **Manual Trigger System** - Implement workflow execution triggers with user confirmation
7. **Email Alert Service** - Configure SMTP integration for failure notifications
8. **Historical Reporting** - Add execution history views and trend analysis
9. **Testing & Validation** - Comprehensive testing of all integration points
10. **Documentation & Deployment** - API documentation and production deployment guide

## Success Metrics

- **Monitoring Coverage**: 100% of n8n workflows registered and monitored
- **Alert Response Time**: 95% of failure alerts delivered within 5 minutes  
- **Dashboard Performance**: Page loads within 5 seconds, status updates within 30 seconds
- **Manual Sync Usage**: Trigger functionality used 10+ times per week
- **Data Freshness**: Average synchronization data age < 2 hours

## Risk Mitigation

- **n8n API Unavailability**: Graceful degradation with cached status display
- **Database Connection Issues**: Retry logic and connection pooling
- **SMTP Service Failures**: Dashboard-only notifications as fallback
- **Performance Impact**: Rate limiting and efficient polling strategies
- **Data Consistency**: Transaction management and rollback procedures

## Tasks Created

- [ ] #13 - Database Schema Setup for Workflow Monitoring (parallel: true)
- [ ] #14 - n8n API Integration Service (parallel: false)
- [ ] #15 - Workflow Data Management Service (parallel: false)
- [ ] #16 - REST API Endpoints for Workflow Management (parallel: false)
- [ ] #17 - Email Alert Service Integration (parallel: true)
- [ ] #18 - Automated Polling Service (parallel: false)
- [ ] #19 - Data Synchronization Navigation Integration (parallel: false)
- [ ] #20 - Workflow Status Dashboard Component (parallel: false)
- [ ] #21 - Historical Reporting and Analytics (parallel: true)
- [ ] #22 - Integration Testing and Production Deployment (parallel: false)

Total tasks: 10
Parallel tasks: 4
Sequential tasks: 6
Estimated total effort: 98 hours
