/**
 * Report Validation Schemas
 * Joi validation schemas for all report-related endpoints
 */

import Joi from 'joi';

const reportFilterSchema = Joi.object({
  field: Joi.string().required(),
  operator: Joi.string().valid(
    'equals', 'not_equals', 
    'greater_than', 'greater_than_equal',
    'less_than', 'less_than_equal',
    'in', 'not_in',
    'like', 'not_like',
    'starts_with', 'ends_with',
    'exists', 'not_exists',
    'between'
  ).required(),
  value: Joi.any().optional(),
  values: Joi.array().optional(),
  logicalOperator: Joi.string().valid('AND', 'OR', 'NOT').default('AND')
});

const reportSortSchema = Joi.object({
  field: Joi.string().required(),
  direction: Joi.string().valid('ASC', 'DESC').required()
});

const dateRangeSchema = Joi.object({
  start: Joi.date().required(),
  end: Joi.date().required(),
  preset: Joi.string().valid(
    'today', 'yesterday', 'last_7_days', 'last_30_days', 
    'last_90_days', 'this_month', 'last_month', 
    'this_year', 'last_year', 'custom'
  ).optional()
});

const reportQuerySchema = Joi.object({
  resourceTypes: Joi.array().items(
    Joi.string().valid('vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all')
  ).min(1).required(),
  fields: Joi.array().items(Joi.string()).min(1).required(),
  filters: Joi.array().items(reportFilterSchema).optional(),
  groupBy: Joi.array().items(Joi.string()).optional(),
  orderBy: Joi.array().items(reportSortSchema).optional(),
  limit: Joi.number().integer().min(1).max(10000).optional(),
  includeDeleted: Joi.boolean().default(false),
  dateRange: dateRangeSchema.optional()
});

const chartConfigurationSchema = Joi.object({
  type: Joi.string().valid('bar', 'line', 'pie', 'donut', 'gauge', 'area', 'scatter', 'heatmap').required(),
  title: Joi.string().required(),
  description: Joi.string().optional(),
  dataSource: Joi.string().required(),
  aggregation: Joi.string().valid('count', 'sum', 'avg', 'min', 'max', 'distinct').required(),
  groupBy: Joi.string().optional(),
  filterBy: Joi.array().items(reportFilterSchema).optional(),
  colors: Joi.array().items(Joi.string()).optional(),
  options: Joi.object().optional()
});

const reportVisualizationSchema = Joi.object({
  type: Joi.string().valid('table', 'chart', 'both').required(),
  chart: chartConfigurationSchema.optional(),
  table: Joi.object({
    columns: Joi.array().items(Joi.object({
      field: Joi.string().required(),
      title: Joi.string().required(),
      type: Joi.string().valid('text', 'number', 'date', 'boolean', 'status').required(),
      width: Joi.number().optional(),
      sortable: Joi.boolean().default(true),
      filterable: Joi.boolean().default(true)
    })).required(),
    pagination: Joi.boolean().default(true),
    sorting: Joi.boolean().default(true),
    filtering: Joi.boolean().default(true)
  }).optional(),
  layout: Joi.string().valid('horizontal', 'vertical').default('vertical')
});

const emailDeliverySchema = Joi.object({
  recipients: Joi.array().items(Joi.string().email()).min(1).required(),
  subject: Joi.string().max(200).optional(),
  body: Joi.string().max(2000).optional(),
  formats: Joi.array().items(
    Joi.string().valid('pdf', 'excel', 'csv', 'json', 'html')
  ).min(1).required(),
  includeCharts: Joi.boolean().default(false)
});

const webhookDeliverySchema = Joi.object({
  url: Joi.string().uri().required(),
  headers: Joi.object().optional(),
  format: Joi.string().valid('pdf', 'excel', 'csv', 'json', 'html').required()
});

const storageDeliverySchema = Joi.object({
  path: Joi.string().required(),
  format: Joi.string().valid('pdf', 'excel', 'csv', 'json', 'html').required(),
  retention: Joi.number().integer().min(1).max(365).optional()
});

const reportDeliverySchema = Joi.object({
  method: Joi.array().items(
    Joi.string().valid('email', 'webhook', 'storage', 'dashboard')
  ).min(1).required(),
  email: emailDeliverySchema.optional(),
  webhook: webhookDeliverySchema.optional(),
  storage: storageDeliverySchema.optional()
});

