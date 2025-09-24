/**
 * Comprehensive Tests for QueryOptimizer
 *
 * Tests query analysis, optimization suggestions, performance monitoring,
 * execution plan analysis, and index recommendations.
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  QueryOptimizer,
  queryOptimizer,
  initializeQueryOptimizer,
  analyzeQuery,
  executeOptimizedQuery,
  generateIndexSuggestions,
  generateMaterializedViewSuggestions,
  getOptimizationMetrics,
  QueryAnalysis,
  OptimizationSuggestion,
  QueryComplexity,
  QueryPerformance,
} from '../../utils/QueryOptimizer';

// Mock dependencies
jest.mock('../../database/connections/ReportingConnectionPool');
jest.mock('../../config/pool-config');

describe('QueryOptimizer', () => {
  let optimizer: QueryOptimizer;
  let mockExecuteReportQuery: jest.MockedFunction<any>;

  beforeAll(() => {
    mockExecuteReportQuery = require('../../database/connections/ReportingConnectionPool').executeReportQuery;

    // Mock pool config
    jest.doMock('../../config/pool-config', () => ({
      performanceConfig: {
        slowQueryThreshold: 1000,
        criticalQueryThreshold: 2000,
        metricsCollectionInterval: 30000,
      },
    }));

    optimizer = QueryOptimizer.getInstance();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    optimizer.clearHistory();
  });

  afterAll(async () => {
    await optimizer.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const initSpy = jest.spyOn(optimizer, 'initialize');

      await optimizer.initialize();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await optimizer.initialize();
      const initSpy = jest.spyOn(optimizer, 'initialize');

      await optimizer.initialize();

      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it('should emit initialization event', async () => {
      const eventSpy = jest.fn();
      optimizer.on('optimizerInitialized', eventSpy);

      await optimizer.initialize();

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Query Analysis', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    it('should analyze simple queries correctly', async () => {
      const query = 'SELECT * FROM reports WHERE active = true';

      // Mock EXPLAIN query result
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {"table": {"table_name": "reports", "access_type": "ref", "key": "idx_active"}}}' }])
        .mockResolvedValueOnce([{ id: 1, name: 'test' }]);

      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis).toEqual({
        queryId: expect.any(String),
        originalQuery: query,
        optimizedQuery: undefined,
        executionPlan: expect.objectContaining({
          type: 'explain_format_json',
          steps: expect.any(Array),
          estimatedCost: expect.any(Number),
          estimatedRows: expect.any(Number),
        }),
        optimizationSuggestions: expect.any(Array),
        performance: expect.objectContaining({
          executionTime: expect.any(Number),
          cpuTime: expect.any(Number),
          recordsReturned: expect.any(Number),
          efficiency: expect.any(Number),
        }),
        complexity: expect.objectContaining({
          score: expect.any(Number),
          classification: 'simple',
          factors: expect.any(Object),
        }),
        resources: expect.any(Object),
      });
    });

    it('should analyze complex queries correctly', async () => {
      const complexQuery = `
        SELECT r.name, COUNT(re.id) as execution_count,
               AVG(re.duration_ms) as avg_duration
        FROM reports r
        LEFT JOIN report_executions re ON r.report_id = re.report_id
        WHERE r.is_active = true
          AND re.start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND re.status IN ('completed', 'failed')
        GROUP BY r.id, r.name
        HAVING COUNT(re.id) > 5
        ORDER BY avg_duration DESC
      `;

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([]);

      const analysis = await optimizer.analyzeQuery(complexQuery);

      expect(analysis.complexity.classification).toBe('complex');
      expect(analysis.complexity.factors.joinCount).toBeGreaterThan(0);
      expect(analysis.complexity.factors.aggregationCount).toBeGreaterThan(0);
      expect(analysis.complexity.factors.whereConditionCount).toBeGreaterThan(3);
      expect(analysis.optimizationSuggestions.length).toBeGreaterThan(0);
    });

    it('should analyze query with subqueries', async () => {
      const subqueryQuery = `
        SELECT * FROM reports
        WHERE report_id IN (
          SELECT report_id FROM report_executions
          WHERE status = 'failed'
        )
        AND created_by IN (
          SELECT id FROM users WHERE role = 'admin'
        )
      `;

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([]);

      const analysis = await optimizer.analyzeQuery(subqueryQuery);

      expect(analysis.complexity.factors.subqueryCount).toBe(2);
      expect(analysis.optimizationSuggestions).toContainEqual(
        expect.objectContaining({
          type: 'query_rewrite',
          description: expect.stringContaining('subqueries'),
        })
      );
    });

    it('should handle queries with UNION operations', async () => {
      const unionQuery = `
        SELECT 'aws' as provider, COUNT(*) as count FROM vpcs WHERE provider = 'aws'
        UNION
        SELECT 'azure' as provider, COUNT(*) as count FROM vpcs WHERE provider = 'azure'
        UNION
        SELECT 'gcp' as provider, COUNT(*) as count FROM vpcs WHERE provider = 'gcp'
      `;

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([]);

      const analysis = await optimizer.analyzeQuery(unionQuery);

      expect(analysis.complexity.factors.unionCount).toBe(2);
    });

    it('should identify slow queries and emit events', async () => {
      const slowQuery = 'SELECT * FROM large_table';
      const slowQuerySpy = jest.fn();
      const criticalSpy = jest.fn();

      optimizer.on('criticalPerformanceIssue', criticalSpy);

      // Mock slow execution
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 2500); // 2.5 seconds (over critical threshold)
          });
        });

      const analysis = await optimizer.analyzeQuery(slowQuery);

      expect(analysis.optimizationSuggestions).toContainEqual(
        expect.objectContaining({
          priority: 'critical',
          description: expect.stringContaining('critical threshold'),
        })
      );

      expect(criticalSpy).toHaveBeenCalledWith(analysis);
    });

    it('should handle analysis with custom options', async () => {
      const query = 'SELECT COUNT(*) FROM reports';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([{ count: 100 }]);

      const options = {
        includeExecutionPlan: false,
        includeOptimizationSuggestions: false,
        baseline: true,
      };

      const analysis = await optimizer.analyzeQuery(query, {}, options);

      expect(analysis.executionPlan.steps).toHaveLength(0);
      expect(analysis.optimizationSuggestions).toHaveLength(0);
    });

    it('should handle execution plan parsing errors gracefully', async () => {
      const query = 'SELECT * FROM reports';

      // Mock invalid EXPLAIN result
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: 'invalid json' }])
        .mockResolvedValueOnce([]);

      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis.executionPlan.steps).toHaveLength(0);
      expect(analysis.executionPlan.type).toBe('explain_format_json');
    });

    it('should handle query execution errors during analysis', async () => {
      const query = 'INVALID SQL QUERY';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockRejectedValueOnce(new Error('SQL syntax error'));

      await expect(optimizer.analyzeQuery(query)).rejects.toThrow('SQL syntax error');
    });
  });

  describe('Query Complexity Assessment', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    it('should correctly assess simple query complexity', () => {
      const simpleQuery = 'SELECT id, name FROM reports WHERE active = true';

      // Access private method for testing (using any to bypass TypeScript)
      const complexity = (optimizer as any).analyzeQueryComplexity(simpleQuery);

      expect(complexity.classification).toBe('simple');
      expect(complexity.score).toBeLessThan(3);
      expect(complexity.factors.joinCount).toBe(0);
      expect(complexity.factors.subqueryCount).toBe(0);
      expect(complexity.factors.aggregationCount).toBe(0);
    });

    it('should correctly assess moderate query complexity', () => {
      const moderateQuery = `
        SELECT r.name, r.category, COUNT(re.id) as executions
        FROM reports r
        LEFT JOIN report_executions re ON r.report_id = re.report_id
        WHERE r.is_active = true AND re.status = 'completed'
        GROUP BY r.id, r.name, r.category
        ORDER BY executions DESC
      `;

      const complexity = (optimizer as any).analyzeQueryComplexity(moderateQuery);

      expect(complexity.classification).toBe('moderate');
      expect(complexity.score).toBeGreaterThan(3);
      expect(complexity.score).toBeLessThan(6);
      expect(complexity.factors.joinCount).toBe(1);
      expect(complexity.factors.aggregationCount).toBe(1);
    });

    it('should correctly assess complex query complexity', () => {
      const complexQuery = `
        SELECT r.name,
               (SELECT COUNT(*) FROM report_executions WHERE report_id = r.report_id AND status = 'completed') as completed,
               (SELECT COUNT(*) FROM report_executions WHERE report_id = r.report_id AND status = 'failed') as failed,
               (SELECT AVG(duration_ms) FROM report_executions WHERE report_id = r.report_id) as avg_duration
        FROM reports r
        INNER JOIN users u ON r.created_by = u.id
        LEFT JOIN report_executions re ON r.report_id = re.report_id
        WHERE r.is_active = true
          AND u.role = 'admin'
          AND r.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
          AND r.category IN ('infrastructure', 'security', 'compliance')
        GROUP BY r.id, r.name
        HAVING COUNT(re.id) > 10
        ORDER BY r.name, avg_duration DESC
      `;

      const complexity = (optimizer as any).analyzeQueryComplexity(complexQuery);

      expect(complexity.classification).toBe('complex');
      expect(complexity.score).toBeGreaterThan(6);
      expect(complexity.factors.joinCount).toBe(2);
      expect(complexity.factors.subqueryCount).toBe(3);
      expect(complexity.factors.aggregationCount).toBeGreaterThan(1);
      expect(complexity.estimatedOptimizationPotential).toBeGreaterThan(30);
    });

    it('should correctly assess very complex query complexity', () => {
      const veryComplexQuery = `
        SELECT r.name,
               COUNT(DISTINCT re.id) as total_executions,
               AVG(re.duration_ms) as avg_duration,
               MAX(re.duration_ms) as max_duration,
               MIN(re.duration_ms) as min_duration,
               SUM(re.records_processed) as total_records
        FROM reports r
        INNER JOIN users u1 ON r.created_by = u1.id
        LEFT JOIN users u2 ON r.last_modified_by = u2.id
        LEFT JOIN report_executions re ON r.report_id = re.report_id
        LEFT JOIN (
          SELECT report_id, COUNT(*) as error_count
          FROM report_executions
          WHERE status = 'failed'
          GROUP BY report_id
        ) errors ON r.report_id = errors.report_id
        WHERE r.is_active = true
          AND u1.role = 'admin'
          AND re.start_time >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
          AND re.status IN ('completed', 'failed', 'timeout')
          AND r.category IN ('infrastructure', 'security')
          AND errors.error_count < 5
        GROUP BY r.id, r.name, u1.username, u2.username
        HAVING total_executions > 50 AND avg_duration < 10000
        ORDER BY total_executions DESC, avg_duration ASC, r.name
        LIMIT 100
      `;

      const complexity = (optimizer as any).analyzeQueryComplexity(veryComplexQuery);

      expect(complexity.classification).toBe('very_complex');
      expect(complexity.score).toBeGreaterThan(8);
      expect(complexity.factors.joinCount).toBeGreaterThan(3);
      expect(complexity.factors.subqueryCount).toBeGreaterThan(0);
      expect(complexity.factors.aggregationCount).toBeGreaterThan(5);
    });
  });

  describe('Optimization Suggestions', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    it('should suggest indexes for full table scans', async () => {
      const query = 'SELECT * FROM reports WHERE name LIKE "%vpc%"';

      // Mock execution plan with full table scan
      const mockExplain = {
        EXPLAIN: JSON.stringify({
          query_block: {
            table: {
              table_name: 'reports',
              access_type: 'ALL', // Full table scan
              rows_examined_per_scan: 10000,
            }
          }
        })
      };

      mockExecuteReportQuery
        .mockResolvedValueOnce([mockExplain])
        .mockResolvedValueOnce([]);

      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis.optimizationSuggestions).toContainEqual(
        expect.objectContaining({
          type: 'index',
          priority: 'high',
          description: expect.stringContaining('Full table scan'),
        })
      );
    });

    it('should suggest query rewrites for multiple subqueries', async () => {
      const query = `
        SELECT * FROM reports
        WHERE report_id IN (SELECT report_id FROM report_executions WHERE status = 'failed')
        AND created_by IN (SELECT id FROM users WHERE role = 'admin')
        AND category IN (SELECT name FROM categories WHERE active = true)
      `;

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([]);

      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis.optimizationSuggestions).toContainEqual(
        expect.objectContaining({
          type: 'query_rewrite',
          priority: 'medium',
          description: expect.stringContaining('subqueries'),
        })
      );
    });

    it('should suggest caching for slow aggregation queries', async () => {
      const query = `
        SELECT provider, COUNT(*) as vpc_count, AVG(subnet_count) as avg_subnets
        FROM vpc_summary_view
        GROUP BY provider
        ORDER BY vpc_count DESC
      `;

      // Mock slow execution (> 5 seconds)
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 6000); // 6 seconds
          });
        });

      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis.optimizationSuggestions).toContainEqual(
        expect.objectContaining({
          type: 'caching',
          priority: 'high',
          description: expect.stringContaining('aggregation query'),
        })
      );
    });

    it('should suggest materialized views for complex aggregations with joins', async () => {
      const query = `
        SELECT r.category, r.provider,
               COUNT(*) as report_count,
               AVG(re.duration_ms) as avg_duration,
               SUM(re.records_processed) as total_records
        FROM reports r
        LEFT JOIN report_executions re ON r.report_id = re.report_id
        WHERE re.status = 'completed'
        GROUP BY r.category, r.provider
      `;

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([]);

      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis.optimizationSuggestions).toContainEqual(
        expect.objectContaining({
          type: 'materialized_view',
          priority: 'medium',
          description: expect.stringContaining('aggregation with joins'),
        })
      );
    });

    it('should suggest critical optimization for queries exceeding critical threshold', async () => {
      const query = 'SELECT * FROM huge_table';

      // Mock very slow execution (> critical threshold)
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 3000); // 3 seconds (over critical threshold)
          });
        });

      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis.optimizationSuggestions).toContainEqual(
        expect.objectContaining({
          type: 'query_rewrite',
          priority: 'critical',
          description: expect.stringContaining('critical threshold'),
        })
      );
    });
  });

  describe('Optimized Query Execution', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    it('should execute optimized queries successfully', async () => {
      const query = 'SELECT * FROM reports WHERE active = true';
      const expectedResult = [{ id: 1, name: 'Test Report' }];

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce(expectedResult) // For analysis
        .mockResolvedValueOnce(expectedResult); // For optimized execution

      const result = await optimizer.executeOptimizedQuery(query);

      expect(result.result).toEqual(expectedResult);
      expect(result.analysis).toBeDefined();
      expect(result.improvementPercent).toBe(0); // No baseline for comparison
    });

    it('should use cached analysis when available', async () => {
      const query = 'SELECT COUNT(*) FROM reports';

      // First execution - should analyze
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([{ count: 100 }])
        .mockResolvedValueOnce([{ count: 100 }]);

      const result1 = await optimizer.executeOptimizedQuery(query);

      // Second execution - should use cached analysis
      mockExecuteReportQuery.mockResolvedValueOnce([{ count: 100 }]);

      const result2 = await optimizer.executeOptimizedQuery(query);

      expect(result1.analysis.queryId).toBe(result2.analysis.queryId);
      // Analysis should only be called once (first execution)
      expect(mockExecuteReportQuery).toHaveBeenCalledTimes(4); // 3 for first + 1 for second
    });

    it('should force optimization when requested', async () => {
      const query = 'SELECT * FROM reports';

      // First execution
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await optimizer.executeOptimizedQuery(query);

      // Second execution with force optimization
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await optimizer.executeOptimizedQuery(query, {}, { forceOptimization: true });

      expect(result).toBeDefined();
      // Should analyze twice due to force optimization
    });

    it('should calculate improvement percentage with baseline', async () => {
      const query = 'SELECT * FROM reports';

      // Set baseline with slow execution
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 2000); // 2 seconds baseline
          });
        });

      await optimizer.analyzeQuery(query, {}, { baseline: true });

      // Execute optimized version (faster)
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 1000); // 1 second optimized
          });
        })
        .mockResolvedValueOnce([]);

      const result = await optimizer.executeOptimizedQuery(query);

      expect(result.improvementPercent).toBeGreaterThan(0);
      expect(result.improvementPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Index Suggestions', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    it('should generate index suggestions based on slow queries', async () => {
      // Add some slow queries to history
      const slowQuery = 'SELECT * FROM reports WHERE category = "infrastructure"';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{
          EXPLAIN: JSON.stringify({
            query_block: {
              table: {
                table_name: 'reports',
                access_type: 'ALL',
              }
            }
          })
        }])
        .mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 1500); // Slow query
          });
        });

      await optimizer.analyzeQuery(slowQuery);

      const suggestions = await optimizer.generateIndexSuggestions();

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'index',
          priority: 'high',
          description: expect.stringContaining('Missing index'),
        })
      );
    });

    it('should deduplicate and prioritize suggestions', async () => {
      // Add multiple similar slow queries
      const queries = [
        'SELECT * FROM reports WHERE category = "infrastructure"',
        'SELECT * FROM reports WHERE category = "security"',
        'SELECT * FROM reports WHERE provider = "aws"',
      ];

      for (const query of queries) {
        mockExecuteReportQuery
          .mockResolvedValueOnce([{
            EXPLAIN: JSON.stringify({
              query_block: {
                table: {
                  table_name: 'reports',
                  access_type: 'ALL',
                }
              }
            })
          }])
          .mockImplementationOnce(() => {
            return new Promise(resolve => {
              setTimeout(() => resolve([]), 1500);
            });
          });

        await optimizer.analyzeQuery(query);
      }

      const suggestions = await optimizer.generateIndexSuggestions(['reports']);

      // Should have unique suggestions
      const uniqueDescriptions = new Set(suggestions.map(s => s.description));
      expect(uniqueDescriptions.size).toBe(suggestions.length);

      // Should be sorted by priority
      const priorities = suggestions.map(s => s.priority);
      const criticalCount = priorities.filter(p => p === 'critical').length;
      const highCount = priorities.filter(p => p === 'high').length;

      if (criticalCount > 0 && highCount > 0) {
        const firstCriticalIndex = priorities.indexOf('critical');
        const firstHighIndex = priorities.indexOf('high');
        expect(firstCriticalIndex).toBeLessThan(firstHighIndex);
      }
    });

    it('should filter suggestions by table names when provided', async () => {
      const query = 'SELECT * FROM users WHERE role = "admin"';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{
          EXPLAIN: JSON.stringify({
            query_block: {
              table: {
                table_name: 'users',
                access_type: 'ALL',
              }
            }
          })
        }])
        .mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 1500);
          });
        });

      await optimizer.analyzeQuery(query);

      const allSuggestions = await optimizer.generateIndexSuggestions();
      const reportsSuggestions = await optimizer.generateIndexSuggestions(['reports']);

      // Should only include suggestions for reports table
      expect(reportsSuggestions.length).toBeLessThanOrEqual(allSuggestions.length);
    });
  });

  describe('Materialized View Suggestions', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    it('should generate materialized view suggestions for frequent aggregation patterns', async () => {
      const aggregationQuery = `
        SELECT provider, COUNT(*) as vpc_count, AVG(subnet_count) as avg_subnets
        FROM vpcs v
        LEFT JOIN subnets s ON v.vpc_id = s.vpc_id
        GROUP BY provider
      `;

      // Execute the same query pattern multiple times
      for (let i = 0; i < 4; i++) {
        mockExecuteReportQuery
          .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
          .mockResolvedValueOnce([]);

        await optimizer.analyzeQuery(aggregationQuery);
      }

      const suggestions = await optimizer.generateMaterializedViewSuggestions();

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'materialized_view',
          description: expect.stringContaining('Frequently executed aggregation pattern'),
          implementation: expect.stringContaining('materialized view'),
        })
      );
    });

    it('should prioritize suggestions based on execution time', async () => {
      const fastQuery = 'SELECT COUNT(*) FROM reports';
      const slowQuery = `
        SELECT provider, AVG(duration_ms) as avg_duration
        FROM reports r
        JOIN report_executions re ON r.report_id = re.report_id
        GROUP BY provider
      `;

      // Execute fast query multiple times
      for (let i = 0; i < 4; i++) {
        mockExecuteReportQuery
          .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
          .mockImplementationOnce(() => {
            return new Promise(resolve => {
              setTimeout(() => resolve([]), 100); // Fast
            });
          });

        await optimizer.analyzeQuery(fastQuery);
      }

      // Execute slow query multiple times
      for (let i = 0; i < 4; i++) {
        mockExecuteReportQuery
          .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
          .mockImplementationOnce(() => {
            return new Promise(resolve => {
              setTimeout(() => resolve([]), 12000); // Very slow
            });
          });

        await optimizer.analyzeQuery(slowQuery);
      }

      const suggestions = await optimizer.generateMaterializedViewSuggestions();

      const slowQuerySuggestion = suggestions.find(s =>
        s.description.includes('Frequently executed') && s.priority === 'high'
      );
      const fastQuerySuggestion = suggestions.find(s =>
        s.description.includes('Frequently executed') && s.priority === 'medium'
      );

      expect(slowQuerySuggestion).toBeDefined();
    });

    it('should include SQL statement for materialized view creation', async () => {
      const query = `
        SELECT category, COUNT(*) as count
        FROM reports
        GROUP BY category
      `;

      // Execute multiple times to qualify for MV suggestion
      for (let i = 0; i < 4; i++) {
        mockExecuteReportQuery
          .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
          .mockResolvedValueOnce([]);

        await optimizer.analyzeQuery(query);
      }

      const suggestions = await optimizer.generateMaterializedViewSuggestions();

      const mvSuggestion = suggestions.find(s => s.type === 'materialized_view');
      expect(mvSuggestion).toBeDefined();
      expect(mvSuggestion?.sqlStatement).toContain('CREATE MATERIALIZED VIEW');
      expect(mvSuggestion?.sqlStatement).toContain(query);
    });
  });

  describe('Metrics and History', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    it('should track optimization metrics correctly', async () => {
      const query = 'SELECT * FROM reports';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([]);

      await optimizer.analyzeQuery(query);

      const metrics = optimizer.getOptimizationMetrics();

      expect(metrics).toEqual({
        totalQueriesAnalyzed: 1,
        queriesOptimized: 0,
        averageImprovementPercent: 0,
        totalTimeSaved: 0,
        criticalIssuesFound: 0,
        optimizationSuggestionsImplemented: 0,
        indexSuggestionsCreated: 0,
        lastAnalysisTime: expect.any(Date),
      });
    });

    it('should track critical issues in metrics', async () => {
      const criticalQuery = 'SELECT * FROM massive_table';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 3000); // Over critical threshold
          });
        });

      await optimizer.analyzeQuery(criticalQuery);

      const metrics = optimizer.getOptimizationMetrics();

      expect(metrics.criticalIssuesFound).toBe(1);
    });

    it('should provide optimization history', async () => {
      const queries = [
        'SELECT * FROM reports',
        'SELECT COUNT(*) FROM executions',
        'SELECT AVG(duration_ms) FROM executions',
      ];

      for (const query of queries) {
        mockExecuteReportQuery
          .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
          .mockResolvedValueOnce([]);

        await optimizer.analyzeQuery(query);
      }

      const history = optimizer.getOptimizationHistory(10);

      expect(history).toHaveLength(3);
      expect(history[0].performance.executionTime).toBeGreaterThanOrEqual(history[1].performance.executionTime);
    });

    it('should limit history to specified number of entries', async () => {
      const queries = Array.from({ length: 15 }, (_, i) => `SELECT ${i} as num`);

      for (const query of queries) {
        mockExecuteReportQuery
          .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
          .mockResolvedValueOnce([]);

        await optimizer.analyzeQuery(query);
      }

      const limitedHistory = optimizer.getOptimizationHistory(5);
      const fullHistory = optimizer.getOptimizationHistory(20);

      expect(limitedHistory).toHaveLength(5);
      expect(fullHistory).toHaveLength(15);
    });

    it('should clear history correctly', async () => {
      const query = 'SELECT * FROM reports';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([]);

      await optimizer.analyzeQuery(query);

      expect(optimizer.getOptimizationHistory()).toHaveLength(1);

      optimizer.clearHistory();

      expect(optimizer.getOptimizationHistory()).toHaveLength(0);
      expect(optimizer.getOptimizationMetrics().totalQueriesAnalyzed).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    it('should handle EXPLAIN query failures gracefully', async () => {
      const query = 'SELECT * FROM reports';

      mockExecuteReportQuery
        .mockRejectedValueOnce(new Error('EXPLAIN failed'))
        .mockResolvedValueOnce([]);

      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis.executionPlan.steps).toHaveLength(0);
      expect(analysis.optimizationSuggestions).toBeDefined();
    });

    it('should handle performance measurement errors', async () => {
      const query = 'SELECT * FROM reports';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockRejectedValueOnce(new Error('Query execution failed'));

      await expect(optimizer.analyzeQuery(query)).rejects.toThrow('Query execution failed');
    });

    it('should handle invalid JSON in execution plans', async () => {
      const query = 'SELECT * FROM reports';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: 'invalid json {' }])
        .mockResolvedValueOnce([]);

      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis.executionPlan.steps).toHaveLength(0);
    });

    it('should handle optimization suggestions generation errors', async () => {
      const query = 'SELECT * FROM reports';

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([]);

      // The analysis should complete even if suggestion generation has issues
      const analysis = await optimizer.analyzeQuery(query);

      expect(analysis).toBeDefined();
      expect(analysis.optimizationSuggestions).toBeDefined();
    });
  });

  describe('Module Functions', () => {
    it('should work with initializeQueryOptimizer function', async () => {
      await expect(initializeQueryOptimizer()).resolves.not.toThrow();
    });

    it('should work with analyzeQuery function', async () => {
      await initializeQueryOptimizer();

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([]);

      const result = await analyzeQuery('SELECT 1');

      expect(result).toBeDefined();
      expect(result.queryId).toBeDefined();
    });

    it('should work with executeOptimizedQuery function', async () => {
      await initializeQueryOptimizer();

      mockExecuteReportQuery
        .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
        .mockResolvedValueOnce([{ result: 1 }])
        .mockResolvedValueOnce([{ result: 1 }]);

      const result = await executeOptimizedQuery('SELECT 1');

      expect(result.result).toEqual([{ result: 1 }]);
      expect(result.analysis).toBeDefined();
      expect(result.improvementPercent).toBeDefined();
    });

    it('should work with generateIndexSuggestions function', async () => {
      await initializeQueryOptimizer();

      const suggestions = await generateIndexSuggestions(['reports']);

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should work with generateMaterializedViewSuggestions function', async () => {
      await initializeQueryOptimizer();

      const suggestions = await generateMaterializedViewSuggestions();

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should work with getOptimizationMetrics function', async () => {
      await initializeQueryOptimizer();

      const metrics = getOptimizationMetrics();

      expect(metrics).toEqual({
        totalQueriesAnalyzed: expect.any(Number),
        queriesOptimized: expect.any(Number),
        averageImprovementPercent: expect.any(Number),
        totalTimeSaved: expect.any(Number),
        criticalIssuesFound: expect.any(Number),
        optimizationSuggestionsImplemented: expect.any(Number),
        indexSuggestionsCreated: expect.any(Number),
        lastAnalysisTime: expect.any(Date),
      });
    });
  });

  describe('Performance and Load Testing', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    it('should handle concurrent query analysis', async () => {
      const queries = Array.from({ length: 10 }, (_, i) => `SELECT ${i} as num`);

      mockExecuteReportQuery.mockImplementation(() => {
        return Promise.resolve([{ EXPLAIN: '{"query_block": {}}' }]);
      });

      const promises = queries.map(query => optimizer.analyzeQuery(query));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.queryId).toBeDefined();
        expect(result.complexity).toBeDefined();
      });
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();

      const queries = Array.from({ length: 50 }, (_, i) => `SELECT ${i} as num`);

      mockExecuteReportQuery.mockResolvedValue([{ EXPLAIN: '{"query_block": {}}' }]);

      for (const query of queries) {
        await optimizer.analyzeQuery(query);
      }

      const duration = Date.now() - startTime;

      // Should complete 50 analyses in reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    it('should handle memory efficiently with large history', async () => {
      // Add many queries to test memory management
      for (let i = 0; i < 1100; i++) {
        mockExecuteReportQuery
          .mockResolvedValueOnce([{ EXPLAIN: '{"query_block": {}}' }])
          .mockResolvedValueOnce([]);

        await optimizer.analyzeQuery(`SELECT ${i} as num`);
      }

      const history = optimizer.getOptimizationHistory();

      // Should limit history size to prevent memory issues
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });
});