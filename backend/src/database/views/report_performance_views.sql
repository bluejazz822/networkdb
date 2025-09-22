-- =================================================================
-- Report Performance Materialized Views
-- MySQL 8.0 optimized views for common reporting patterns
-- =================================================================

-- =================================================================
-- 1. REPORTS SUMMARY VIEW
-- Aggregated view of reports with execution statistics
-- =================================================================
CREATE OR REPLACE VIEW mv_reports_summary AS
SELECT
    r.id,
    r.report_id,
    r.name,
    r.description,
    r.report_type,
    r.category,
    r.provider,
    r.is_active,
    r.is_public,
    r.created_by,
    r.created_at,
    r.updated_at,
    -- Execution statistics
    COALESCE(exec_stats.total_executions, 0) as total_executions,
    COALESCE(exec_stats.successful_executions, 0) as successful_executions,
    COALESCE(exec_stats.failed_executions, 0) as failed_executions,
    COALESCE(exec_stats.avg_duration_ms, 0) as avg_duration_ms,
    COALESCE(exec_stats.avg_records_processed, 0) as avg_records_processed,
    COALESCE(exec_stats.total_output_size_bytes, 0) as total_output_size_bytes,
    exec_stats.last_execution_time,
    exec_stats.last_execution_status,
    -- Success rate calculation
    CASE
        WHEN COALESCE(exec_stats.total_executions, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(exec_stats.successful_executions, 0) * 100.0) / exec_stats.total_executions, 2)
    END as success_rate_percent
FROM reports r
LEFT JOIN (
    SELECT
        re.report_id,
        COUNT(*) as total_executions,
        SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
        SUM(CASE WHEN re.status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
        AVG(re.duration_ms) as avg_duration_ms,
        AVG(re.records_processed) as avg_records_processed,
        SUM(re.output_size_bytes) as total_output_size_bytes,
        MAX(re.start_time) as last_execution_time,
        (SELECT status FROM report_executions WHERE report_id = re.report_id ORDER BY start_time DESC LIMIT 1) as last_execution_status
    FROM report_executions re
    WHERE re.start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)  -- Last 90 days
    GROUP BY re.report_id
) exec_stats ON r.report_id = exec_stats.report_id;

-- =================================================================
-- 2. DAILY EXECUTION METRICS VIEW
-- Daily aggregated execution metrics for trending analysis
-- =================================================================
CREATE OR REPLACE VIEW mv_daily_execution_metrics AS
SELECT
    DATE(re.start_time) as execution_date,
    re.report_id,
    r.name as report_name,
    r.report_type,
    r.category,
    r.provider,
    COUNT(*) as total_executions,
    SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN re.status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
    SUM(CASE WHEN re.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_executions,
    AVG(re.duration_ms) as avg_duration_ms,
    MIN(re.duration_ms) as min_duration_ms,
    MAX(re.duration_ms) as max_duration_ms,
    SUM(re.records_processed) as total_records_processed,
    SUM(re.output_size_bytes) as total_output_size_bytes,
    -- Success rate
    ROUND((SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 2) as success_rate_percent
FROM report_executions re
INNER JOIN reports r ON r.report_id = re.report_id
WHERE re.start_time IS NOT NULL
    AND re.start_time >= DATE_SUB(NOW(), INTERVAL 365 DAY)  -- Last year
GROUP BY
    DATE(re.start_time),
    re.report_id,
    r.name,
    r.report_type,
    r.category,
    r.provider;

-- =================================================================
-- 3. PROVIDER PERFORMANCE VIEW
-- Performance metrics aggregated by cloud provider
-- =================================================================
CREATE OR REPLACE VIEW mv_provider_performance AS
SELECT
    r.provider,
    COUNT(DISTINCT r.id) as total_reports,
    COUNT(DISTINCT CASE WHEN r.is_active = 1 THEN r.id END) as active_reports,
    COUNT(re.id) as total_executions,
    SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN re.status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
    AVG(re.duration_ms) as avg_duration_ms,
    SUM(re.records_processed) as total_records_processed,
    SUM(re.output_size_bytes) as total_output_size_bytes,
    -- Performance metrics
    ROUND((SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) * 100.0) / COUNT(re.id), 2) as success_rate_percent,
    ROUND(AVG(re.records_processed), 0) as avg_records_per_execution,
    ROUND(AVG(re.output_size_bytes), 0) as avg_output_size_per_execution
FROM reports r
LEFT JOIN report_executions re ON r.report_id = re.report_id
    AND re.start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)  -- Last 90 days
