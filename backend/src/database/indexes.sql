-- Database Indexing Strategy for AWS Network CMDB
-- Optimized for 100K+ records and <2 second response time
-- Based on actual schema: VPCs, Subnets, Transit Gateways, Customer Gateways, etc.
-- 
-- Performance Goals:
-- - AWS ID lookups: <100ms (exact matches)
-- - Region/Account filtering: <500ms
-- - Resource searches: <2 seconds
-- - Dashboard aggregations: <1 second
-- - Complex joins across resources: <3 seconds
--
-- Index Strategy:
-- 1. AWS identifier lookups (primary use case)
-- 2. Account/Region/Environment filtering
-- 3. Resource state and status queries
-- 4. Cross-resource relationship joins
-- 5. Time-based queries (sync, monitoring)
--
-- SCHEMA ANALYZED: Based on migrations 001-006 (VPCs, Subnets, TGWs, CGWs)

-- =============================================================================
-- PRIMARY KEY AND UNIQUE CONSTRAINTS
-- =============================================================================
-- Primary keys (UUIDs) are automatically indexed
-- Unique AWS identifiers are already indexed in migrations, documenting for completeness

-- VPCs table
-- UNIQUE INDEX: awsVpcId (already created in migration)

-- Subnets table  
-- UNIQUE INDEX: awsSubnetId (already created in migration)

-- Transit Gateways table
-- UNIQUE INDEX: awsTransitGatewayId (already created in migration)

-- Customer Gateways table
-- UNIQUE INDEX: awsCustomerGatewayId (already created in migration)

-- =============================================================================
-- AWS IDENTIFIER LOOKUPS (HIGHEST PRIORITY)
-- =============================================================================

-- These are the most frequent queries - AWS resource lookups by ID
-- Already created in migrations, but optimizing with additional covering indexes

-- VPC lookups with commonly selected fields
CREATE INDEX idx_vpcs_aws_id_covering ON vpcs (awsVpcId) 
  INCLUDE (name, cidrBlock, region, state, environment);

-- Subnet lookups with commonly selected fields  
CREATE INDEX idx_subnets_aws_id_covering ON subnets (awsSubnetId)
  INCLUDE (awsVpcId, cidrBlock, availabilityZone, state, subnetType);

-- Transit Gateway lookups with commonly selected fields
CREATE INDEX idx_tgws_aws_id_covering ON transit_gateways (awsTransitGatewayId)
  INCLUDE (state, description, defaultRouteTableAssociation, defaultRouteTablePropagation);

-- Customer Gateway lookups with commonly selected fields
CREATE INDEX idx_cgws_aws_id_covering ON customer_gateways (awsCustomerGatewayId)
  INCLUDE (state, type, ipAddress, bgpAsn, customerGatewayName);

-- =============================================================================
-- ACCOUNT AND REGION FILTERING (SECOND PRIORITY)
-- =============================================================================

-- Multi-tenant queries - filtering by AWS account and region
-- Already have basic indexes, adding composite indexes for common patterns

-- Account + Region combinations (very common dashboard query)
CREATE INDEX idx_vpcs_account_region ON vpcs (awsAccountId, region);
CREATE INDEX idx_subnets_account_region ON subnets (awsAccountId, region);
CREATE INDEX idx_tgws_account_region ON transit_gateways (awsAccountId, region);
CREATE INDEX idx_cgws_account_region ON customer_gateways (awsAccountId, region);

-- Region + State combinations (operational dashboards)
CREATE INDEX idx_vpcs_region_state ON vpcs (region, state);
CREATE INDEX idx_subnets_region_state ON subnets (region, state);
CREATE INDEX idx_tgws_region_state ON transit_gateways (region, state);
CREATE INDEX idx_cgws_region_state ON customer_gateways (region, state);

-- =============================================================================
-- TEMPORAL DATA OPTIMIZATION
-- =============================================================================

-- Sync and monitoring queries - very important for data freshness
-- All tables have commonFields: createdAt, updatedAt, lastSyncAt