const reportScheduleSchema = Joi.object({
  enabled: Joi.boolean().required(),
  frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'custom').required(),
  cronExpression: Joi.string().when('frequency', {
    is: 'custom',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  timezone: Joi.string().default('UTC'),
  parameters: Joi.object().optional(),
  delivery: reportDeliverySchema.required()
});

const reportPermissionsSchema = Joi.object({
  isPublic: Joi.boolean().default(false),
  owner: Joi.number().integer().positive().required(),
  viewers: Joi.array().items(Joi.number().integer().positive()).default([]),
  editors: Joi.array().items(Joi.number().integer().positive()).default([]),
  groups: Joi.array().items(Joi.object({
    groupId: Joi.number().integer().positive().required(),
    permission: Joi.string().valid('view', 'edit', 'admin').required()
  })).optional()
});

const reportMetadataSchema = Joi.object({
  version: Joi.string().required(),
  tags: Joi.array().items(Joi.string()).default([]),
  source: Joi.string().required(),
  lastModifiedBy: Joi.number().integer().positive().optional(),
  size: Joi.number().integer().optional(),
  complexity: Joi.string().valid('simple', 'moderate', 'complex', 'advanced').default('simple'),
  dependencies: Joi.array().items(Joi.string()).optional(),
  performance: Joi.object({
    avgExecutionTime: Joi.number().required(),
    maxExecutionTime: Joi.number().required(),
    memoryUsage: Joi.number().required(),
    resourceIntensive: Joi.boolean().required()
  }).optional()
});

const dashboardWidgetSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('metric', 'chart', 'table', 'status').required(),
  title: Joi.string().required(),
  position: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
    width: Joi.number().required(),
    height: Joi.number().required()
  }).required(),
  configuration: Joi.object({
    dataSource: Joi.string().required(),
    query: reportQuerySchema.optional(),
    chart: chartConfigurationSchema.optional(),
    metric: Joi.object({
      value: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
      label: Joi.string().required(),
      unit: Joi.string().optional(),
      format: Joi.string().valid('number', 'percentage', 'currency', 'bytes').optional(),
      trend: Joi.object({
        value: Joi.number().required(),
        direction: Joi.string().valid('up', 'down', 'stable').required(),
        period: Joi.string().required()
      }).optional(),
      threshold: Joi.object({
        warning: Joi.number().required(),
        critical: Joi.number().required(),
        goodDirection: Joi.string().valid('up', 'down').required()
      }).optional()
    }).optional(),
    table: Joi.object({
      columns: Joi.array().items(Joi.object({
        field: Joi.string().required(),
        title: Joi.string().required(),
        type: Joi.string().valid('text', 'number', 'date', 'boolean', 'status').required(),
        width: Joi.number().optional(),
        sortable: Joi.boolean().default(true),
        filterable: Joi.boolean().default(true)
      })).required(),
      pagination: Joi.boolean().default(true),
      sorting: Joi.boolean().default(true),
      filtering: Joi.boolean().default(true)
    }).optional(),
    status: Joi.object({
      statusField: Joi.string().required(),
      statusMap: Joi.object().pattern(Joi.string(), Joi.object({
        label: Joi.string().required(),
        color: Joi.string().required(),
        icon: Joi.string().optional()
      })).required()
    }).optional()
  }).required(),
  refreshInterval: Joi.number().integer().min(5).optional()
});

