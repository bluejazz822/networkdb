/**
 * Query Optimization and Performance Monitoring Utility
 *
 * Provides advanced query optimization techniques, performance monitoring,
 * query plan analysis, and automatic optimization suggestions for reporting workloads.
 */

import { Sequelize, QueryTypes } from 'sequelize';
import { EventEmitter } from 'events';
import { executeReportQuery, reportingPool } from '../database/connections/ReportingConnectionPool';
import { performanceConfig } from '../config/pool-config';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'QueryOptimizer' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Query analysis result interfaces
export interface QueryAnalysis {
  queryId: string;
  originalQuery: string;
  optimizedQuery?: string;
  executionPlan: QueryExecutionPlan;
  optimizationSuggestions: OptimizationSuggestion[];
  performance: QueryPerformance;
  complexity: QueryComplexity;
  resources: ResourceUsage;
}

export interface QueryExecutionPlan {
  type: 'explain' | 'explain_extended' | 'explain_format_json';
  steps: ExecutionStep[];
  estimatedCost: number;
  estimatedRows: number;
  keyUsage: string[];
  indexesUsed: string[];
  fullTableScans: string[];
  temporaryTables: boolean;
  filesort: boolean;
}

export interface ExecutionStep {
  id: number;
  selectType: string;
  table: string;
  partitions?: string;
  type: string;
  possibleKeys?: string[];
  key?: string;
  keyLen?: number;
  ref?: string;
  rows: number;
  filtered: number;
  extra: string;
  cost: number;
}

export interface OptimizationSuggestion {
  type: 'index' | 'query_rewrite' | 'partition' | 'caching' | 'materialized_view' | 'denormalization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  implementation: string;
  estimatedImprovement: string;
  effort: 'low' | 'medium' | 'high';
  sqlStatement?: string;
}

export interface QueryPerformance {
  executionTime: number;
  cpuTime: number;
  ioWait: number;
  memoryUsage: number;
  networkLatency: number;
  cacheHitRatio: number;
  recordsExamined: number;
  recordsReturned: number;
  efficiency: number; // recordsReturned / recordsExamined
}

export interface QueryComplexity {
  score: number; // 1-10 scale
  factors: {
    joinCount: number;
    subqueryCount: number;
    unionCount: number;
    aggregationCount: number;
    functionCount: number;
    whereConditionCount: number;
    orderByFieldCount: number;
    groupByFieldCount: number;
  };
  classification: 'simple' | 'moderate' | 'complex' | 'very_complex';
  estimatedOptimizationPotential: number; // 0-100%
}

export interface ResourceUsage {
  connectionTime: number;
  lockWaitTime: number;
  tempDiskUsage: number;
  sortMemoryUsage: number;
  joinBufferUsage: number;
  concurrentQueries: number;
}

export interface OptimizationMetrics {
  totalQueriesAnalyzed: number;
  queriesOptimized: number;
  averageImprovementPercent: number;
  totalTimeSaved: number;
  criticalIssuesFound: number;
  optimizationSuggestionsImplemented: number;
  indexSuggestionsCreated: number;
  lastAnalysisTime: Date;
}

/**
 * Advanced Query Optimizer
 *
 * Analyzes query performance, suggests optimizations, and provides
 * automated query improvement capabilities.
 */
export class QueryOptimizer extends EventEmitter {
  private static instance: QueryOptimizer;
  private isInitialized = false;
  private optimizationHistory: Map<string, QueryAnalysis> = new Map();
  private performanceBaseline: Map<string, QueryPerformance> = new Map();
  private optimizationMetrics: OptimizationMetrics;
  private monitoringInterval: NodeJS.Timer | null = null;

  private constructor() {
    super();
    this.optimizationMetrics = {
      totalQueriesAnalyzed: 0,
      queriesOptimized: 0,
      averageImprovementPercent: 0,
      totalTimeSaved: 0,
      criticalIssuesFound: 0,
      optimizationSuggestionsImplemented: 0,
      indexSuggestionsCreated: 0,
      lastAnalysisTime: new Date(),
    };
  }