-- Last sync queries for data freshness monitoring
CREATE INDEX idx_vpcs_last_sync ON vpcs (lastSyncAt DESC);
CREATE INDEX idx_subnets_last_sync ON subnets (lastSyncAt DESC); 
CREATE INDEX idx_tgws_last_sync ON transit_gateways (lastSyncAt DESC);
CREATE INDEX idx_cgws_last_sync ON customer_gateways (lastSyncAt DESC);

-- Created/Updated date ranges for reporting
CREATE INDEX idx_vpcs_created_at ON vpcs (createdAt);
CREATE INDEX idx_subnets_created_at ON subnets (createdAt);
CREATE INDEX idx_tgws_created_at ON transit_gateways (createdAt);
CREATE INDEX idx_cgws_created_at ON customer_gateways (createdAt);

-- Composite indexes for sync monitoring with status
CREATE INDEX idx_vpcs_state_sync ON vpcs (state, lastSyncAt);
CREATE INDEX idx_subnets_state_sync ON subnets (state, lastSyncAt);
CREATE INDEX idx_tgws_state_sync ON transit_gateways (state, lastSyncAt);
CREATE INDEX idx_cgws_state_sync ON customer_gateways (state, lastSyncAt);

-- =============================================================================
-- RELATIONSHIP AND JOIN OPTIMIZATION
-- =============================================================================

-- AWS resource relationships - critical for topology views

-- Subnet -> VPC relationships (most common join)
CREATE INDEX idx_subnets_vpc_id ON subnets (vpcId);
CREATE INDEX idx_subnets_aws_vpc_id ON subnets (awsVpcId);

-- Transit Gateway Attachment relationships
CREATE INDEX idx_tgw_attachments_tgw_id ON transit_gateway_attachments (transitGatewayId);
CREATE INDEX idx_tgw_attachments_vpc_id ON transit_gateway_attachments (vpcId);
CREATE INDEX idx_tgw_attachments_subnet_id ON transit_gateway_attachments (subnetId);

-- Cross-resource AWS ID lookups for topology mapping
CREATE INDEX idx_tgw_attachments_aws_tgw_id ON transit_gateway_attachments (awsTransitGatewayId);
CREATE INDEX idx_tgw_attachments_aws_vpc_id ON transit_gateway_attachments (awsVpcId);

-- Customer Gateway connections
CREATE INDEX idx_cgws_transit_gateway_id ON customer_gateways (transitGatewayId) WHERE transitGatewayId IS NOT NULL;

-- =============================================================================
-- DASHBOARD AND REPORTING OPTIMIZATION
-- =============================================================================

-- Environment-based filtering (common in enterprise dashboards)
CREATE INDEX idx_vpcs_environment_state ON vpcs (environment, state) WHERE environment IS NOT NULL;
CREATE INDEX idx_subnets_environment_state ON subnets (environment, state) WHERE environment IS NOT NULL;

-- Project-based filtering for resource ownership dashboards
CREATE INDEX idx_vpcs_project_environment ON vpcs (project, environment) WHERE project IS NOT NULL;
CREATE INDEX idx_subnets_project_environment ON subnets (project, environment) WHERE project IS NOT NULL;

-- Resource count aggregations (dashboard statistics)
CREATE INDEX idx_vpcs_account_env_state ON vpcs (awsAccountId, environment, state);
CREATE INDEX idx_subnets_account_env_type ON subnets (awsAccountId, environment, subnetType);

-- CIDR block searches (network planning queries)
CREATE INDEX idx_vpcs_cidr_block ON vpcs (cidrBlock);
CREATE INDEX idx_subnets_cidr_block ON subnets (cidrBlock);

-- Cost center reporting (if populated)
CREATE INDEX idx_vpcs_cost_center ON vpcs (costCenter) WHERE costCenter IS NOT NULL;
CREATE INDEX idx_subnets_cost_center ON subnets (costCenter) WHERE costCenter IS NOT NULL;

