-- Database Indexing Strategy for Network CMDB
-- Optimized for 100K+ records and <2 second response time
-- 
-- Performance Goals:
-- - Search operations: <2 seconds
-- - Filter operations: <1 second  
-- - Complex joins: <3 seconds
-- - Dashboard queries: <1 second
--
-- Index Strategy:
-- 1. Primary lookups (exact matches)
-- 2. Search operations (LIKE queries)
-- 3. Range queries (date ranges, numeric ranges)
-- 4. Join optimization
-- 5. Composite indexes for complex queries
--
-- NOTE: This template will be customized based on actual schema from Stream A

-- =============================================================================
-- PRIMARY KEY AND UNIQUE CONSTRAINTS
-- =============================================================================
-- Primary keys are automatically indexed, but documenting for completeness

-- Example: Network devices table (to be updated with actual schema)
-- ALTER TABLE network_devices ADD PRIMARY KEY (device_id);
-- ALTER TABLE network_devices ADD UNIQUE KEY uk_device_hostname (hostname);

-- =============================================================================
-- SEARCH AND LOOKUP OPTIMIZATION INDEXES
-- =============================================================================

-- Common CMDB search patterns - will be customized based on actual schema

-- Device/Asset search indexes
-- CREATE INDEX idx_devices_hostname ON network_devices (hostname);
-- CREATE INDEX idx_devices_ip_address ON network_devices (ip_address);
-- CREATE INDEX idx_devices_mac_address ON network_devices (mac_address);
-- CREATE INDEX idx_devices_serial_number ON network_devices (serial_number);
-- CREATE INDEX idx_devices_asset_tag ON network_devices (asset_tag);

-- Text search optimization for device names and descriptions
-- CREATE FULLTEXT INDEX ft_devices_search ON network_devices (hostname, description, model);

-- Status and type filtering (frequently used in dashboards)
-- CREATE INDEX idx_devices_status ON network_devices (status);
-- CREATE INDEX idx_devices_type ON network_devices (device_type);
-- CREATE INDEX idx_devices_location ON network_devices (location_id);

-- =============================================================================
-- TEMPORAL DATA OPTIMIZATION
-- =============================================================================

-- Date range queries for monitoring and reporting
-- CREATE INDEX idx_devices_created_at ON network_devices (created_at);
-- CREATE INDEX idx_devices_updated_at ON network_devices (updated_at);
-- CREATE INDEX idx_devices_last_seen ON network_devices (last_seen_at);

-- Composite index for date range queries with status
-- CREATE INDEX idx_devices_status_updated ON network_devices (status, updated_at);
-- CREATE INDEX idx_devices_type_created ON network_devices (device_type, created_at);

-- =============================================================================
-- RELATIONSHIP AND JOIN OPTIMIZATION
-- =============================================================================

-- Foreign key indexes for efficient joins
-- CREATE INDEX idx_devices_location_id ON network_devices (location_id);
-- CREATE INDEX idx_devices_subnet_id ON network_devices (subnet_id);
-- CREATE INDEX idx_devices_vlan_id ON network_devices (vlan_id);

-- Network topology relationships
-- CREATE INDEX idx_connections_source_device ON network_connections (source_device_id);
-- CREATE INDEX idx_connections_target_device ON network_connections (target_device_id);
-- CREATE INDEX idx_connections_port ON network_connections (source_port, target_port);

-- =============================================================================
-- DASHBOARD AND REPORTING OPTIMIZATION
-- =============================================================================

-- Composite indexes for common dashboard queries
-- CREATE INDEX idx_devices_status_type_location ON network_devices (status, device_type, location_id);
-- CREATE INDEX idx_devices_location_status ON network_devices (location_id, status);

-- Aggregation optimization
-- CREATE INDEX idx_devices_type_status ON network_devices (device_type, status);

-- =============================================================================
-- PERFORMANCE MONITORING INDEXES
-- =============================================================================

-- Indexes for monitoring data (if separate from main device table)
-- CREATE INDEX idx_monitoring_device_timestamp ON device_monitoring (device_id, timestamp);
-- CREATE INDEX idx_monitoring_metric_name ON device_monitoring (metric_name, timestamp);

-- Alert and event indexes
-- CREATE INDEX idx_alerts_device_created ON device_alerts (device_id, created_at);
-- CREATE INDEX idx_alerts_severity_status ON device_alerts (severity, status);

-- =============================================================================
-- ADVANCED OPTIMIZATION INDEXES
-- =============================================================================

-- Partial indexes for active/online devices (if status-based queries are frequent)
-- CREATE INDEX idx_devices_active ON network_devices (hostname, ip_address) WHERE status = 'active';
-- CREATE INDEX idx_devices_online ON network_devices (device_type, location_id) WHERE status IN ('online', 'active');

-- Covering indexes for read-heavy operations
-- CREATE INDEX idx_devices_list_covering ON network_devices (device_type, status) 
--   INCLUDE (hostname, ip_address, location_id, updated_at);

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
INDEX STRATEGY RATIONALE:

1. PRIMARY LOOKUPS:
   - hostname, ip_address, mac_address: Most common search fields
   - Unique constraints prevent duplicates
   - Single column indexes for exact matches

2. COMPOSITE INDEXES:
   - status + type + location: Common dashboard filter combination
   - device_type + created_at: Reporting queries with date ranges
   - Leftmost prefix principle applied

3. FULLTEXT INDEXES:
   - Enable fast text search across multiple columns
   - Support for natural language search in descriptions

4. PARTIAL INDEXES:
   - Focus on active/online devices (most queried subset)
   - Reduce index size and improve performance

5. COVERING INDEXES:
   - Include frequently selected columns
   - Reduce need for table lookups

MAINTENANCE SCHEDULE:
- Weekly: ANALYZE TABLE on main tables
- Monthly: Review index usage statistics
- Quarterly: Evaluate new index opportunities
- Annually: Full index strategy review

PERFORMANCE TARGETS:
- Simple lookups: <100ms
- Complex searches: <500ms  
- Dashboard queries: <1000ms
- Reports: <2000ms

INDEX SIZE MONITORING:
- Track index size growth
- Monitor index fragmentation
- Alert on unused indexes
- Regular cleanup of obsolete indexes
*/