  public static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  /**
   * Initialize the query optimizer
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Query optimizer already initialized');
      return;
    }

    try {
      logger.info('Initializing query optimizer...');

      // Load optimization history
      await this.loadOptimizationHistory();

      // Start performance monitoring
      this.startPerformanceMonitoring();

      this.isInitialized = true;
      this.emit('optimizerInitialized');

      logger.info('Query optimizer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize query optimizer', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Analyze a query for optimization opportunities
   */
  public async analyzeQuery(
    query: string,
    replacements?: Record<string, any>,
    options?: {
      includeExecutionPlan?: boolean;
      includeOptimizationSuggestions?: boolean;
      baseline?: boolean;
    }
  ): Promise<QueryAnalysis> {
    const queryId = this.generateQueryId(query, replacements);
    const startTime = Date.now();

    try {
      logger.debug('Analyzing query for optimization', {
        queryId,
        query: query.substring(0, 200),
      });

      // Get execution plan
      const executionPlan = options?.includeExecutionPlan !== false ?
        await this.getExecutionPlan(query, replacements) :
        this.createEmptyExecutionPlan();

      // Analyze query complexity
      const complexity = this.analyzeQueryComplexity(query);

      // Execute query to get performance metrics
      const performance = await this.measureQueryPerformance(query, replacements);

      // Get resource usage
      const resources = await this.measureResourceUsage(query, replacements);

      // Generate optimization suggestions
      const optimizationSuggestions = options?.includeOptimizationSuggestions !== false ?
        this.generateOptimizationSuggestions(query, executionPlan, complexity, performance) :
        [];

      // Attempt to generate optimized query
      const optimizedQuery = this.generateOptimizedQuery(query, optimizationSuggestions);

      const analysis: QueryAnalysis = {
        queryId,
        originalQuery: query,
        optimizedQuery,
        executionPlan,
        optimizationSuggestions,
        performance,
        complexity,
        resources,
      };

      // Store analysis
      this.optimizationHistory.set(queryId, analysis);

      // Update baseline if requested
      if (options?.baseline) {
        this.performanceBaseline.set(queryId, performance);
      }

      // Update metrics
      this.updateOptimizationMetrics(analysis);

      // Emit events for critical issues
      if (optimizationSuggestions.some(s => s.priority === 'critical')) {
        this.emit('criticalPerformanceIssue', analysis);
      }

      logger.info('Query analysis completed', {
        queryId,
        complexityScore: complexity.score,
        executionTime: performance.executionTime,
        suggestionsCount: optimizationSuggestions.length,
      });

      return analysis;

    } catch (error) {
      logger.error('Failed to analyze query', {
        queryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute optimized version of a query
   */
  public async executeOptimizedQuery(
    query: string,
    replacements?: Record<string, any>,
    options?: {
      forceOptimization?: boolean;
      useCache?: boolean;
      timeout?: number;
    }
  ): Promise<{
    result: any;
    analysis: QueryAnalysis;
    improvementPercent: number;
  }> {
    const queryId = this.generateQueryId(query, replacements);

    try {
      // Get or create analysis
      let analysis = this.optimizationHistory.get(queryId);

      if (!analysis || options?.forceOptimization) {
        analysis = await this.analyzeQuery(query, replacements, {
          includeExecutionPlan: true,
          includeOptimizationSuggestions: true,
        });
      }

      // Determine which query to execute
      const queryToExecute = analysis.optimizedQuery || query;
      const baseline = this.performanceBaseline.get(queryId);

      // Execute the query
      const result = await executeReportQuery(queryToExecute, replacements, {
        useCache: options?.useCache,
        timeout: options?.timeout,
      });

      // Calculate improvement
      let improvementPercent = 0;
      if (baseline && analysis.performance.executionTime < baseline.executionTime) {
        improvementPercent =
          ((baseline.executionTime - analysis.performance.executionTime) / baseline.executionTime) * 100;
      }

      logger.info('Optimized query executed', {
        queryId,
        originalTime: baseline?.executionTime,
        optimizedTime: analysis.performance.executionTime,
        improvementPercent,
      });

      return {
        result,
        analysis,
        improvementPercent,
      };

    } catch (error) {
      logger.error('Failed to execute optimized query', {
        queryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate index creation suggestions
   */
  public async generateIndexSuggestions(
    tableNames?: string[]
  ): Promise<OptimizationSuggestion[]> {
    try {
      logger.info('Generating index suggestions', { tableNames });

      const suggestions: OptimizationSuggestion[] = [];

      // Analyze slow queries to identify missing indexes
      const slowQueries = Array.from(this.optimizationHistory.values())
        .filter(analysis => analysis.performance.executionTime > performanceConfig.slowQueryThreshold)
        .slice(-50); // Last 50 slow queries

      for (const analysis of slowQueries) {
        const indexSuggestions = this.analyzeForMissingIndexes(analysis);
        suggestions.push(...indexSuggestions);
      }

      // Remove duplicates and prioritize
      const uniqueSuggestions = this.deduplicateAndPrioritizeSuggestions(suggestions);

      logger.info(`Generated ${uniqueSuggestions.length} index suggestions`);

      return uniqueSuggestions;

    } catch (error) {
      logger.error('Failed to generate index suggestions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create materialized view recommendations
   */
  public async generateMaterializedViewSuggestions(): Promise<OptimizationSuggestion[]> {
    try {
      logger.info('Generating materialized view suggestions');

      const suggestions: OptimizationSuggestion[] = [];

      // Analyze query patterns for common aggregations
      const aggregationQueries = Array.from(this.optimizationHistory.values())
        .filter(analysis => this.isAggregationQuery(analysis.originalQuery))
        .slice(-100);

      // Group similar queries
      const queryGroups = this.groupSimilarQueries(aggregationQueries);

      for (const group of queryGroups) {
        if (group.length >= 3) { // Frequently used pattern
          const mvSuggestion = this.createMaterializedViewSuggestion(group);
          if (mvSuggestion) {
            suggestions.push(mvSuggestion);
          }
        }
      }

      logger.info(`Generated ${suggestions.length} materialized view suggestions`);

      return suggestions;

    } catch (error) {
      logger.error('Failed to generate materialized view suggestions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get optimization metrics
   */
  public getOptimizationMetrics(): OptimizationMetrics {
    return { ...this.optimizationMetrics };
  }

  /**
   * Get optimization history
   */
  public getOptimizationHistory(limit: number = 100): QueryAnalysis[] {
    return Array.from(this.optimizationHistory.values())
      .slice(-limit)
      .sort((a, b) => b.performance.executionTime - a.performance.executionTime);
  }

  /**
   * Clear optimization history
   */
  public clearHistory(): void {
    this.optimizationHistory.clear();
    this.performanceBaseline.clear();

    this.optimizationMetrics = {
      totalQueriesAnalyzed: 0,
      queriesOptimized: 0,
      averageImprovementPercent: 0,
      totalTimeSaved: 0,
      criticalIssuesFound: 0,
      optimizationSuggestionsImplemented: 0,
      indexSuggestionsCreated: 0,
      lastAnalysisTime: new Date(),
    };

    logger.info('Optimization history cleared');
    this.emit('historyCleared');
  }

  // Private methods

  private async getExecutionPlan(
    query: string,
    replacements?: Record<string, any>
  ): Promise<QueryExecutionPlan> {
    try {
      // Use EXPLAIN to get execution plan
      const explainQuery = `EXPLAIN FORMAT=JSON ${query}`;
      const result = await executeReportQuery(explainQuery, replacements, {
        useCache: false,
        timeout: 10000,
      });

      return this.parseExecutionPlan(result);

    } catch (error) {
      logger.warn('Failed to get execution plan', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyExecutionPlan();
    }
  }

  private parseExecutionPlan(rawPlan: any): QueryExecutionPlan {
    // Parse MySQL EXPLAIN FORMAT=JSON output
    // This is a simplified parser - real implementation would be more comprehensive

    const plan: QueryExecutionPlan = {
      type: 'explain_format_json',
      steps: [],
      estimatedCost: 0,
      estimatedRows: 0,
      keyUsage: [],
      indexesUsed: [],
      fullTableScans: [],
      temporaryTables: false,
      filesort: false,
    };

    try {
      if (Array.isArray(rawPlan) && rawPlan[0]?.EXPLAIN) {
        const explainData = JSON.parse(rawPlan[0].EXPLAIN);
        const queryBlock = explainData.query_block;

        if (queryBlock) {
          this.parseQueryBlock(queryBlock, plan);
        }
      }
    } catch (error) {
      logger.warn('Failed to parse execution plan JSON', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return plan;
  }

  private parseQueryBlock(queryBlock: any, plan: QueryExecutionPlan): void {
    if (queryBlock.table) {
      const step: ExecutionStep = {
        id: 1,
        selectType: queryBlock.select_id?.toString() || 'SIMPLE',
        table: queryBlock.table.table_name || 'unknown',
        type: queryBlock.table.access_type || 'unknown',
        rows: queryBlock.table.rows_examined_per_scan || 0,
        filtered: queryBlock.table.filtered || 100,
        extra: '',
        cost: queryBlock.table.cost_info?.read_cost || 0,
      };

      if (queryBlock.table.key) {
        step.key = queryBlock.table.key;
        plan.indexesUsed.push(queryBlock.table.key);
      }

      if (queryBlock.table.possible_keys) {
        step.possibleKeys = queryBlock.table.possible_keys;
      }

      plan.steps.push(step);
      plan.estimatedCost += step.cost;
      plan.estimatedRows += step.rows;

      if (step.type === 'ALL') {
        plan.fullTableScans.push(step.table);
      }
    }

    // Handle nested tables and operations
    if (queryBlock.nested_loop) {
      for (const nested of queryBlock.nested_loop) {
        if (nested.table) {
          this.parseQueryBlock({ table: nested.table }, plan);
        }
      }
    }

    // Check for temporary tables and filesort
    if (queryBlock.using_temporary_table) {
      plan.temporaryTables = true;
    }

    if (queryBlock.using_filesort) {
      plan.filesort = true;
    }
  }

  private createEmptyExecutionPlan(): QueryExecutionPlan {
    return {
      type: 'explain',
      steps: [],
      estimatedCost: 0,
      estimatedRows: 0,
      keyUsage: [],
      indexesUsed: [],
      fullTableScans: [],
      temporaryTables: false,
      filesort: false,
    };
  }

  private analyzeQueryComplexity(query: string): QueryComplexity {
    const normalizedQuery = query.toLowerCase();

    const factors = {
      joinCount: (normalizedQuery.match(/\sjoin\s/g) || []).length,
      subqueryCount: (normalizedQuery.match(/\(select\s/g) || []).length,
      unionCount: (normalizedQuery.match(/\sunion\s/g) || []).length,
      aggregationCount: (normalizedQuery.match(/\b(count|sum|avg|max|min|group_concat)\s*\(/g) || []).length,
      functionCount: (normalizedQuery.match(/\b\w+\s*\(/g) || []).length,
      whereConditionCount: (normalizedQuery.match(/\s(and|or)\s/g) || []).length + 1,
      orderByFieldCount: normalizedQuery.includes('order by') ?
        (normalizedQuery.split('order by')[1]?.split('limit')[0]?.split(',').length || 1) : 0,
      groupByFieldCount: normalizedQuery.includes('group by') ?
        (normalizedQuery.split('group by')[1]?.split('order by')[0]?.split('having')[0]?.split(',').length || 1) : 0,
    };

    // Calculate complexity score (1-10)
    let score = 1;
    score += Math.min(factors.joinCount * 0.5, 2);
    score += Math.min(factors.subqueryCount * 1, 2);
    score += Math.min(factors.unionCount * 0.5, 1);
    score += Math.min(factors.aggregationCount * 0.3, 1);
    score += Math.min(factors.whereConditionCount * 0.1, 1);
    score += Math.min(factors.orderByFieldCount * 0.2, 1);
    score += Math.min(factors.groupByFieldCount * 0.3, 1);

    let classification: 'simple' | 'moderate' | 'complex' | 'very_complex';
    if (score <= 3) classification = 'simple';
    else if (score <= 6) classification = 'moderate';
    else if (score <= 8) classification = 'complex';
    else classification = 'very_complex';

    // Estimate optimization potential
    let optimizationPotential = 10; // Base 10%
    if (factors.joinCount > 3) optimizationPotential += 20;
    if (factors.subqueryCount > 0) optimizationPotential += 15;
    if (factors.aggregationCount > 2) optimizationPotential += 10;
    optimizationPotential = Math.min(optimizationPotential, 100);

    return {
      score: Math.round(score * 10) / 10,
      factors,
      classification,
      estimatedOptimizationPotential: optimizationPotential,
    };
  }

  private async measureQueryPerformance(
    query: string,
    replacements?: Record<string, any>
  ): Promise<QueryPerformance> {
    const startTime = Date.now();
    let recordsReturned = 0;
    let recordsExamined = 0;

    try {
      // Execute query and measure
      const result = await executeReportQuery(query, replacements, {
        useCache: false,
        timeout: 30000,
      });

      recordsReturned = Array.isArray(result) ? result.length : 1;

      // Get handler status for examined records (MySQL specific)
      try {
        const statusResult = await executeReportQuery(
          'SHOW SESSION STATUS LIKE "Handler_read%"',
          {},
          { useCache: false }
        );

        for (const status of statusResult as any[]) {
          if (status.Variable_name?.includes('Handler_read')) {
            recordsExamined += parseInt(status.Value) || 0;
          }
        }
      } catch (error) {
        // Ignore status query errors
      }

    } catch (error) {
      // Even if query fails, record the time
    }

    const executionTime = Date.now() - startTime;
    const efficiency = recordsExamined > 0 ? recordsReturned / recordsExamined : 1;

    return {
      executionTime,
      cpuTime: executionTime * 0.8, // Estimate
      ioWait: executionTime * 0.2, // Estimate
      memoryUsage: 0, // Would need system monitoring
      networkLatency: 0, // Would need network monitoring
      cacheHitRatio: 0, // Would need cache statistics
      recordsExamined,
      recordsReturned,
      efficiency: Math.min(efficiency, 1),
    };
  }

  private async measureResourceUsage(
    query: string,
    replacements?: Record<string, any>
  ): Promise<ResourceUsage> {
    // This would integrate with system monitoring tools
    // For now, return estimated values
    return {
      connectionTime: 0,
      lockWaitTime: 0,
      tempDiskUsage: 0,
      sortMemoryUsage: 0,
      joinBufferUsage: 0,
      concurrentQueries: 1,
    };
  }

  private generateOptimizationSuggestions(
    query: string,
    executionPlan: QueryExecutionPlan,
    complexity: QueryComplexity,
    performance: QueryPerformance
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Index suggestions
    if (executionPlan.fullTableScans.length > 0) {
      suggestions.push({
        type: 'index',
        priority: 'high',
        description: `Full table scan detected on ${executionPlan.fullTableScans.join(', ')}`,
        implementation: 'Create indexes on frequently queried columns',
        estimatedImprovement: '50-90% faster execution',
        effort: 'low',
        sqlStatement: `-- Example: CREATE INDEX idx_table_column ON table_name (column_name);`,
      });
    }

    // Query rewrite suggestions
    if (complexity.factors.subqueryCount > 2) {
      suggestions.push({
        type: 'query_rewrite',
        priority: 'medium',
        description: 'Multiple subqueries detected - consider JOIN optimization',
        implementation: 'Rewrite subqueries as JOINs where possible',
        estimatedImprovement: '20-40% faster execution',
        effort: 'medium',
      });
    }

    // Caching suggestions
    if (performance.executionTime > 5000 && complexity.factors.aggregationCount > 0) {
      suggestions.push({
        type: 'caching',
        priority: 'high',
        description: 'Slow aggregation query - good candidate for caching',
        implementation: 'Enable query result caching with appropriate TTL',
        estimatedImprovement: '90%+ faster for cached results',
        effort: 'low',
      });
    }

    // Materialized view suggestions
    if (complexity.factors.aggregationCount > 2 && complexity.factors.joinCount > 1) {
      suggestions.push({
        type: 'materialized_view',
        priority: 'medium',
        description: 'Complex aggregation with joins - consider materialized view',
        implementation: 'Create materialized view for frequent aggregations',
        estimatedImprovement: '70-95% faster execution',
        effort: 'high',
      });
    }

    // Performance critical suggestions
    if (performance.executionTime > performanceConfig.criticalQueryThreshold) {
      suggestions.push({
        type: 'query_rewrite',
        priority: 'critical',
        description: `Query exceeds critical threshold (${performanceConfig.criticalQueryThreshold}ms)`,
        implementation: 'Immediate optimization required - review query structure',
        estimatedImprovement: 'Critical for system performance',
        effort: 'high',
      });
    }

    return suggestions;
  }

  private generateOptimizedQuery(
    originalQuery: string,
    suggestions: OptimizationSuggestion[]
  ): string | undefined {
    // Basic query optimization - in production this would be much more sophisticated
    let optimizedQuery = originalQuery;

    // Apply simple optimizations
    for (const suggestion of suggestions) {
      if (suggestion.type === 'query_rewrite' && suggestion.sqlStatement) {
        optimizedQuery = suggestion.sqlStatement;
        break;
      }
    }

    return optimizedQuery !== originalQuery ? optimizedQuery : undefined;
  }

  private analyzeForMissingIndexes(analysis: QueryAnalysis): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Look for WHERE clauses without indexes
    if (analysis.executionPlan.fullTableScans.length > 0) {
      for (const table of analysis.executionPlan.fullTableScans) {
        suggestions.push({
          type: 'index',
          priority: 'high',
          description: `Missing index on table: ${table}`,
          implementation: `Analyze WHERE clauses and create appropriate indexes`,
          estimatedImprovement: '60-90% faster execution',
          effort: 'low',
          sqlStatement: `-- Analyze query and create index: CREATE INDEX idx_${table}_columns ON ${table} (column1, column2);`,
        });
      }
    }

    return suggestions;
  }

  private isAggregationQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return /\b(count|sum|avg|max|min|group by)\b/.test(lowerQuery);
  }

  private groupSimilarQueries(queries: QueryAnalysis[]): QueryAnalysis[][] {
    // Simple grouping by query pattern - in production would use more sophisticated similarity analysis
    const groups = new Map<string, QueryAnalysis[]>();

    for (const query of queries) {
      // Create a pattern by removing specific values
      const pattern = query.originalQuery
        .replace(/\d+/g, '?')
        .replace(/'[^']*'/g, '?')
        .replace(/\s+/g, ' ')
        .trim();

      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }
      groups.get(pattern)!.push(query);
    }

    return Array.from(groups.values());
  }

  private createMaterializedViewSuggestion(
    queryGroup: QueryAnalysis[]
  ): OptimizationSuggestion | null {
    if (queryGroup.length === 0) return null;

    const firstQuery = queryGroup[0];
    const avgExecutionTime = queryGroup.reduce(
      (sum, q) => sum + q.performance.executionTime, 0
    ) / queryGroup.length;

    return {
      type: 'materialized_view',
      priority: avgExecutionTime > 10000 ? 'high' : 'medium',
      description: `Frequently executed aggregation pattern (${queryGroup.length} times)`,
      implementation: 'Create materialized view with scheduled refresh',
      estimatedImprovement: `85-95% faster execution (from ${avgExecutionTime}ms to ~${avgExecutionTime * 0.1}ms)`,
      effort: 'high',
      sqlStatement: `-- CREATE MATERIALIZED VIEW mv_report_summary AS ${firstQuery.originalQuery};`,
    };
  }

  private deduplicateAndPrioritizeSuggestions(
    suggestions: OptimizationSuggestion[]
  ): OptimizationSuggestion[] {
    const unique = new Map<string, OptimizationSuggestion>();

    for (const suggestion of suggestions) {
      const key = `${suggestion.type}-${suggestion.description}`;
      const existing = unique.get(key);

      if (!existing || this.getPriorityValue(suggestion.priority) > this.getPriorityValue(existing.priority)) {
        unique.set(key, suggestion);
      }
    }

    return Array.from(unique.values()).sort(
      (a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority)
    );
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private generateQueryId(query: string, replacements?: Record<string, any>): string {
    const queryHash = Buffer.from(query).toString('base64').substring(0, 20);
    const replacementHash = replacements ?
      Buffer.from(JSON.stringify(replacements)).toString('base64').substring(0, 10) :
      'no-params';
    return `${queryHash}-${replacementHash}`;
  }

  private async loadOptimizationHistory(): Promise<void> {
    // In production, this would load from persistent storage
    logger.debug('Optimization history loaded from memory');
  }

  private updateOptimizationMetrics(analysis: QueryAnalysis): void {
    this.optimizationMetrics.totalQueriesAnalyzed++;
    this.optimizationMetrics.lastAnalysisTime = new Date();

    if (analysis.optimizedQuery) {
      this.optimizationMetrics.queriesOptimized++;
    }

    if (analysis.optimizationSuggestions.some(s => s.priority === 'critical')) {
      this.optimizationMetrics.criticalIssuesFound++;
    }

    // Calculate average improvement (would need baseline comparisons)
    // This is simplified - real implementation would track actual improvements
  }

  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.emit('metricsUpdate', this.getOptimizationMetrics());
    }, performanceConfig.metricsCollectionInterval);
  }

  private stopPerformanceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Shutdown the optimizer
   */
  public async shutdown(): Promise<void> {
    this.stopPerformanceMonitoring();
    this.isInitialized = false;
    this.emit('optimizerShutdown');
    logger.info('Query optimizer shut down');
  }
}

// Export singleton instance
export const queryOptimizer = QueryOptimizer.getInstance();

// Convenience functions
export const initializeQueryOptimizer = async (): Promise<void> => {
  return queryOptimizer.initialize();
};

export const analyzeQuery = async (
  query: string,
  replacements?: Record<string, any>,
  options?: {
    includeExecutionPlan?: boolean;
    includeOptimizationSuggestions?: boolean;
    baseline?: boolean;
  }
): Promise<QueryAnalysis> => {
  return queryOptimizer.analyzeQuery(query, replacements, options);
};

export const executeOptimizedQuery = async (
  query: string,
  replacements?: Record<string, any>,
  options?: {
    forceOptimization?: boolean;
    useCache?: boolean;
    timeout?: number;
  }
): Promise<{
  result: any;
  analysis: QueryAnalysis;
  improvementPercent: number;
}> => {
  return queryOptimizer.executeOptimizedQuery(query, replacements, options);
};

export const generateIndexSuggestions = async (
  tableNames?: string[]
): Promise<OptimizationSuggestion[]> => {
  return queryOptimizer.generateIndexSuggestions(tableNames);
};

export const generateMaterializedViewSuggestions = async (): Promise<OptimizationSuggestion[]> => {
  return queryOptimizer.generateMaterializedViewSuggestions();
};

export const getOptimizationMetrics = (): OptimizationMetrics => {
  return queryOptimizer.getOptimizationMetrics();
};