export const ReportValidationSchemas = {
  // Report Generation
  generateReport: {
    body: reportQuerySchema
  },

  // Report Definition
  createReport: {
    body: Joi.object({
      name: Joi.string().min(1).max(200).required(),
      description: Joi.string().max(1000).optional(),
      category: Joi.string().valid('inventory', 'compliance', 'performance', 'security', 'utilization', 'custom').required(),
      type: Joi.string().valid('tabular', 'chart', 'dashboard', 'hybrid').required(),
      query: reportQuerySchema.required(),
      visualization: reportVisualizationSchema.optional(),
      schedule: reportScheduleSchema.optional(),
      permissions: reportPermissionsSchema.required(),
      metadata: reportMetadataSchema.required()
    })
  },

  updateReport: {
    params: {
      id: Joi.number().integer().positive().required()
    },
    body: Joi.object({
      name: Joi.string().min(1).max(200).optional(),
      description: Joi.string().max(1000).optional(),
      category: Joi.string().valid('inventory', 'compliance', 'performance', 'security', 'utilization', 'custom').optional(),
      query: reportQuerySchema.optional(),
      visualization: reportVisualizationSchema.optional(),
      schedule: reportScheduleSchema.optional(),
      permissions: reportPermissionsSchema.optional(),
      metadata: reportMetadataSchema.optional()
    })
  },

  // Report Scheduling
  scheduleReport: {
    body: Joi.object({
      id: Joi.number().integer().positive().optional(),
      name: Joi.string().min(1).max(200).required(),
      description: Joi.string().max(1000).optional(),
      category: Joi.string().valid('inventory', 'compliance', 'performance', 'security', 'utilization', 'custom').required(),
      type: Joi.string().valid('tabular', 'chart', 'dashboard', 'hybrid').required(),
      query: reportQuerySchema.required(),
      visualization: reportVisualizationSchema.optional(),
      schedule: reportScheduleSchema.required(),
      permissions: reportPermissionsSchema.required(),
      metadata: reportMetadataSchema.required(),
      createdBy: Joi.number().integer().positive().required()
    })
  },

  // Export
  exportReport: {
    body: Joi.object({
      data: Joi.array().required(),
      format: Joi.string().valid('pdf', 'excel', 'csv', 'json', 'html').required(),
      options: Joi.object({
        includeCharts: Joi.boolean().default(false),
        includeMetadata: Joi.boolean().default(true),
        compression: Joi.boolean().default(false),
        password: Joi.string().min(4).optional(),
        template: Joi.string().optional()
      }).optional(),
      metadata: Joi.object().optional()
    })
  },

  // Dashboard
  createDashboard: {
    body: Joi.object({
      name: Joi.string().min(1).max(200).required(),
      description: Joi.string().max(1000).optional(),
      layout: Joi.object({
        columns: Joi.number().integer().min(1).max(12).required(),
        rows: Joi.number().integer().min(1).required(),
        gap: Joi.number().min(0).required(),
        responsive: Joi.boolean().default(true),
        breakpoints: Joi.object().pattern(Joi.string(), Joi.object({
          columns: Joi.number().integer().min(1).max(12).required(),
          width: Joi.number().min(1).required()
        })).optional()
      }).required(),
      widgets: Joi.array().items(dashboardWidgetSchema).required(),
      permissions: reportPermissionsSchema.required(),
      settings: Joi.object({
        refreshInterval: Joi.number().integer().min(5).optional(),
        autoRefresh: Joi.boolean().default(false),
        theme: Joi.string().valid('light', 'dark', 'auto').default('light'),
        showHeader: Joi.boolean().default(true),
        showRefreshButton: Joi.boolean().default(true),
        allowWidgetMove: Joi.boolean().default(true),
        allowWidgetResize: Joi.boolean().default(true)
      }).required(),
      createdBy: Joi.number().integer().positive().required()
    })
  },

  // Report Sharing
  shareReport: {
    body: Joi.object({
      reportId: Joi.number().integer().positive().required(),
      expiresAt: Joi.date().greater('now').optional(),
      maxViews: Joi.number().integer().positive().optional(),
      password: Joi.string().min(4).optional()
    })
  },

  // Parameters validation
  params: {
    id: Joi.number().integer().positive().required(),
    reportId: Joi.number().integer().positive().required(),
    templateId: Joi.string().required(),
    fileName: Joi.string().required(),
    widgetType: Joi.string().valid('metrics', 'charts', 'status', 'activity').required()
  },

  // Query validation
  query: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    order: Joi.string().valid('ASC', 'DESC').default('ASC'),
    search: Joi.string().max(500).optional(),
    category: Joi.string().valid('inventory', 'compliance', 'performance', 'security', 'utilization', 'custom').optional(),
    timeRange: Joi.string().valid('1h', '24h', '7d', '30d').default('24h'),
    refresh: Joi.boolean().default(false),
    includePublic: Joi.boolean().default(true)
  },

  // Report Builder
  builderStep: {
    body: Joi.object({
      step: Joi.string().valid(
        'datasource', 'fields', 'filters', 'grouping', 'sorting', 
        'visualization', 'schedule', 'permissions'
      ).required(),
      configuration: Joi.object({
        name: Joi.string().min(1).max(200).optional(),
        description: Joi.string().max(1000).optional(),
        category: Joi.string().valid('inventory', 'compliance', 'performance', 'security', 'utilization', 'custom').optional(),
        datasource: reportQuerySchema.optional(),
        visualization: reportVisualizationSchema.optional(),
        schedule: reportScheduleSchema.optional(),
        permissions: reportPermissionsSchema.optional()
      }).required()
    })
  }
};