-- =============================================================================
-- PERFORMANCE MONITORING INDEXES
-- =============================================================================

-- Sync version tracking for data consistency monitoring
CREATE INDEX idx_vpcs_sync_version ON vpcs (syncVersion, lastSyncAt);
CREATE INDEX idx_subnets_sync_version ON subnets (syncVersion, lastSyncAt);

-- Source system tracking (if multiple sync sources)
CREATE INDEX idx_vpcs_source_system ON vpcs (sourceSystem, lastSyncAt);
CREATE INDEX idx_subnets_source_system ON subnets (sourceSystem, lastSyncAt);

-- Tag-based queries (JSON field optimization with expression indexes)
-- Note: These require MySQL 5.7+ with generated columns for optimal performance
-- CREATE INDEX idx_vpcs_name_tag ON vpcs ((JSON_UNQUOTE(JSON_EXTRACT(tags, '$.Name'))));
-- CREATE INDEX idx_subnets_name_tag ON subnets ((JSON_UNQUOTE(JSON_EXTRACT(tags, '$.Name'))));

-- =============================================================================
-- ADVANCED OPTIMIZATION INDEXES
-- =============================================================================

-- Partial indexes for active resources (most queries focus on available/active)
CREATE INDEX idx_vpcs_available ON vpcs (awsAccountId, region, name) WHERE state = 'available';
CREATE INDEX idx_subnets_available ON subnets (awsVpcId, availabilityZone) WHERE state = 'available';
CREATE INDEX idx_tgws_available ON transit_gateways (region, description) WHERE state = 'available';

-- Partial indexes for default VPCs (special case handling)
CREATE INDEX idx_vpcs_default ON vpcs (awsAccountId, region) WHERE isDefault = true;

-- High-selectivity covering indexes for list views
CREATE INDEX idx_vpcs_list_view ON vpcs (awsAccountId, region, state) 
  INCLUDE (awsVpcId, name, cidrBlock, environment, lastSyncAt);

CREATE INDEX idx_subnets_list_view ON subnets (awsAccountId, region, state)
  INCLUDE (awsSubnetId, awsVpcId, cidrBlock, availabilityZone, subnetType, availableIpAddressCount);

-- =============================================================================
-- INDEX MAINTENANCE PROCEDURES
-- =============================================================================

-- Regular index maintenance for optimal performance
-- DELIMITER $$
-- CREATE PROCEDURE OptimizeIndexes()
-- BEGIN
--   -- Analyze table statistics
--   ANALYZE TABLE network_devices;
--   ANALYZE TABLE network_connections;
--   ANALYZE TABLE device_monitoring;
--   
--   -- Check index usage and fragmentation
--   -- This will be enhanced with actual monitoring queries
-- END$$
-- DELIMITER ;

-- Index usage monitoring query
-- SELECT 
--   TABLE_NAME,
--   INDEX_NAME,
--   CARDINALITY,
--   LAST_UPDATE
-- FROM information_schema.STATISTICS 
-- WHERE TABLE_SCHEMA = DATABASE()
-- ORDER BY TABLE_NAME, INDEX_NAME;

-- =============================================================================
-- PERFORMANCE TESTING INDEXES
-- =============================================================================

-- Indexes specifically for performance testing scenarios

-- Large dataset testing
-- CREATE INDEX idx_test_bulk_operations ON network_devices (created_at, device_type);

-- Concurrent access testing  
-- CREATE INDEX idx_test_concurrent_reads ON network_devices (status, last_seen_at);

-- =============================================================================
-- CONFIGURATION AND SETTINGS
-- =============================================================================

-- MySQL configuration recommendations for index performance
-- (These are configuration suggestions, not SQL commands)

-- Key buffer size (for MyISAM indexes, if used)
-- SET GLOBAL key_buffer_size = 268435456; -- 256MB

-- InnoDB settings for optimal index performance
-- SET GLOBAL innodb_buffer_pool_size = 2147483648; -- 2GB (adjust based on available RAM)
-- SET GLOBAL innodb_buffer_pool_instances = 8;

