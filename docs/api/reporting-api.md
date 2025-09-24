# Cloud Network CMDB Reporting API Documentation

## Overview

The Cloud Network CMDB Reporting API provides comprehensive endpoints for generating, managing, and exporting network infrastructure reports across multiple cloud providers (AWS, Azure, GCP, Oracle Cloud).

**Base URL:** `https://api.networkdb.example.com/api/reports`

**API Version:** 1.0

**Authentication:** Bearer Token Required

---

## Table of Contents

1. [Authentication](#authentication)
2. [Dashboard Endpoints](#dashboard-endpoints)
3. [Report Execution](#report-execution)
4. [Data Aggregation](#data-aggregation)
5. [Export Services](#export-services)
6. [Analytics](#analytics)
7. [Data Models](#data-models)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Examples](#examples)

---

## Authentication

All API endpoints require authentication using Bearer tokens.

**Header Format:**
```
Authorization: Bearer <your_api_token>
Content-Type: application/json
```

**Example:**
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     -H "Content-Type: application/json" \
     https://api.networkdb.example.com/api/reports/dashboard
```

---

## Dashboard Endpoints

### GET /dashboard

Retrieves comprehensive dashboard data including resource counts, health metrics, and recent activity.

**Parameters:**
- `userId` (optional, query): Filter data for specific user

**Response:**
```json
{
  "success": true,
  "data": {
    "resourceCounts": {
      "vpc": 250,
      "transitGateway": 45,
      "customerGateway": 23,
      "vpcEndpoint": 178,
      "total": 496
    },
    "healthStatus": {
      "healthy": 471,
      "warning": 22,
      "critical": 3,
      "total": 496,
      "healthPercentage": 95,
      "lastChecked": "2024-01-15T10:30:00Z"
    },
    "recentActivity": [
      {
        "type": "vpc",
        "id": "vpc-0123456789",
        "action": "created",
        "timestamp": "2024-01-15T10:25:00Z"
      }
    ],
    "utilizationMetrics": {
      "vpc": {
        "total": 250,
        "active": 238,
        "utilization": 95.2
      },
      "lastCalculated": "2024-01-15T10:30:00Z"
    },
    "lastUpdated": "2024-01-15T10:30:00Z"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "executionTime": 156,
    "version": "1.0"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "errors": [
    {
      "code": "DASHBOARD_ERROR",
      "message": "Failed to load dashboard data: Database connection timeout"
    }
  ]
}
```

---

## Report Execution

### POST /execute

Executes a custom report query and returns results.

**Request Body:**
```json
{
  "query": {
    "resourceTypes": ["vpc", "transitGateway"],
    "fields": ["vpc_id", "cidr_block", "state", "region", "account_id"],
    "filters": [
      {
        "field": "state",
        "operator": "equals",
        "value": "available"
      },
      {
        "field": "region",
        "operator": "in",
        "values": ["us-east-1", "us-west-2"]
      }
    ],
    "groupBy": ["region"],
    "orderBy": [
      {
        "field": "region",
        "direction": "ASC"
      }
    ],
    "limit": 100
  },
  "userId": 123 // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "vpc_id": "vpc-0123456789",
        "cidr_block": "10.0.0.0/16",
        "state": "available",
        "region": "us-east-1",
        "account_id": "123456789012"
      }
    ],
    "totalCount": 85,
    "executionTime": 234,
    "query": {
      // Original query object
    },
    "generatedAt": "2024-01-15T10:30:00Z"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "executionTime": 234,
    "version": "1.0"
  }
}
```

### POST /preview

Generates a preview of a report with limited results (max 50 rows).

**Request Body:** Same as `/execute`

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      // Limited preview data (max 50 rows)
    ],
    "totalCount": 1250,
    "executionTime": 123,
    "query": "SELECT vpc_id, cidr_block, state FROM vpcs WHERE state = 'available' LIMIT 50",
    "warnings": [
      "Large dataset detected. Consider adding filters."
    ]
  }
}
```

---

## Data Aggregation

### POST /aggregate

Performs data aggregation operations like COUNT, SUM, AVG, MIN, MAX.

**Request Body:**
```json
{
  "resourceType": "vpc",
  "aggregation": "count",
  "groupBy": "region",
  "filters": [
    {
      "field": "state",
      "operator": "equals",
      "value": "available"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "aggregation": {
      "type": "count",
      "groupBy": "region",
      "data": [
        {
          "group": "us-east-1",
          "value": 125
        },
        {
          "group": "us-west-2",
          "value": 89
        },
        {
          "group": "eu-west-1",
          "value": 36
        }
      ]
    },
    "totalGroups": 3,
    "executionTime": 89
  }
}
```

**Supported Aggregation Types:**
- `count`: Count of records
- `sum`: Sum of numeric field values
- `avg`: Average of numeric field values
- `min`: Minimum value
- `max`: Maximum value

---

## Export Services

### POST /export

Exports report data in various formats (CSV, Excel, JSON, PDF, HTML).

**Request Body:**
```json
{
  "query": {
    // Same as report execution query
  },
  "format": "excel",
  "options": {
    "includeMetadata": true,
    "compression": "gzip", // for CSV
    "customFields": ["vpc_id", "cidr_block", "region"] // for Excel
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filePath": "/exports/report_2024-01-15T10-30-00.excel",
    "fileName": "report_2024-01-15T10-30-00.excel",
    "size": 2048576
  }
}
```

**Supported Export Formats:**
- `csv`: Comma-separated values
- `excel`: Microsoft Excel format
- `json`: JSON format with optional metadata
- `pdf`: PDF document
- `html`: HTML table format

**Export Options:**
- `includeMetadata`: Include generation timestamp and metadata
- `compression`: Compression format for CSV exports ("gzip", "zip")
- `customFields`: Specific fields to include in Excel exports

### GET /export/{fileName}

Downloads an exported file.

**Response:** File download stream

**Error Response (404):**
```json
{
  "success": false,
  "errors": [
    {
      "code": "FILE_NOT_FOUND",
      "message": "Export file not found or has expired"
    }
  ]
}
```

---

## Analytics

### GET /analytics

Retrieves analytics and metrics for report usage.

**Parameters:**
- `reportId` (optional, query): Specific report ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "reportId": 1,
      "totalExecutions": 145,
      "lastExecuted": "2024-01-15T10:30:00Z",
      "averageExecutionTime": 2340,
      "popularityScore": 85,
      "viewCount": 1250,
      "shareCount": 12,
      "errorRate": 0.02,
      "trends": [
        {
          "date": "2024-01-01",
          "executions": 45,
          "avgTime": 2100,
          "errors": 1
        },
        {
          "date": "2024-01-02",
          "executions": 52,
          "avgTime": 2400,
          "errors": 0
        }
      ]
    }
  ]
}
```

---

## Data Models

### Resource Types

```typescript
type ResourceType = 'vpc' | 'transitGateway' | 'customerGateway' | 'vpcEndpoint'
```

### Filter Operators

```typescript
type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'like'
  | 'starts_with'
  | 'exists'
  | 'not_exists'
```

### Report Query Structure

```typescript
interface ReportQuery {
  resourceTypes: ResourceType[]
  fields: string[]
  filters?: ReportFilter[]
  groupBy?: string[]
  orderBy?: SortField[]
  limit?: number
}

interface ReportFilter {
  field: string
  operator: FilterOperator
  value?: any
  values?: any[]
}

interface SortField {
  field: string
  direction: 'ASC' | 'DESC'
}
```

### API Response Structure

```typescript
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  errors?: ApiError[]
  metadata?: {
    timestamp: string
    executionTime: number
    version: string
  }
}

interface ApiError {
  code: string
  message: string
  field?: string
}
```

---

## Error Handling

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication | 401 |
| `AUTHORIZATION_ERROR` | Insufficient permissions | 403 |
| `RESOURCE_NOT_FOUND` | Requested resource not found | 404 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `DATABASE_ERROR` | Database operation failed | 500 |
| `EXPORT_ERROR` | File export failed | 500 |
| `DASHBOARD_ERROR` | Dashboard data loading failed | 500 |
| `REPORT_EXECUTION_ERROR` | Report execution failed | 500 |
| `PREVIEW_ERROR` | Report preview generation failed | 500 |
| `AGGREGATION_ERROR` | Data aggregation failed | 500 |
| `ANALYTICS_ERROR` | Analytics data retrieval failed | 500 |

### Error Response Format

```json
{
  "success": false,
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Invalid resource type specified",
      "field": "query.resourceTypes[0]"
    }
  ]
}
```

---

## Rate Limiting

API requests are limited to prevent abuse:

- **Standard endpoints:** 100 requests per minute per API key
- **Export endpoints:** 10 requests per minute per API key
- **Dashboard endpoint:** 60 requests per minute per API key

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

**Rate Limit Exceeded Response (429):**
```json
{
  "success": false,
  "errors": [
    {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "API rate limit exceeded. Try again in 60 seconds."
    }
  ]
}
```

---

## Examples

### Example 1: Basic VPC Report

```bash
curl -X POST https://api.networkdb.example.com/api/reports/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "resourceTypes": ["vpc"],
      "fields": ["vpc_id", "cidr_block", "state", "region"],
      "filters": [
        {
          "field": "state",
          "operator": "equals",
          "value": "available"
        }
      ],
      "orderBy": [
        {
          "field": "region",
          "direction": "ASC"
        }
      ],
      "limit": 50
    }
  }'
