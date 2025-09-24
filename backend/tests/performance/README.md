# Performance Testing Suite

This directory contains comprehensive performance tests for the data-synchronization system, including load testing, memory usage validation, and performance benchmarking.

## Test Files

### Core Performance Tests
- **`workflow-performance.test.ts`** - Performance tests for WorkflowService, N8nService, and AlertService
- **`api-performance.test.ts`** - API endpoint performance validation
- **`memory-resource.test.ts`** - Memory usage and resource optimization tests

### Performance Monitoring
- **`benchmark-monitor.ts`** - Performance monitoring utilities and benchmark management
- **`benchmark-runner.test.ts`** - Benchmark establishment and regression detection

### Legacy Tests
- **`loadTesting.test.ts`** - Existing reporting system load tests

## Test Categories

### 1. Service Layer Performance
**File:** `workflow-performance.test.ts`

Tests the performance of core workflow services:
- WorkflowService operations (listing, dashboard metrics, execution history)
- N8nService operations (workflow discovery, connection management)
- AlertService operations (alert sending, history retrieval)
- Integrated workflow cycles

**Key Metrics:**
- Response times under various data sizes (50-500 workflows)
- Memory usage and leak detection
- Concurrent operation handling
- Resource cleanup validation

**SLAs:**
- Workflow listing: < 3 seconds
- Dashboard loading: < 5 seconds
- Alert delivery: < 8 seconds
- N8n discovery: < 10 seconds

### 2. API Endpoint Performance
**File:** `api-performance.test.ts`

Tests REST API performance:
- GET /api/workflows (listing with pagination and filtering)
- GET /api/workflows/status (dashboard metrics)
- GET /api/workflows/:id/executions (execution history)
- GET /api/workflows/:id/analytics (workflow analytics)
- POST /api/workflows/sync (workflow synchronization)
- GET /api/workflows/health (health checks)

**Key Metrics:**
- Response times under different loads
- Concurrent request handling
- Sustained load performance
- Error rates under stress

**SLAs:**
- Health checks: < 500ms
- Workflow operations: < 3-5 seconds
- Analytics: < 6 seconds
- Sync operations: < 15 seconds

### 3. Memory and Resource Management
**File:** `memory-resource.test.ts`

Tests memory usage and resource cleanup:
- Memory leak detection
- Resource handle management
- Concurrent processing validation
- Sustained load memory stability

**Key Metrics:**
- Memory growth rates
- Resource handle counts
- Garbage collection efficiency
- Memory stability under load

**Limits:**
- Memory increase: < 100-200MB for typical operations
- Resource handle growth: < 10-20 new handles
- Memory cleanup: > 30% reclamation after GC

### 4. Performance Benchmarking
**File:** `benchmark-monitor.ts` & `benchmark-runner.test.ts`

Establishes performance baselines and monitors regressions:
- Automated benchmark establishment
- Performance regression detection
- Historical performance tracking
- SLA validation

**Features:**
- Statistical performance analysis (P95, P99, averages)
- Benchmark persistence and loading
- Performance report generation
- Regression alert system

## Running Performance Tests

### Individual Test Suites
```bash
# Run workflow service performance tests
npm test -- tests/performance/workflow-performance.test.ts

# Run API performance tests
npm test -- tests/performance/api-performance.test.ts

# Run memory and resource tests
npm test -- tests/performance/memory-resource.test.ts

# Run benchmark suite
npm test -- tests/performance/benchmark-runner.test.ts
```

### All Performance Tests
```bash
npm test -- tests/performance/
```

### With Performance Monitoring
```bash
# Enable garbage collection for memory tests
node --expose-gc node_modules/.bin/jest tests/performance/
```

## Performance Data

### Benchmark Storage
Performance benchmarks are stored in:
```
tests/performance-data/
├── benchmarks.json          # Current performance benchmarks
└── reports/                 # Historical performance reports
    ├── comprehensive-benchmarks-[timestamp].json
    └── baseline-establishment-[timestamp].json
```

### Benchmark Structure
```json
{
  "operation": "workflow-list",
  "baseline": 850,
  "p95": 1200,
  "p99": 1500,
  "maxAcceptable": 2250,
  "memoryLimit": 104857600,
  "sampleSize": 25,
  "lastUpdated": "2024-09-24T..."
}
```

## Performance Requirements

### Response Time SLAs
| Operation | Target | Maximum |
|-----------|--------|---------|
| Health Check | < 500ms | < 1s |
| Workflow List | < 2s | < 3s |
| Dashboard Load | < 3s | < 5s |
| Execution History | < 3s | < 4s |
| Workflow Analytics | < 4s | < 6s |
| Alert Operations | < 5s | < 8s |
| N8n Discovery | < 7s | < 10s |
| Workflow Sync | < 10s | < 15s |

### Memory Requirements
| Operation Type | Limit | Cleanup |
|----------------|-------|---------|
| Light Operations | < 50MB | > 30% |
| Medium Operations | < 100MB | > 30% |
| Heavy Operations | < 200MB | > 30% |
| Concurrent Ops | < 150MB | > 30% |

### Concurrency Requirements
- Support 20+ concurrent API requests
- Handle 10+ concurrent workflow operations
- Maintain < 2s average response time under load
- Success rate > 80% under concurrent load

## Continuous Monitoring

### Automated Benchmarking
The benchmark suite can be integrated into CI/CD:
1. Run baseline establishment during setup
2. Execute performance validation on each build
3. Alert on performance regressions
4. Track performance trends over time

### Performance Alerts
The system will alert when:
- Response times exceed SLA by 30%
- Memory usage grows beyond limits
- Success rates drop below 80%
- Resource leaks are detected

## Test Environment Considerations

### Data Requirements
Performance tests create realistic test datasets:
- 50-500 workflows for various test scenarios
- 200-1000 executions for execution history tests
- 50-100 alerts for alert service tests

### External Dependencies
- N8n service connectivity (tests handle failures gracefully)
- Email service configuration (for alert tests)
- Database performance characteristics

### Hardware Considerations
Performance results may vary based on:
- Available memory and CPU
- Database performance (SQLite vs PostgreSQL)
- Network latency to external services
- Concurrent system load

## Troubleshooting

### Common Issues
1. **Memory tests failing**: Enable garbage collection with `--expose-gc`
2. **N8n tests timing out**: Expected if N8n service not available
3. **High variability**: Increase sample sizes in benchmark tests
4. **Resource leak alerts**: Check for unclosed database connections

### Debug Information
Performance tests log detailed metrics:
- Memory usage snapshots
- Response time percentiles
- Resource handle counts
- Error rates and types

### Performance Regression Analysis
When regressions are detected:
1. Check recent code changes
2. Compare with historical benchmarks
3. Analyze specific operation performance
4. Review memory usage patterns
5. Validate test environment stability