-- Query cache settings (MySQL 5.7 and earlier)
-- SET GLOBAL query_cache_size = 67108864; -- 64MB
-- SET GLOBAL query_cache_type = ON;

-- =============================================================================
-- INDEX MONITORING AND ALERTING
-- =============================================================================

-- Query to monitor index usage efficiency
/*
SELECT 
  s.TABLE_NAME,
  s.INDEX_NAME,
  s.CARDINALITY,
  ROUND((s.CARDINALITY / t.TABLE_ROWS) * 100, 2) as 'SELECTIVITY_%'
FROM information_schema.STATISTICS s
JOIN information_schema.TABLES t ON s.TABLE_SCHEMA = t.TABLE_SCHEMA 
  AND s.TABLE_NAME = t.TABLE_NAME
WHERE s.TABLE_SCHEMA = DATABASE()
  AND s.CARDINALITY IS NOT NULL
  AND t.TABLE_ROWS > 0
ORDER BY SELECTIVITY_% DESC;
*/

-- Query to identify unused indexes
/*
SELECT 
  OBJECT_SCHEMA as 'DATABASE',
  OBJECT_NAME as 'TABLE',
  INDEX_NAME as 'INDEX'
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE INDEX_NAME IS NOT NULL
  AND COUNT_STAR = 0
  AND OBJECT_SCHEMA = DATABASE()
ORDER BY OBJECT_NAME, INDEX_NAME;
*/

-- =============================================================================
-- INDEX STRATEGY DOCUMENTATION
-- =============================================================================

/*
AWS NETWORK CMDB INDEX STRATEGY RATIONALE:

1. AWS IDENTIFIER LOOKUPS (HIGHEST PRIORITY):
   - awsVpcId, awsSubnetId, awsTransitGatewayId: Most frequent queries
   - Covering indexes include commonly selected fields
   - Target: <100ms response time

2. ACCOUNT/REGION FILTERING:
   - awsAccountId + region: Critical for multi-tenant environments  
   - region + state: Operational dashboards and monitoring
   - Target: <500ms response time

3. RELATIONSHIP JOINS:
   - subnet -> vpc relationships: Primary topology queries
   - transit gateway attachments: Cross-resource navigation
   - Foreign key indexes for efficient joins

4. TEMPORAL QUERIES:
   - lastSyncAt: Data freshness monitoring
   - createdAt/updatedAt: Historical analysis and reporting
   - Composite with state for operational queries

5. BUSINESS CONTEXT:
   - environment, project, costCenter: Enterprise filtering
   - Partial indexes where fields are sparsely populated
   - Dashboard aggregation optimization

6. ADVANCED OPTIMIZATIONS:
   - Partial indexes for active/available resources (80% of queries)
   - Covering indexes for list views reduce table scans
   - JSON tag extraction for AWS tag-based searches

MAINTENANCE SCHEDULE:
- Daily: Monitor slow query log for optimization opportunities
- Weekly: ANALYZE TABLE on main tables (vpcs, subnets, transit_gateways)
- Monthly: Review index usage statistics and unutilized indexes
- Quarterly: Evaluate query patterns and add new indexes
- Semi-annually: Full index strategy review and cleanup

PERFORMANCE TARGETS FOR 100K+ RECORDS:
- AWS ID lookups: <100ms
- Account/Region filters: <500ms  
- Complex joins: <1000ms
- Dashboard aggregations: <1000ms
- Full reports: <2000ms

INDEX SIZE MONITORING:
- Track index size growth (target: <50% of table size)
- Monitor index cardinality and selectivity
- Alert on indexes with low usage (<1% of queries)
- Regular cleanup of obsolete indexes from schema changes

AWS-SPECIFIC OPTIMIZATIONS:
- Prioritize state='available' resources (active infrastructure)
- Optimize for multi-region, multi-account queries
- Support CIDR block searches for network planning
- Enable fast topology traversal across resource relationships
*/