GROUP BY r.provider;

-- =================================================================
-- 4. CATEGORY PERFORMANCE VIEW
-- Performance metrics aggregated by report category
-- =================================================================
CREATE OR REPLACE VIEW mv_category_performance AS
SELECT
    r.category,
    COUNT(DISTINCT r.id) as total_reports,
    COUNT(DISTINCT CASE WHEN r.is_active = 1 THEN r.id END) as active_reports,
    COUNT(re.id) as total_executions,
    SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN re.status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
    AVG(re.duration_ms) as avg_duration_ms,
    SUM(re.records_processed) as total_records_processed,
    SUM(re.output_size_bytes) as total_output_size_bytes,
    -- Performance metrics
    ROUND((SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) * 100.0) / COUNT(re.id), 2) as success_rate_percent,
    ROUND(AVG(re.records_processed), 0) as avg_records_per_execution,
    ROUND(AVG(re.output_size_bytes), 0) as avg_output_size_per_execution
FROM reports r
LEFT JOIN report_executions re ON r.report_id = re.report_id
    AND re.start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)  -- Last 90 days
GROUP BY r.category;

-- =================================================================
-- 5. USER ACTIVITY VIEW
-- User activity and report usage patterns
-- =================================================================
CREATE OR REPLACE VIEW mv_user_activity AS
SELECT
    u.id as user_id,
    u.username,
    u.email,
    COUNT(DISTINCT r.id) as reports_created,
    COUNT(DISTINCT CASE WHEN r.is_active = 1 THEN r.id END) as active_reports_created,
    COUNT(re.id) as total_executions,
    SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN re.status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
    AVG(re.duration_ms) as avg_execution_duration_ms,
    SUM(re.records_processed) as total_records_processed,
    SUM(re.output_size_bytes) as total_output_size_bytes,
    MAX(re.start_time) as last_execution_time,
    -- Activity metrics
    ROUND((SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(re.id), 0), 2) as success_rate_percent,
    COUNT(DISTINCT DATE(re.start_time)) as active_days_count
FROM users u
LEFT JOIN reports r ON u.id = r.created_by
LEFT JOIN report_executions re ON u.id = re.started_by
    AND re.start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)  -- Last 90 days
GROUP BY u.id, u.username, u.email;

-- =================================================================
-- 6. RECENT EXECUTIONS VIEW
-- Recent execution history with enriched metadata
-- =================================================================
CREATE OR REPLACE VIEW mv_recent_executions AS
SELECT
    re.id,
    re.execution_id,
    re.report_id,
    r.name as report_name,
    r.report_type,
    r.category,
    r.provider,
    re.status,
    re.trigger_type,
    re.started_by,
    u.username as started_by_username,
    re.start_time,
    re.end_time,
    re.duration_ms,
    re.records_processed,
    re.output_size_bytes,
    re.output_location,
    re.created_at,
    -- Derived fields
    CASE
        WHEN re.duration_ms IS NULL THEN NULL
        WHEN re.duration_ms < 1000 THEN 'Fast'
        WHEN re.duration_ms < 10000 THEN 'Medium'
        WHEN re.duration_ms < 60000 THEN 'Slow'
        ELSE 'Very Slow'
    END as duration_category,
    CASE
        WHEN re.output_size_bytes IS NULL THEN NULL
        WHEN re.output_size_bytes < 1048576 THEN 'Small'  -- < 1MB
        WHEN re.output_size_bytes < 10485760 THEN 'Medium'  -- < 10MB
        WHEN re.output_size_bytes < 104857600 THEN 'Large'  -- < 100MB
        ELSE 'Very Large'
    END as output_size_category,
    TIMESTAMPDIFF(HOUR, re.created_at, NOW()) as hours_since_created
