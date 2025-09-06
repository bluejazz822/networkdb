# Advanced Search and Filtering API Documentation

## Overview

The Network CMDB Search API provides sophisticated search and filtering capabilities for all network resources. It supports full-text search, advanced multi-criteria filtering, saved queries, auto-complete, and performance optimizations for large datasets.

## Features

- **Full-text search** across all network resource fields
- **Advanced filtering** with logical operators (AND, OR, NOT)
- **Saved queries** with user management and sharing
- **Auto-complete** suggestions for search terms
- **Performance optimization** with Redis caching and database indexing
- **Faceted search** with aggregated results
- **Pagination** and sorting support
- **Real-time search** with sub-second response times

## API Endpoints

### Main Search

#### POST /api/search/{resourceType}
Perform advanced search with filtering and sorting.

**Resource Types:**
- `vpc` - Virtual Private Clouds
- `transitGateway` - Transit Gateways
- `customerGateway` - Customer Gateways
- `vpcEndpoint` - VPC Endpoints
- `all` - Search across all resource types

**Request Body:**
```json
{
  "text": "search term",
  "filters": [
    {
      "field": "region",
      "operator": "eq",
      "value": "us-east-1",
      "logicalOperator": "AND"
    },
    {
      "field": "state",
      "operator": "in", 
      "values": ["available", "active"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  },
  "sorting": [
    {
      "field": "name",
      "direction": "ASC"
    }
  ],
  "includeHighlight": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [...], // Array of matching resources
    "totalCount": 150,
    "searchTime": 45,
    "facets": [...],
    "highlights": [...],
    "suggestions": [...],
    "page": 1,
    "limit": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Simple Search

#### GET /api/search/{resourceType}/simple
Simple search with query parameters.

**Query Parameters:**
- `q` - Search term
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)
- `sort` - Field to sort by
- `order` - Sort direction (ASC/DESC)

**Example:**
```bash
GET /api/search/vpc/simple?q=production&page=1&limit=10&sort=name&order=ASC
```

### Auto-Complete

#### GET /api/search/autocomplete
Get search suggestions and auto-complete results.

**Query Parameters:**
- `term` - Search term (required)
- `field` - Specific field to search (optional)
- `resourceType` - Resource type filter (default: all)
- `limit` - Number of suggestions (default: 10, max: 50)

**Example:**
```bash
GET /api/search/autocomplete?term=prod&resourceType=vpc&limit=5
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "text": "production",
        "value": "production",
        "type": "value",
        "score": 0.95,
        "metadata": {
          "count": 45,
          "field": "environment",
          "resourceType": "vpc"
        }
      }
    ],
    "searchTime": 12
  }
}
```

### Saved Queries

#### GET /api/search/saved
Get saved queries for the current user.

**Query Parameters:**
- `resourceType` - Filter by resource type
- `includePublic` - Include public queries (default: true)

#### POST /api/search/saved
Save a new search query.

**Request Body:**
```json
{
  "name": "Production VPCs in US East",
  "description": "All production VPCs in US East region",
  "query": {
    "filters": [
      {
        "field": "environment",
        "operator": "eq",
        "value": "production"
      },
      {
        "field": "region",
        "operator": "eq",
        "value": "us-east-1"
      }
    ]
  },
  "resourceType": "vpc",
  "isPublic": false,
  "tags": ["production", "us-east"]
}
```

#### PUT /api/search/saved/{id}
Update a saved query.

#### DELETE /api/search/saved/{id}
Delete a saved query.

#### POST /api/search/saved/{id}/execute
Execute a saved query with optional parameter overrides.

**Request Body:**
```json
{
  "overrides": {
    "pagination": {
      "page": 2,
      "limit": 50
    }
  }
}
```

### Advanced Features

#### POST /api/search/{resourceType}/advanced
Advanced search with facets and highlighting.

**Request Body:**
```json
{
  "query": {
    "text": "production",
    "filters": [...]
  },
  "facets": ["region", "state", "environment"],
  "highlight": {
    "enabled": true,
    "fields": ["name", "description"],
    "fragmentSize": 150,
    "maxFragments": 3
  }
}
```

#### GET /api/search/{resourceType}/fields
Get searchable fields for a resource type.

#### GET /api/search/popular/{resourceType?}
Get popular search terms.

#### GET /api/search/metrics
Get search analytics and performance metrics.

#### GET /api/search/health
Search system health check.

## Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `{"field": "region", "operator": "eq", "value": "us-east-1"}` |
| `ne` | Not equals | `{"field": "state", "operator": "ne", "value": "deleted"}` |
| `gt` | Greater than | `{"field": "createdAt", "operator": "gt", "value": "2024-01-01"}` |
| `gte` | Greater than or equal | `{"field": "useCount", "operator": "gte", "value": 5}` |
| `lt` | Less than | `{"field": "createdAt", "operator": "lt", "value": "2024-12-31"}` |
| `lte` | Less than or equal | `{"field": "useCount", "operator": "lte", "value": 100}` |
| `in` | In array | `{"field": "region", "operator": "in", "values": ["us-east-1", "us-west-2"]}` |
| `nin` | Not in array | `{"field": "state", "operator": "nin", "values": ["deleted", "failed"]}` |
| `like` | Contains (case insensitive) | `{"field": "name", "operator": "like", "value": "prod"}` |
| `startsWith` | Starts with | `{"field": "vpcId", "operator": "startsWith", "value": "vpc-"}` |
| `endsWith` | Ends with | `{"field": "name", "operator": "endsWith", "value": "-prod"}` |
| `regex` | Regular expression | `{"field": "cidrBlock", "operator": "regex", "value": "10\\..*"}` |
| `exists` | Field exists | `{"field": "tags", "operator": "exists"}` |
| `notExists` | Field does not exist | `{"field": "deletedAt", "operator": "notExists"}` |
| `between` | Between values | `{"field": "createdAt", "operator": "between", "values": ["2024-01-01", "2024-12-31"]}` |
| `fullText` | Full-text search | `{"field": "description", "operator": "fullText", "value": "network infrastructure"}` |

## Searchable Fields by Resource Type

### VPC
- `vpcId` - AWS VPC ID
- `name` - VPC name
- `region` - AWS region
- `cidrBlock` - CIDR block
- `state` - VPC state
- `environment` - Environment tag
- `owner` - Owner information
- `awsAccountId` - AWS account ID
- `tags` - JSON tags object
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Transit Gateway
- `transitGatewayId` - AWS Transit Gateway ID
- `name` - Transit Gateway name
- `region` - AWS region
- `state` - Gateway state
- `environment` - Environment tag
- `owner` - Owner information
- `awsAccountId` - AWS account ID
- `tags` - JSON tags object
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Customer Gateway
- `customerGatewayId` - AWS Customer Gateway ID
- `name` - Gateway name
- `region` - AWS region
- `ipAddress` - Gateway IP address
- `type` - Gateway type
- `state` - Gateway state
- `environment` - Environment tag
- `owner` - Owner information
- `awsAccountId` - AWS account ID
- `tags` - JSON tags object
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### VPC Endpoint
- `vpcEndpointId` - AWS VPC Endpoint ID
- `serviceName` - AWS service name
- `vpcId` - Associated VPC ID
- `region` - AWS region
- `state` - Endpoint state
- `vpcEndpointType` - Endpoint type
- `environment` - Environment tag
- `owner` - Owner information
- `awsAccountId` - AWS account ID
- `tags` - JSON tags object
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

## Performance Optimizations

### Database Indexes
The API uses comprehensive database indexing for optimal performance:

- **Single field indexes** on commonly searched fields
- **Composite indexes** for multi-field filtering
- **Full-text indexes** for text search (MySQL 5.6+)
- **JSON indexes** for tag-based searching (MySQL 5.7+)
- **Timestamp indexes** for date-based sorting

### Caching Strategy
Redis-based caching with different TTL values:

- **Search results**: 5 minutes (configurable)
- **Auto-complete suggestions**: 1 minute
- **Popular terms**: 1 hour
- **Field metadata**: 24 hours

### Query Optimization
- Automatic query plan analysis
- Index usage suggestions
- Query complexity scoring
- Performance monitoring and alerting

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_SEARCH_QUERY` | Malformed search query |
| `INVALID_FILTER_OPERATOR` | Invalid filter operator |
| `UNSUPPORTED_FIELD` | Field not searchable |
| `SEARCH_TIMEOUT` | Query execution timeout |
| `INDEX_ERROR` | Database index error |
| `CACHE_ERROR` | Redis cache error |
| `SAVED_QUERY_NOT_FOUND` | Saved query does not exist |
| `QUERY_TOO_COMPLEX` | Query exceeds complexity limits |
| `PERMISSION_DENIED` | Insufficient permissions |