```

### Example 2: Regional Resource Distribution

```bash
curl -X POST https://api.networkdb.example.com/api/reports/aggregate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceType": "vpc",
    "aggregation": "count",
    "groupBy": "region"
  }'
```

### Example 3: Multi-Provider Health Report

```bash
curl -X POST https://api.networkdb.example.com/api/reports/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "resourceTypes": ["vpc", "transitGateway"],
      "fields": ["*"],
      "filters": [
        {
          "field": "provider",
          "operator": "in",
          "values": ["aws", "azure", "gcp"]
        },
        {
          "field": "state",
          "operator": "not_equals",
          "value": "available"
        }
      ],
      "groupBy": ["provider", "state"],
      "limit": 200
    }
  }'
```

### Example 4: Export Large Dataset

```bash
curl -X POST https://api.networkdb.example.com/api/reports/export \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "resourceTypes": ["vpcEndpoint"],
      "fields": ["vpc_endpoint_id", "vpc_id", "service_name", "endpoint_type", "state"],
      "filters": [
        {
          "field": "created_at",
          "operator": "greater_than",
          "value": "2024-01-01T00:00:00Z"
        }
      ],
      "orderBy": [
        {
          "field": "created_at",
          "direction": "DESC"
        }
      ],
      "limit": 5000
    },
    "format": "excel",
    "options": {
      "includeMetadata": true,
      "customFields": ["vpc_endpoint_id", "service_name", "state"]
    }
  }'
