# Network CMDB - Multi-Cloud VPC Data Synchronization

## Overview

This guide covers deploying the Network CMDB system with multi-cloud VPC data synchronization capabilities in a production environment using Docker.

## Recent Updates (v2.0.0)

**Multi-Cloud Provider Support:**
- AWS VPCs: 89 records from `vpc_info` table
- Alibaba Cloud VPCs: 30 records from `ali_vpc_info` table
- Azure VPCs: 30 records from `azure_vpc_info` table
- Huawei Cloud VPCs: 18 records from `hwc_vpc_info` table
- Oracle Cloud (OCI) VPCs: 4 records from `oci_vpc_info` table ✨ **NEW**
- Other/On-premises VPCs: 8 records from `other_vpc_info` table ✨ **NEW**

**Dynamic Dashboard:**
- Real-time aggregation of 179 VPCs across all providers (6 cloud providers)
- Provider-specific visualization with color coding
- Auto-refresh every 30 seconds
- Smart column detection and rendering

**Microservice Architecture:**
- Dedicated data synchronization microservice
- Provider-specific API endpoints `/api/vpcs/{provider}`
- Dynamic schema mapping for different cloud provider data formats

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌────────────────────┐
│  Frontend Dashboard │    │  Data Sync Backend   │    │   MySQL Database   │
│     (React/Nginx)   │────│    (Node.js/TS)     │────│  Multi-Cloud VPC   │
│     Port: 8080      │    │    Port: 3302        │    │    Port: 44060     │
│                     │    │                      │    │                    │
│ Multi-Provider UI   │    │ Provider-Specific    │    │ • vpc_info (AWS)   │
│ • AWS VPC Table     │    │ API Endpoints:       │    │ • ali_vpc_info     │
│ • Ali VPC Table     │    │ • /api/vpcs/aws      │    │ • azure_vpc_info   │
│ • Azure VPC Table   │    │ • /api/vpcs/ali      │    │ • hwc_vpc_info     │
│ • Huawei VPC Table  │    │ • /api/vpcs/azure    │    │ • oci_vpc_info     │
│ • OCI VPC Table     │    │ • /api/vpcs/huawei   │    │ • other_vpc_info   │
│ • Others VPC Table  │    │ • /api/vpcs/oci      │    │                    │
│ • Aggregated Stats  │    │ • /api/vpcs/others   │    │ Total: 179 VPCs    │
└─────────────────────┘    └──────────────────────┘    └────────────────────┘
```

## Prerequisites

- Docker Engine 20.10+ and Docker Compose 2.0+
- MySQL database accessible at 172.16.30.62:44060 with VPC data tables
- Minimum 2GB RAM and 10GB storage
- Linux/Unix environment (tested on Ubuntu 20.04+)
- Network access to database server with VPC inventory data

## Directory Structure

```
networkdb/
├── backend/
│   ├── Dockerfile.datasync         # Microservice backend Dockerfile
│   ├── src/server-minimal.ts       # Multi-provider API server
│   └── tsconfig.minimal.json       # TypeScript configuration
├── frontend/
│   ├── Dockerfile.datasync         # Frontend Dockerfile
│   ├── nginx.datasync.conf         # Nginx proxy configuration
│   └── src/
│       ├── MinimalApp.tsx          # Multi-provider dashboard
│       ├── components/
│       │   ├── DynamicTable.tsx    # Schema-adaptive table
│       │   └── ProviderNetworkPage.tsx
│       └── contexts/AuthContext.tsx
├── docker-compose.datasync.yml     # Microservice deployment
└── DEPLOYMENT.md                   # This documentation
```

## Database Tables

The system connects to existing VPC data tables:

| Provider | Table Name | Records | Description |
|----------|------------|---------|-------------|
| AWS | `vpc_info` | 157 | AWS VPC inventory |
| Alibaba Cloud | `ali_vpc_info` | 7 | Aliyun VPC data |
| Azure | `azure_vpc_info` | 1 | Azure VNet data |
| Huawei Cloud | `hwc_vpc_info` | 2 | Huawei Cloud VPC data |
| **Total** | | **167** | **All Providers** |

## Environment Configuration

### Database Connection
```bash
DB_HOST=172.16.30.62
DB_PORT=44060
DB_NAME=mydatabase
DB_USER=root
DB_PASSWORD=Gq34Ko90#110
```

### Optional Services (N8N, Email)
```bash
N8N_BASE_URL=http://172.16.30.60:5678
N8N_API_KEY=your_n8n_api_key
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
EMAIL_FROM=noreply@networkdb.local
```

## Quick Start Deployment

### 1. Clone Repository

```bash
git clone <your-repo-url> networkdb
cd networkdb
```

### 2. Deploy Microservice Stack

```bash
# Deploy data synchronization microservice
docker compose -f docker-compose.datasync.yml up -d --build