FROM report_executions re
INNER JOIN reports r ON r.report_id = re.report_id
LEFT JOIN users u ON u.id = re.started_by
WHERE re.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)  -- Last 30 days
ORDER BY re.created_at DESC;

-- =================================================================
-- 7. PERFORMANCE ALERTS VIEW
-- Identify performance issues and anomalies
-- =================================================================
CREATE OR REPLACE VIEW mv_performance_alerts AS
SELECT
    'LONG_RUNNING_EXECUTION' as alert_type,
    CONCAT('Execution ', re.execution_id, ' has been running for over 1 hour') as alert_message,
    'HIGH' as severity,
    re.execution_id as entity_id,
    re.report_id,
    r.name as report_name,
    re.started_by,
    re.start_time as alert_time,
    re.duration_ms,
    'report_execution' as entity_type
FROM report_executions re
INNER JOIN reports r ON r.report_id = re.report_id
WHERE re.status = 'running'
    AND re.start_time < DATE_SUB(NOW(), INTERVAL 1 HOUR)

UNION ALL

SELECT
    'HIGH_FAILURE_RATE' as alert_type,
    CONCAT('Report ', r.name, ' has high failure rate: ', failure_stats.failure_rate, '%') as alert_message,
    CASE
        WHEN failure_stats.failure_rate >= 80 THEN 'CRITICAL'
        WHEN failure_stats.failure_rate >= 50 THEN 'HIGH'
        ELSE 'MEDIUM'
    END as severity,
    r.report_id as entity_id,
    r.report_id,
    r.name as report_name,
    NULL as started_by,
    NOW() as alert_time,
    NULL as duration_ms,
    'report' as entity_type
FROM reports r
INNER JOIN (
    SELECT
        report_id,
        ROUND((SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 2) as failure_rate
    FROM report_executions
    WHERE start_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)  -- Last 7 days
    GROUP BY report_id
    HAVING COUNT(*) >= 5  -- At least 5 executions
        AND failure_rate >= 30  -- 30% or higher failure rate
) failure_stats ON r.report_id = failure_stats.report_id

UNION ALL

SELECT
    'NO_RECENT_EXECUTION' as alert_type,
    CONCAT('Report ', r.name, ' has not been executed recently') as alert_message,
    'LOW' as severity,
    r.report_id as entity_id,
    r.report_id,
    r.name as report_name,
    NULL as started_by,
    NOW() as alert_time,
    NULL as duration_ms,
    'report' as entity_type
FROM reports r
WHERE r.is_active = 1
    AND r.report_id NOT IN (
        SELECT DISTINCT report_id
        FROM report_executions
        WHERE start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    );

-- =================================================================
-- 8. EXECUTION TRENDS VIEW
-- Time-series data for trending analysis
-- =================================================================
CREATE OR REPLACE VIEW mv_execution_trends AS
SELECT
    DATE(re.start_time) as trend_date,
    HOUR(re.start_time) as trend_hour,
    COUNT(*) as total_executions,
    SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN re.status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
    AVG(re.duration_ms) as avg_duration_ms,
    SUM(re.records_processed) as total_records_processed,
    SUM(re.output_size_bytes) as total_output_size_bytes,
    COUNT(DISTINCT re.report_id) as unique_reports_executed,
    COUNT(DISTINCT re.started_by) as unique_users_active,
    -- Success rate
    ROUND((SUM(CASE WHEN re.status = 'completed' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 2) as success_rate_percent
FROM report_executions re
WHERE re.start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)  -- Last 90 days
    AND re.start_time IS NOT NULL
GROUP BY
    DATE(re.start_time),
    HOUR(re.start_time)
ORDER BY trend_date DESC, trend_hour DESC;