```

### Example 5: Complex Filtering

```bash
curl -X POST https://api.networkdb.example.com/api/reports/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "resourceTypes": ["vpc"],
      "fields": ["vpc_id", "cidr_block", "region", "account_id", "created_at"],
      "filters": [
        {
          "field": "cidr_block",
          "operator": "like",
          "value": "10.%"
        },
        {
          "field": "region",
          "operator": "in",
          "values": ["us-east-1", "us-west-2", "eu-west-1"]
        },
        {
          "field": "created_at",
          "operator": "greater_than",
          "value": "2023-12-01T00:00:00Z"
        },
        {
          "field": "account_id",
          "operator": "exists"
        }
      ],
      "orderBy": [
        {
          "field": "created_at",
          "direction": "DESC"
        },
        {
          "field": "region",
          "direction": "ASC"
        }
      ],
      "limit": 1000
    }
  }'
```

---

## JavaScript SDK Examples

### Initialize SDK

```javascript
import { NetworkCMDBAPI } from '@networkdb/api-client'

const api = new NetworkCMDBAPI({
  baseURL: 'https://api.networkdb.example.com',
  apiKey: 'your_api_token'
})
```

### Dashboard Data

```javascript
async function getDashboardData() {
  try {
    const dashboard = await api.reports.getDashboard()
    console.log('Resource counts:', dashboard.data.resourceCounts)
    return dashboard
  } catch (error) {
    console.error('Failed to load dashboard:', error.message)
  }
}
```

### Execute Report

```javascript
async function executeVPCReport() {
  const query = {
    resourceTypes: ['vpc'],
    fields: ['vpc_id', 'cidr_block', 'state', 'region'],
    filters: [
      {
        field: 'state',
        operator: 'equals',
        value: 'available'
      }
    ],
    orderBy: [
      {
        field: 'region',
        direction: 'ASC'
      }
    ],
    limit: 100
  }

  try {
    const report = await api.reports.execute(query)
    console.log('VPC Report:', report.data.results)
    return report
  } catch (error) {
    console.error('Report execution failed:', error.message)
  }
}
```

### Export Data

```javascript
async function exportToExcel() {
  const query = {
    resourceTypes: ['vpcEndpoint'],
    fields: ['vpc_endpoint_id', 'service_name', 'state'],
    limit: 1000
  }

  try {
    const exportResult = await api.reports.export(query, 'excel', {
      includeMetadata: true
    })

    // Download the file
    const fileBlob = await api.reports.downloadExport(exportResult.data.fileName)

    // Create download link
    const url = URL.createObjectURL(fileBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportResult.data.fileName
    link.click()

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Export failed:', error.message)
  }
}
```

---

## Python SDK Examples

### Initialize SDK

```python
from networkdb_api import NetworkCMDBAPI

api = NetworkCMDBAPI(
    base_url='https://api.networkdb.example.com',
    api_key='your_api_token'
)
```

### Execute Report

```python
async def get_vpc_health_report():
    query = {
        'resourceTypes': ['vpc'],
        'fields': ['vpc_id', 'state', 'region', 'health_status'],
        'filters': [
            {
                'field': 'state',
                'operator': 'not_equals',
                'value': 'available'
            }
        ],
        'orderBy': [
            {
                'field': 'region',
                'direction': 'ASC'
            }
        ]
    }

    try:
        report = await api.reports.execute(query)
        return report['data']['results']
    except Exception as e:
        print(f"Report execution failed: {e}")
        return []
```

### Aggregate Data

```python
async def get_regional_distribution():
    try:
        aggregation = await api.reports.aggregate(
            resource_type='vpc',
            aggregation_type='count',
            group_by='region'
        )

        for item in aggregation['data']['aggregation']['data']:
            print(f"Region {item['group']}: {item['value']} VPCs")

        return aggregation
    except Exception as e:
        print(f"Aggregation failed: {e}")
        return None
```

---

## Best Practices

### 1. Efficient Querying

- **Use filters:** Always apply filters to reduce dataset size
- **Limit results:** Use appropriate `limit` values to avoid large responses
- **Index-friendly filters:** Use exact matches and `in` operators when possible
- **Avoid wildcards:** Minimize use of `like` operators with leading wildcards

### 2. Export Optimization

- **Batch processing:** For large exports, consider splitting into smaller batches
- **Appropriate formats:** Use CSV for large datasets, Excel for formatted reports
- **Compression:** Enable compression for large CSV exports
- **Cleanup:** Exported files are automatically cleaned up after 24 hours

### 3. Performance Guidelines

- **Pagination:** Use `limit` and offset for large datasets
- **Caching:** Dashboard data is cached for 5 minutes
- **Concurrent requests:** Limit concurrent report executions
- **Timeout handling:** Set appropriate timeout values for large queries

### 4. Error Handling

- **Retry logic:** Implement exponential backoff for retries
- **Graceful degradation:** Handle partial failures gracefully
- **User feedback:** Provide meaningful error messages to users
- **Logging:** Log API errors for debugging

### 5. Security

- **Token management:** Rotate API tokens regularly
- **HTTPS only:** Always use HTTPS for API requests
- **Input validation:** Validate all user inputs before sending to API
- **Access control:** Implement proper authorization checks

---

## Support

For API support and questions:

- **Documentation:** [https://docs.networkdb.example.com](https://docs.networkdb.example.com)
- **GitHub Issues:** [https://github.com/networkdb/api/issues](https://github.com/networkdb/api/issues)
- **Email Support:** [api-support@networkdb.example.com](mailto:api-support@networkdb.example.com)
- **Status Page:** [https://status.networkdb.example.com](https://status.networkdb.example.com)

---

## Changelog

### Version 1.0.0 (Current)
- Initial API release
- Dashboard endpoints
- Report execution and preview
- Data aggregation
- Multi-format export support
- Analytics and metrics
- Comprehensive error handling
- Rate limiting implementation