# Verify deployment status
docker ps --filter name=datasync

# Check service health
curl http://localhost:3302/health  # Backend health
curl http://localhost:8080         # Frontend dashboard
```

### 3. Access Applications

- **Frontend Dashboard**: http://localhost:8080
- **Backend API**: http://localhost:3302
- **Health Check**: http://localhost:3302/health

### 4. Verify Multi-Provider Data

```bash
# Test all provider endpoints
curl http://localhost:8080/api/vpcs/aws | jq '.total'     # Should return 157
curl http://localhost:8080/api/vpcs/ali | jq '.total'     # Should return 7
curl http://localhost:8080/api/vpcs/azure | jq '.total'   # Should return 1
curl http://localhost:8080/api/vpcs/huawei | jq '.total'  # Should return 2

# Test database tables discovery
curl http://localhost:3302/api/database/tables | jq '.data.vpc_tables'
```

### 5. Frontend Navigation

Access the multi-provider VPC inventory:
- **AWS VPCs**: http://localhost:8080/vpcs/aws
- **Alibaba Cloud**: http://localhost:8080/vpcs/ali
- **Azure VNets**: http://localhost:8080/vpcs/azure
- **Huawei Cloud**: http://localhost:8080/vpcs/huawei
- **Dashboard**: http://localhost:8080/dashboard (aggregated view)

## API Endpoints

### Multi-Provider VPC Data

| Endpoint | Provider | Expected Records | Description |
|----------|----------|------------------|-------------|
| `/api/vpcs/aws` | AWS | 157 | AWS VPC inventory |
| `/api/vpcs/ali` | Alibaba Cloud | 7 | Aliyun VPC data |
| `/api/vpcs/azure` | Azure | 1 | Azure VNet data |
| `/api/vpcs/huawei` | Huawei Cloud | 2 | Huawei Cloud VPC data |

### System Endpoints

```bash
# Health monitoring
GET /health

# Database discovery
GET /api/database/tables

# Individual VPC lookup
GET /api/vpcs/{provider}/{id}
```

### Example API Response

```json
{
  "success": true,
  "data": [...],
  "total": 157,
  "provider": "aws",
  "tableName": "vpc_info",
  "message": "AWS VPC data retrieved successfully from vpc_info",
  "schema": [
    {
      "name": "VpcId",
      "type": "varchar",
      "displayType": "code",
      "filterable": true,
      "sortable": true,
      "editable": true
    }
  ]
}

## Service Management

### Starting/Stopping Services
```bash
# Start microservice stack
docker compose -f docker-compose.datasync.yml up -d

# Stop microservice stack
docker compose -f docker-compose.datasync.yml down

# Restart specific service
docker compose -f docker-compose.datasync.yml restart datasync-backend
docker compose -f docker-compose.datasync.yml restart datasync-frontend
```

### Updating Application
```bash
# Pull latest code changes
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.datasync.yml down
docker compose -f docker-compose.datasync.yml up -d --build

# Monitor deployment
docker logs datasync-backend --tail 50 -f
docker logs datasync-frontend --tail 20 -f
```

### Scaling for Production
```bash
# Scale backend for high load
docker compose -f docker-compose.datasync.yml up -d --scale datasync-backend=3

# Use load balancer for multiple frontend instances
docker compose -f docker-compose.datasync.yml up -d --scale datasync-frontend=2
```

## Monitoring and Troubleshooting

### Container Status
```bash
# Check container health
docker ps --filter name=datasync

# Monitor resource usage
docker stats datasync-backend datasync-frontend

# View container logs
docker logs datasync-backend --tail 50
docker logs datasync-frontend --tail 20
```

### Database Connectivity Issues
```bash
# Test database connection
docker exec datasync-backend curl -f http://localhost:3302/health

# Check database table discovery
curl http://localhost:3302/api/database/tables

# Verify VPC table access
curl http://localhost:3302/api/vpcs/aws | jq '{success, total, message}'
```

### Common Issues

#### 1. Database Connection Failed
```bash
# Check network connectivity to database
docker exec datasync-backend ping 172.16.30.62

# Verify database credentials in container
docker exec datasync-backend env | grep DB_

# Test each VPC table individually
curl http://localhost:3302/api/vpcs/aws    # Should return 157 records
curl http://localhost:3302/api/vpcs/ali    # Should return 7 records
curl http://localhost:3302/api/vpcs/azure  # Should return 1 record
curl http://localhost:3302/api/vpcs/huawei # Should return 2 records
```

#### 2. Frontend Not Loading VPC Data
```bash
# Check API proxy through nginx
curl http://localhost:8080/api/vpcs/aws

# Verify nginx configuration
docker exec datasync-frontend cat /etc/nginx/nginx.conf | grep -A 10 "location /api"

# Check frontend container logs
docker logs datasync-frontend --tail 30
```

