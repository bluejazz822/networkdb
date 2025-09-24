---
name: cloud-network-cmdb-reports
status: backlog
created: 2025-09-22T15:10:21Z
updated: 2025-09-22T15:39:26Z
progress: 0%
prd: .claude/prds/cloud-network-cmdb-reports.md
github: https://github.com/bluejazz822/networkdb/issues/27
---

# Epic: Cloud Network CMDB Reports

## Overview

Build a comprehensive reporting system for the multi-cloud VPC platform that leverages existing data synchronization infrastructure to generate automated inventory, compliance, and configuration drift reports. The solution will extend the current React dashboard with reporting capabilities and utilize the existing WorkflowService for scheduling, targeting 3,000+ network resources across 100+ cloud accounts with minimal architectural changes.

## Architecture Decisions

- **Leverage Existing Infrastructure**: Extend current database schema minimally, reuse WorkflowService for scheduling, integrate with React dashboard
- **Report Engine**: Build lightweight report generation service using existing Node.js/TypeScript stack
- **Export Strategy**: Server-side PDF generation with puppeteer, Excel exports with exceljs, leverage existing file storage
- **Data Access**: Create materialized views for performance, use existing database connection patterns
- **Scheduling**: Extend WorkflowService patterns for automated report generation
- **Security**: Reuse existing RBAC system with report-specific permissions

## Technical Approach

### Frontend Components
- **ReportBuilder Component**: Extend existing dashboard with report template selection and parameter configuration
- **ReportViewer Component**: Display generated reports with export options
- **ScheduledReports Component**: Manage automated report schedules using existing workflow UI patterns
- **State Management**: Use existing React patterns, no additional state management library needed

### Backend Services
- **ReportService**: Core report generation logic integrated with existing service architecture
- **ReportScheduler**: Wrapper around existing WorkflowService for automated execution
- **ExportService**: PDF/Excel/CSV generation using lightweight libraries
- **ReportDataService**: Optimized queries using materialized views and existing database patterns

### Database Extensions
```sql
-- Minimal schema additions
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  template_type VARCHAR(50) NOT NULL,
  parameters JSONB,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE report_executions (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id),
  status VARCHAR(20) DEFAULT 'pending',
  file_path VARCHAR(500),
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Performance optimization views
CREATE MATERIALIZED VIEW network_resource_summary AS
SELECT provider, region, resource_type, COUNT(*) as count,
       MAX(last_sync) as last_updated
FROM (
  SELECT 'AWS' as provider, region, 'VPC' as resource_type, last_sync FROM vpcs WHERE provider = 'AWS'
  UNION ALL
  SELECT 'AWS' as provider, region, 'Subnet' as resource_type, last_sync FROM subnets WHERE provider = 'AWS'
  -- Add other resources
) resources
GROUP BY provider, region, resource_type;
```

### Infrastructure
- **Deployment**: Integrate with existing Docker/container deployment
- **File Storage**: Use existing file storage patterns for generated reports
- **Background Processing**: Leverage existing WorkflowService infrastructure
- **Monitoring**: Extend existing observability with report-specific metrics

## Implementation Strategy

### Development Approach
- **Incremental Enhancement**: Build on existing codebase patterns rather than new architecture
- **Template-First**: Start with predefined report templates before building custom report builder
- **Progressive Enhancement**: Basic functionality first, advanced features in later iterations

### Risk Mitigation
- **Performance**: Use materialized views and pagination for large datasets
- **Data Quality**: Validate report data against existing synchronization status
- **User Adoption**: Maintain familiar UI patterns from existing dashboard

### Testing Approach
- **Unit Tests**: Report generation logic and data transformations
- **Integration Tests**: End-to-end report creation and export workflows
- **Performance Tests**: Large dataset handling and concurrent user scenarios

## Task Breakdown Preview

High-level task categories that will be created:
- [ ] **Database Schema**: Add reports tables and materialized views (1-2 days)
- [ ] **Report Engine Core**: Basic report generation and template system (3-4 days)
- [ ] **Export Services**: PDF, Excel, CSV generation capabilities (2-3 days)
- [ ] **Frontend Integration**: Dashboard components for report management (3-4 days)
- [ ] **Scheduling Integration**: Extend WorkflowService for automated reports (2 days)
- [ ] **Resource Relationship Mapping**: Cross-cloud dependency tracking (3-4 days)
- [ ] **Performance Optimization**: Query optimization and caching (1-2 days)
- [ ] **Security & Permissions**: Extend RBAC for report access (1-2 days)
- [ ] **Testing & Documentation**: Comprehensive test coverage (2-3 days)

## Dependencies

### External Dependencies
- **Stable Data Sync**: Reports depend on reliable data from existing synchronization platform
- **Email Service**: For automated report delivery (likely existing SMTP configuration)
- **File Storage**: Existing file storage system for report assets

### Internal Team Dependencies
- **Backend Team**: Database schema changes and service integration
- **Frontend Team**: React component development and dashboard integration
- **DevOps Team**: Deployment pipeline updates for new services

### Technical Dependencies
- **PostgreSQL**: Database performance for materialized views and complex queries
- **Node.js Libraries**: puppeteer (PDF), exceljs (Excel), existing React ecosystem
- **WorkflowService**: Scheduling and automation capabilities

## Success Criteria (Technical)

### Performance Benchmarks
- Standard reports (< 1,000 resources): Generated in < 30 seconds
- Large reports (< 10,000 resources): Generated in < 5 minutes
- Concurrent users: Support 3 simultaneous report generations without degradation
- Database impact: < 5% increase in database load during report generation

### Quality Gates
- 95%+ test coverage for report generation logic
- Zero data accuracy discrepancies compared to manual exports
- All reports must pass security validation (no sensitive data exposure)
- Performance regression tests pass for existing dashboard functionality

### Acceptance Criteria
- Generate all required operational and compliance report types
- Export to PDF, Excel, and CSV formats with proper formatting
- Automated scheduling with email delivery functionality
- Resource relationship mapping across all cloud providers
- Integration with existing user authentication and permissions

## Estimated Effort

### Overall Timeline
- **Phase 1 (Core Functionality)**: 6-8 weeks
  - Basic report generation and export capabilities
  - Dashboard integration with simple templates
  - Manual report execution

- **Phase 2 (Advanced Features)**: 2-4 weeks
  - Automated scheduling and delivery
  - Resource relationship mapping
  - Advanced filtering and customization

### Resource Requirements
- **1 Backend Developer**: Report services and database work
- **1 Frontend Developer**: Dashboard integration and UI components
- **0.5 DevOps Engineer**: Deployment and infrastructure updates

### Critical Path Items
1. Database schema design and materialized view optimization
2. Report engine core architecture and template system
3. Frontend integration with existing dashboard
4. Cross-cloud resource relationship mapping algorithm

**Total Estimated Effort**: 8-12 weeks with 2.5 FTE developers

## Tasks Created
- [ ] #28 - Database Schema & Migrations for Reports System (parallel: true)
- [ ] #29 - Report Data Service with Optimized Queries (parallel: false)
- [ ] #30 - Export Service Foundation (parallel: true)
- [ ] #31 - Report Engine Core (parallel: false)
- [ ] #32 - Report Scheduler Integration (parallel: false)
- [ ] #33 - Resource Relationship Mapping (parallel: true)
- [ ] #34 - Frontend Dashboard Integration (parallel: false)
- [ ] #35 - Security & Permissions (parallel: true)
- [ ] #36 - Testing & Documentation (parallel: false)

Total tasks: 9
Parallel tasks: 4
Sequential tasks: 5