## Usage Examples

### Basic Text Search
```bash
curl -X POST /api/search/vpc \
  -H "Content-Type: application/json" \
  -d '{
    "text": "production vpc",
    "pagination": {"page": 1, "limit": 10}
  }'
```

### Advanced Filtering
```bash
curl -X POST /api/search/vpc \
  -H "Content-Type: application/json" \
  -d '{
    "filters": [
      {
        "field": "environment",
        "operator": "eq",
        "value": "production"
      },
      {
        "field": "region",
        "operator": "in",
        "values": ["us-east-1", "us-west-2"]
      },
      {
        "field": "state",
        "operator": "ne",
        "value": "deleted"
      }
    ],
    "sorting": [{"field": "name", "direction": "ASC"}],
    "pagination": {"page": 1, "limit": 20}
  }'
```

### Save and Execute Query
```bash
# Save query
curl -X POST /api/search/saved \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Production VPCs",
    "query": {
      "filters": [
        {"field": "environment", "operator": "eq", "value": "production"}
      ]
    },
    "resourceType": "vpc"
  }'

# Execute saved query
curl -X POST /api/search/saved/1/execute \
  -H "Content-Type: application/json" \
  -d '{
    "overrides": {
      "pagination": {"page": 1, "limit": 50}
    }
  }'
```

## Rate Limiting

The search API implements rate limiting to ensure system stability:

- **General search**: 100 requests per minute per user
- **Auto-complete**: 300 requests per minute per user
- **Saved queries**: 50 requests per minute per user

## Security

- All endpoints require authentication
- Saved queries have user-based access control
- Public queries require explicit permission
- SQL injection protection through parameterized queries
- Input validation and sanitization
- Audit logging for all search operations

## Monitoring and Analytics

The search system provides comprehensive monitoring:

- **Performance metrics**: Response times, throughput, error rates
- **Usage analytics**: Popular queries, common filters, user patterns
- **System health**: Database performance, cache hit rates, index usage
- **Alert system**: Performance degradation, error spikes, capacity issues