#### 3. Empty VPC Tables
```bash
# Verify table exists and has data
curl http://localhost:3302/api/database/tables | jq '.data.vpc_tables'

# Check specific table schema
curl http://localhost:3302/api/vpcs/aws | jq '.schema[0:3]'
```

## Security Features

### Built-in Security
- **Containers run as non-root users** (nodejs:1001)
- **Rate limiting**: 100 requests per 15 minutes per IP
- **CORS protection**: Configured for specific origins
- **Helmet security headers**: CSP, HSTS, etc.
- **Health checks**: Automated container health monitoring

### Network Security
```bash
# Verify isolated network
docker network ls | grep datasync
docker network inspect datasync-network

# Check exposed ports only
docker ps --filter name=datasync --format "table {{.Names}}\t{{.Ports}}"
```

### Database Security
- **Connection pooling**: Limited concurrent connections
- **Connection timeout**: 10 second timeout prevents hanging connections
- **SQL injection protection**: Parameterized queries with Sequelize ORM

## Production Features

### Dashboard Capabilities
- **Multi-provider aggregation**: Real-time stats from all 4 cloud providers
- **Auto-refresh**: Updates every 30 seconds
- **167 total VPCs**: AWS (157) + Ali (7) + Azure (1) + Huawei (2)
- **Provider-specific pages**: Individual tables for each cloud provider

### Dynamic Table Features
- **Schema auto-detection**: Adapts to different database table structures
- **Smart rendering**: IDs as copyable code, regions as tags, status as badges
- **Real-time filtering**: Search and filter across all columns
- **Export functionality**: CSV/Excel export with current filters
- **In-line editing**: Edit VPC data with permission controls

### API Features
- **Provider routing**: `/api/vpcs/{provider}` supports aws, ali, azure, huawei
- **Schema transformation**: Converts database schema to frontend format
- **Flexible field mapping**: Handles VpcId, vpc_id, VNetName, id variations
- **Health monitoring**: Built-in health checks and error handling

### Backup and Recovery

```bash
# Backup container images
docker save network-cmdb-datasync:latest | gzip > datasync-backend.tar.gz
docker save network-cmdb-datasync-frontend:latest | gzip > datasync-frontend.tar.gz

# Restore from backup
gunzip -c datasync-backend.tar.gz | docker load
gunzip -c datasync-frontend.tar.gz | docker load

# Redeploy
docker compose -f docker-compose.datasync.yml up -d
```

## Production Checklist

### Pre-deployment Verification
- [ ] Docker and Docker Compose installed
- [ ] Network access to MySQL database (172.16.30.62:44060)
- [ ] Ports 3302 and 8080 available
- [ ] Sufficient resources (2GB RAM, 10GB storage)

### Post-deployment Verification
```bash
# Check all services are running
docker ps --filter name=datasync

# Verify database connectivity
curl http://localhost:3302/health

# Test all provider endpoints
for provider in aws ali azure huawei; do
  echo "Testing $provider:"
  curl -s http://localhost:8080/api/vpcs/$provider | jq '{provider, total, success}'
done

# Verify frontend loads
curl -I http://localhost:8080
```

### Expected Results
- Backend health check: `{"status": "healthy"}`
- AWS VPCs: 157 records
- Alibaba Cloud VPCs: 7 records
- Azure VPCs: 1 record
- Huawei Cloud VPCs: 2 records
- Dashboard: Aggregated 167 VPCs with provider breakdown

## Performance Optimization

### Container Resource Limits (Already Configured)
```yaml
# Backend: 512MB RAM, 0.5 CPU
# Frontend: 128MB RAM, 0.25 CPU
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

### Database Connection Pooling (Optimized)
- Max connections: 5
- Min connections: 1
- Connection timeout: 10s
- Acquire timeout: 30s

## Maintenance and Updates

### Automated Update Script
```bash
#!/bin/bash
# update-datasync.sh
cd /path/to/networkdb
git pull origin main
docker compose -f docker-compose.datasync.yml down
docker compose -f docker-compose.datasync.yml up -d --build
echo "Deployment complete! Verify at http://localhost:8080"
```

### Health Monitoring
```bash
# Monitor service health
watch -n 30 'curl -s http://localhost:3302/health | jq .status'

# Monitor VPC data totals
watch -n 60 'echo "AWS: $(curl -s http://localhost:8080/api/vpcs/aws | jq .total) Ali: $(curl -s http://localhost:8080/api/vpcs/ali | jq .total) Azure: $(curl -s http://localhost:8080/api/vpcs/azure | jq .total) Huawei: $(curl -s http://localhost:8080/api/vpcs/huawei | jq .total)"'
```

---

**Version**: 2.0.0 - Multi-Cloud VPC Data Synchronization
**Last Updated**: September 2025
**Repository**: Network CMDB with Multi-Provider Support