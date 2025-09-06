/**
 * Reporting Service
 * Core service for report generation, execution, and management
 */

import { Sequelize, QueryTypes, Op } from 'sequelize';
import {
  ReportDefinition,
  ReportQuery,
  ReportExecution,
  ReportApiResponse,
  Dashboard,
  DashboardWidget,
  ReportPreview,
  AggregationType,
  DateRange,
  ReportFilter,
  FilterOperator,
  ExecutionStatus,
  ReportAnalytics
} from '../../types/reports';
import { ResourceType } from '../../types/search';
import { Vpc, TransitGateway, CustomerGateway, VpcEndpoint } from '../../models';

export class ReportingService {
  private sequelize: Sequelize;
  private models: Record<string, any>;

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
    this.models = {
      vpc: Vpc,
      transitGateway: TransitGateway,
      customerGateway: CustomerGateway,
      vpcEndpoint: VpcEndpoint
    };
  }

  // ===================== DASHBOARD METHODS =====================

  /**
   * Get dashboard data with key metrics
   */
  async getDashboardData(userId?: number): Promise<ReportApiResponse> {
    try {
      const startTime = Date.now();

      // Get key metrics in parallel
      const [
        resourceCounts,
        healthStatus,
        recentActivity,
        utilizationMetrics
      ] = await Promise.all([
        this.getResourceCounts(),
        this.getHealthStatusSummary(),
        this.getRecentActivity(),
        this.getUtilizationMetrics()
      ]);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          resourceCounts,
          healthStatus,
          recentActivity,
          utilizationMetrics,
          lastUpdated: new Date()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          executionTime,
          version: '1.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: 'DASHBOARD_ERROR',
          message: `Failed to load dashboard data: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get resource counts by type
   */
  private async getResourceCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    for (const [resourceType, model] of Object.entries(this.models)) {
      try {
        counts[resourceType] = await model.count();
      } catch (error) {
        counts[resourceType] = 0;
      }
    }

    // Calculate total
    counts.total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return counts;
  }

  /**
   * Get health status summary
   */
  private async getHealthStatusSummary(): Promise<Record<string, any>> {
    try {
      // This would be enhanced based on actual health fields in your models
      const vpcHealthQuery = `
        SELECT 
          CASE 
            WHEN state = 'available' THEN 'healthy'
            WHEN state IN ('pending', 'deleting') THEN 'warning'
            ELSE 'critical'
          END as status,
          COUNT(*) as count
        FROM vpcs 
        GROUP BY status
      `;

      const vpcHealth = await this.sequelize.query(vpcHealthQuery, {
        type: QueryTypes.SELECT
      }) as any[];

      // Convert to summary format
      const summary = {
        healthy: 0,
        warning: 0,
        critical: 0,
        total: 0
      };

      vpcHealth.forEach(item => {
        summary[item.status] = parseInt(item.count);
        summary.total += parseInt(item.count);
      });

      // Calculate percentages
      const healthPercentage = summary.total > 0 
        ? Math.round((summary.healthy / summary.total) * 100) 
        : 0;

      return {
        ...summary,
        healthPercentage,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        healthy: 0,
        warning: 0,
        critical: 0,
        total: 0,
        healthPercentage: 0,
        error: error.message
      };
    }
  }

  /**
   * Get recent activity
   */
  private async getRecentActivity(): Promise<any[]> {
    try {
      // Get recently created/updated resources
      const recentQuery = `
        (SELECT 'vpc' as type, vpc_id as id, cidr_block as name, created_at, updated_at FROM vpcs ORDER BY created_at DESC LIMIT 5)
        UNION ALL
        (SELECT 'transitGateway' as type, transit_gateway_id as id, '' as name, created_at, updated_at FROM transit_gateways ORDER BY created_at DESC LIMIT 5)
        UNION ALL
        (SELECT 'customerGateway' as type, customer_gateway_id as id, '' as name, created_at, updated_at FROM customer_gateways ORDER BY created_at DESC LIMIT 5)
        UNION ALL
        (SELECT 'vpcEndpoint' as type, vpc_endpoint_id as id, service_name as name, created_at, updated_at FROM vpc_endpoints ORDER BY created_at DESC LIMIT 5)
        ORDER BY created_at DESC LIMIT 10
      `;

      const activity = await this.sequelize.query(recentQuery, {
        type: QueryTypes.SELECT
      });

      return activity.map(item => ({
        ...item,
        action: 'created', // This could be enhanced to track actual actions
        timestamp: item.created_at
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get utilization metrics
   */
  private async getUtilizationMetrics(): Promise<Record<string, any>> {
    try {
      // Example utilization metrics
      const vpcUtilization = await this.sequelize.query(`
        SELECT 
          COUNT(*) as total_vpcs,
          COUNT(CASE WHEN state = 'available' THEN 1 END) as active_vpcs,
          AVG(CASE WHEN cidr_block IS NOT NULL THEN 1 ELSE 0 END) * 100 as cidr_utilization
        FROM vpcs
      `, { type: QueryTypes.SELECT }) as any[];

      const utilization = vpcUtilization[0] || {};

      return {
        vpc: {
          total: parseInt(utilization.total_vpcs) || 0,
          active: parseInt(utilization.active_vpcs) || 0,
          utilization: parseFloat(utilization.cidr_utilization) || 0
        },
        lastCalculated: new Date()
      };
    } catch (error) {
      return {
        vpc: { total: 0, active: 0, utilization: 0 },
        error: error.message
      };
    }
  }

  // ===================== REPORT GENERATION METHODS =====================

  /**
   * Execute a report query and return results
   */
  async executeReport(query: ReportQuery, userId?: number): Promise<ReportApiResponse> {
    try {
      const startTime = Date.now();

      // Build SQL query based on report query
      const { sql, params } = this.buildSQLQuery(query);

      // Execute query
      const results = await this.sequelize.query(sql, {
        type: QueryTypes.SELECT,
        replacements: params
      });

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          results,
          totalCount: results.length,
          executionTime,
          query: query,
          generatedAt: new Date()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          executionTime,
          version: '1.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: 'REPORT_EXECUTION_ERROR',
          message: `Failed to execute report: ${error.message}`
        }]
      };
    }
  }

  /**
   * Generate report preview
   */
  async generateReportPreview(query: ReportQuery, userId?: number): Promise<ReportApiResponse<ReportPreview>> {
    try {
      const startTime = Date.now();

      // Limit preview to 50 rows
      const previewQuery = {
        ...query,
        limit: Math.min(query.limit || 50, 50)
      };

      const { sql, params } = this.buildSQLQuery(previewQuery);
      
      const results = await this.sequelize.query(sql, {
        type: QueryTypes.SELECT,
        replacements: params
      });

      const executionTime = Date.now() - startTime;

      // Get total count without limit
      const countQuery = this.buildCountQuery(query);
      const totalResult = await this.sequelize.query(countQuery.sql, {
        type: QueryTypes.SELECT,
        replacements: countQuery.params
      }) as any[];

      const totalCount = totalResult[0]?.total || results.length;

      return {
        success: true,
        data: {
          data: results,
          totalCount,
          executionTime,
          query: sql,
          warnings: totalCount > 1000 ? ['Large dataset detected. Consider adding filters.'] : undefined
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: 'PREVIEW_ERROR',
          message: `Failed to generate preview: ${error.message}`
        }]
      };
    }
  }

  // ===================== DATA AGGREGATION METHODS =====================

  /**
   * Get aggregated data for charts
   */
  async getAggregatedData(
    resourceType: ResourceType, 
    aggregation: AggregationType, 
    groupBy: string, 
    filters?: ReportFilter[]
  ): Promise<ReportApiResponse> {
    try {
      const startTime = Date.now();

      const model = this.getModelForResourceType(resourceType);
      if (!model) {
        return {
          success: false,
          errors: [{
            code: 'INVALID_RESOURCE_TYPE',
            message: `Resource type '${resourceType}' not supported`
          }]
        };
      }

      // Build aggregation query
      const whereClause = filters ? this.buildWhereClause(filters) : {};
      
      let aggregationFunction: string;
      switch (aggregation) {
        case 'count':
          aggregationFunction = 'COUNT(*)';
          break;
        case 'sum':
          aggregationFunction = `SUM(${groupBy})`;
          break;
        case 'avg':
          aggregationFunction = `AVG(${groupBy})`;
          break;
        case 'min':
          aggregationFunction = `MIN(${groupBy})`;
          break;
        case 'max':
          aggregationFunction = `MAX(${groupBy})`;
          break;
        default:
          aggregationFunction = 'COUNT(*)';
      }

      const results = await model.findAll({
        attributes: [
          [this.sequelize.col(groupBy), 'group'],
          [this.sequelize.fn(aggregation.toUpperCase(), 
            aggregation === 'count' ? this.sequelize.col('*') : this.sequelize.col(groupBy)
          ), 'value']
        ],
        where: whereClause,
        group: [groupBy],
        order: [[this.sequelize.col('value'), 'DESC']],
        raw: true
      });

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          aggregation: {
            type: aggregation,
            groupBy,
            data: results
          },
          totalGroups: results.length,
          executionTime
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: 'AGGREGATION_ERROR',
          message: `Failed to aggregate data: ${error.message}`
        }]
      };
    }
  }

  // ===================== REPORT ANALYTICS METHODS =====================

  /**
   * Get report analytics and metrics
   */
  async getReportAnalytics(reportId?: number): Promise<ReportApiResponse<ReportAnalytics[]>> {
    try {
      // This would typically query a report_executions table
      // For now, return mock analytics data
      const analytics: ReportAnalytics[] = [{
        reportId: reportId || 1,
        totalExecutions: 145,
        lastExecuted: new Date(),
        averageExecutionTime: 2340,
        popularityScore: 85,
        viewCount: 1250,
        shareCount: 12,
        errorRate: 0.02,
        trends: [
          { date: new Date('2024-01-01'), executions: 45, avgTime: 2100, errors: 1 },
          { date: new Date('2024-01-02'), executions: 52, avgTime: 2400, errors: 0 },
          { date: new Date('2024-01-03'), executions: 48, avgTime: 2200, errors: 1 }
        ]
      }];

      return {
        success: true,
        data: analytics
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: 'ANALYTICS_ERROR',
          message: `Failed to get analytics: ${error.message}`
        }]
      };
    }
  }

  // ===================== PRIVATE HELPER METHODS =====================

  /**
   * Build SQL query from ReportQuery
   */
  private buildSQLQuery(query: ReportQuery): { sql: string; params: any } {
    const { resourceTypes, fields, filters, groupBy, orderBy, limit } = query;

    // For simplicity, handle single resource type for now
    const resourceType = resourceTypes[0] || 'vpc';
    const tableName = this.getTableName(resourceType);
    
    // Build SELECT clause
    const selectFields = fields.length > 0 ? fields.join(', ') : '*';
    
    // Build WHERE clause
    let whereClause = '';
    const params: any = {};
    
    if (filters && filters.length > 0) {
      const conditions: string[] = [];
      filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(filter, index, params);
        conditions.push(condition);
      });
      whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    }

    // Build GROUP BY clause
    const groupByClause = groupBy && groupBy.length > 0 ? `GROUP BY ${groupBy.join(', ')}` : '';

    // Build ORDER BY clause
    let orderByClause = '';
    if (orderBy && orderBy.length > 0) {
      const orderClauses = orderBy.map(sort => `${sort.field} ${sort.direction}`);
      orderByClause = `ORDER BY ${orderClauses.join(', ')}`;
    }

    // Build LIMIT clause
    const limitClause = limit ? `LIMIT ${limit}` : '';

    const sql = `
      SELECT ${selectFields}
      FROM ${tableName}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      ${limitClause}
    `.trim().replace(/\s+/g, ' ');

    return { sql, params };
  }

  /**
   * Build count query for total records
   */
  private buildCountQuery(query: ReportQuery): { sql: string; params: any } {
    const { resourceTypes, filters } = query;
    const resourceType = resourceTypes[0] || 'vpc';
    const tableName = this.getTableName(resourceType);
    
    let whereClause = '';
    const params: any = {};
    
    if (filters && filters.length > 0) {
      const conditions: string[] = [];
      filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(filter, index, params);
        conditions.push(condition);
      });
      whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    }

    const sql = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    
    return { sql, params };
  }

  /**
   * Build filter condition for SQL WHERE clause
   */
  private buildFilterCondition(filter: ReportFilter, index: number, params: any): string {
    const { field, operator, value, values } = filter;
    const paramKey = `param_${index}`;

    switch (operator) {
      case 'equals':
        params[paramKey] = value;
        return `${field} = :${paramKey}`;
      case 'not_equals':
        params[paramKey] = value;
        return `${field} != :${paramKey}`;
      case 'greater_than':
        params[paramKey] = value;
        return `${field} > :${paramKey}`;
      case 'less_than':
        params[paramKey] = value;
        return `${field} < :${paramKey}`;
      case 'in':
        params[paramKey] = values || [value];
        return `${field} IN (:${paramKey})`;
      case 'like':
        params[paramKey] = `%${value}%`;
        return `${field} LIKE :${paramKey}`;
      case 'starts_with':
        params[paramKey] = `${value}%`;
        return `${field} LIKE :${paramKey}`;
      case 'exists':
        return `${field} IS NOT NULL`;
      case 'not_exists':
        return `${field} IS NULL`;
      default:
        params[paramKey] = value;
        return `${field} = :${paramKey}`;
    }
  }

  /**
   * Build WHERE clause from filters
   */
  private buildWhereClause(filters: ReportFilter[]): any {
    const whereClause: any = {};

    filters.forEach(filter => {
      const { field, operator, value, values } = filter;

      switch (operator) {
        case 'equals':
          whereClause[field] = value;
          break;
        case 'not_equals':
          whereClause[field] = { [Op.ne]: value };
          break;
        case 'greater_than':
          whereClause[field] = { [Op.gt]: value };
          break;
        case 'less_than':
          whereClause[field] = { [Op.lt]: value };
          break;
        case 'in':
          whereClause[field] = { [Op.in]: values || [value] };
          break;
        case 'like':
          whereClause[field] = { [Op.like]: `%${value}%` };
          break;
        case 'exists':
          whereClause[field] = { [Op.not]: null };
          break;
        case 'not_exists':
          whereClause[field] = null;
          break;
      }
    });

    return whereClause;
  }

  /**
   * Get model for resource type
   */
  private getModelForResourceType(resourceType: ResourceType): any {
    return this.models[resourceType];
  }

  /**
   * Get table name for resource type
   */
  private getTableName(resourceType: ResourceType): string {
    const tableNames: Record<string, string> = {
      vpc: 'vpcs',
      transitGateway: 'transit_gateways',
      customerGateway: 'customer_gateways',
      vpcEndpoint: 'vpc_endpoints'
    };
    return tableNames[resourceType] || 'vpcs';
  }
}