# Cloud Network CMDB - Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Pre-deployment Checklist](#pre-deployment-checklist)
4. [Installation Methods](#installation-methods)
5. [Configuration](#configuration)
6. [Security Setup](#security-setup)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Performance Optimization](#performance-optimization)
9. [Backup and Recovery](#backup-and-recovery)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Cloud Network CMDB is a comprehensive multi-cloud network infrastructure management platform with advanced reporting capabilities. This deployment guide covers production-ready installation and configuration.

### Architecture Components

- **Frontend:** React-based web application
- **Backend:** Node.js API server with Express framework
- **Database:** MySQL 8.0+ for primary data storage
- **Cache:** Redis for session management and caching
- **Queue:** Bull Queue for background job processing
- **Reporting:** Dedicated reporting service with export capabilities
- **Monitoring:** Comprehensive logging and metrics collection

---

## System Requirements

### Minimum Requirements (Development/Testing)

#### Server Specifications
- **CPU:** 4 cores (2.4 GHz)
- **RAM:** 8 GB
- **Storage:** 100 GB SSD
- **Network:** 1 Gbps connection

#### Software Requirements
- **OS:** Ubuntu 20.04 LTS, RHEL 8+, or CentOS 8+
- **Node.js:** 18.0+ LTS
- **MySQL:** 8.0+
- **Redis:** 6.0+
- **Docker:** 20.10+ (if using containers)
- **Docker Compose:** 2.0+ (if using containers)

### Production Requirements

#### Server Specifications
- **CPU:** 8+ cores (3.0 GHz)
- **RAM:** 32 GB+
- **Storage:** 500 GB+ SSD (database), 100 GB+ SSD (application)
- **Network:** 10 Gbps connection
- **Load Balancer:** For high availability

#### Database Specifications
- **CPU:** 8+ cores dedicated
- **RAM:** 64 GB+
- **Storage:** 1 TB+ SSD with high IOPS
- **Backup Storage:** 3x primary storage for backups

#### High Availability Setup
- **Application Servers:** 3+ instances
- **Database:** Primary/replica configuration
- **Redis:** Cluster mode with 3+ nodes
- **Load Balancer:** HAProxy or similar
- **Monitoring:** Prometheus + Grafana

---

## Pre-deployment Checklist

### Infrastructure Preparation

- [ ] **Server Provisioning**
  - [ ] Application servers provisioned
  - [ ] Database server provisioned
  - [ ] Redis cache server provisioned
  - [ ] Load balancer configured
  - [ ] Monitoring infrastructure ready

- [ ] **Network Configuration**
  - [ ] Firewall rules configured
  - [ ] SSL certificates obtained
  - [ ] DNS records configured
  - [ ] CDN setup (if applicable)

- [ ] **Security Preparation**
  - [ ] SSL/TLS certificates ready
  - [ ] Encryption keys generated
  - [ ] Access control policies defined
  - [ ] Backup encryption keys secured

### Software Preparation

- [ ] **Source Code**
  - [ ] Latest stable release downloaded
  - [ ] Configuration templates prepared
  - [ ] Environment-specific settings ready

- [ ] **Dependencies**
  - [ ] Node.js installed
  - [ ] MySQL installed and configured
  - [ ] Redis installed and configured
  - [ ] Process manager (PM2) installed

- [ ] **Cloud Provider Access**
  - [ ] AWS credentials configured
  - [ ] Azure service principal created
  - [ ] GCP service account configured
  - [ ] Oracle Cloud credentials ready

---

## Installation Methods

### Method 1: Docker Deployment (Recommended)

#### 1. Clone Repository
```bash
git clone https://github.com/your-org/networkdb.git
cd networkdb
```

#### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

#### 3. Build and Deploy
```bash
# Production build
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
docker-compose ps
```

### Method 2: Manual Installation

#### 1. Install Dependencies
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm mysql-server redis-server nginx

# RHEL/CentOS
sudo dnf install -y nodejs npm mysql-server redis nginx
```

#### 2. Setup Database
```bash
# Start MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Create database and user
sudo mysql -e "CREATE DATABASE networkdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'networkdb'@'localhost' IDENTIFIED BY 'secure_password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON networkdb.* TO 'networkdb'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

#### 3. Setup Redis
```bash
# Start Redis
sudo systemctl start redis
sudo systemctl enable redis

# Configure Redis
sudo sed -i 's/# requirepass foobared/requirepass your_redis_password/' /etc/redis/redis.conf
sudo systemctl restart redis
```

#### 4. Deploy Application
```bash
# Clone and build backend
git clone https://github.com/your-org/networkdb.git
cd networkdb/backend
npm install --production
npm run build

# Build frontend
cd ../frontend
npm install --production
npm run build

# Copy build files to web server
sudo cp -r dist/* /var/www/html/
```

#### 5. Configure Process Manager
```bash
# Install PM2
npm install -g pm2

# Start application
cd /path/to/networkdb/backend
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

### Method 3: Kubernetes Deployment

#### 1. Prepare Kubernetes Manifests
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: networkdb-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: networkdb-backend
  template:
    metadata:
      labels:
        app: networkdb-backend
    spec:
      containers:
      - name: backend
        image: networkdb/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: networkdb-secrets
              key: database-url
```

#### 2. Deploy to Kubernetes
```bash
# Apply configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# Verify deployment
kubectl get pods -n networkdb
kubectl get services -n networkdb
```

---

## Configuration

### Environment Variables

#### Backend Configuration (.env)
```bash
# Application
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourdomain.com

# Database
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=networkdb
DATABASE_USER=networkdb
DATABASE_PASSWORD=secure_password
DATABASE_SSL=true

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_DB=0

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here
SESSION_SECRET=your_session_secret_here

# Cloud Providers
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_DEFAULT_REGION=us-east-1

AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_secret
AZURE_TENANT_ID=your_azure_tenant

GCP_PROJECT_ID=your_gcp_project
GCP_KEYFILE_PATH=/path/to/gcp-keyfile.json

# Email Configuration
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=alerts@yourdomain.com
SMTP_PASSWORD=smtp_password
SMTP_FROM=networkdb@yourdomain.com

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9090

# Export Configuration
EXPORT_PATH=/var/exports
EXPORT_CLEANUP_HOURS=24
PDF_GENERATION_TIMEOUT=30000
```

#### Frontend Configuration
```javascript
// src/config/production.js
export default {
  api: {
    baseURL: 'https://api.yourdomain.com',
    timeout: 30000,
    retryAttempts: 3
  },
  features: {
    realTimeUpdates: true,
    advancedFiltering: true,
    exportFormats: ['csv', 'excel', 'json', 'pdf'],
    maxExportRecords: 50000
  },
  monitoring: {
    enableAnalytics: true,
    errorReporting: true,
    performanceTracking: true
  }
}
```

### Database Configuration

#### MySQL Optimization
```sql
-- /etc/mysql/mysql.conf.d/networkdb.cnf
[mysqld]
# Basic Settings
default-authentication-plugin=mysql_native_password
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

# Performance Settings
innodb_buffer_pool_size=16G
innodb_log_file_size=1G
innodb_flush_log_at_trx_commit=2
innodb_flush_method=O_DIRECT

# Connection Settings
max_connections=500
max_user_connections=450
thread_cache_size=50

# Query Cache
query_cache_type=1
query_cache_size=512M
query_cache_limit=256K

# Logging
slow_query_log=1
slow_query_log_file=/var/log/mysql/slow.log
long_query_time=2

# Security
bind-address=127.0.0.1
skip-show-database
```

#### Database Migrations
```bash
# Run initial migrations
cd /path/to/networkdb/backend
npm run db:migrate

# Verify tables created
mysql -u networkdb -p networkdb -e "SHOW TABLES;"

# Seed initial data (optional)
npm run db:seed
```

### Redis Configuration

#### Redis Optimization
```bash
# /etc/redis/redis.conf

# Memory Management
maxmemory 8gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
requirepass your_redis_password
bind 127.0.0.1

# Performance
tcp-keepalive 300
timeout 0
```

### Web Server Configuration

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/networkdb
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;

    # Frontend
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=31536000";
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # Export Downloads
    location /exports/ {
        alias /var/exports/;
        expires 1h;
        add_header Cache-Control "private, no-cache";
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Security Setup

### SSL/TLS Configuration

#### Generate Self-Signed Certificate (Development)
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

#### Let's Encrypt Certificate (Production)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Access Control

#### Database Security
```sql
-- Create read-only user for reporting
CREATE USER 'reporting'@'localhost' IDENTIFIED BY 'reporting_password';
GRANT SELECT ON networkdb.* TO 'reporting'@'localhost';

-- Create backup user
CREATE USER 'backup'@'localhost' IDENTIFIED BY 'backup_password';
GRANT SELECT, LOCK TABLES ON networkdb.* TO 'backup'@'localhost';
```

#### API Security
```javascript
// Rate limiting configuration
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### Firewall Configuration

#### UFW (Ubuntu)
```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow database (only from app servers)
sudo ufw allow from 10.0.1.0/24 to any port 3306

# Allow Redis (only from app servers)
sudo ufw allow from 10.0.1.0/24 to any port 6379
```

#### iptables (Alternative)
```bash
# Basic firewall rules
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -s 10.0.1.0/24 -p tcp --dport 3306 -j ACCEPT
iptables -A INPUT -s 10.0.1.0/24 -p tcp --dport 6379 -j ACCEPT
iptables -A INPUT -j DROP

# Save rules
iptables-save > /etc/iptables/rules.v4
```

---

## Monitoring and Logging

### Application Monitoring

#### PM2 Monitoring
```bash
# Install PM2 monitoring
pm2 install pm2-server-monit

# View real-time monitoring
pm2 monit

# Check logs
pm2 logs
pm2 logs backend
```

#### Health Check Endpoint
```javascript
// backend/src/routes/health.js
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  res.json(health);
});
```

### Log Management

#### Winston Configuration
```javascript
// backend/src/config/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: '/var/log/networkdb/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: '/var/log/networkdb/combined.log'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

#### Log Rotation
```bash
# /etc/logrotate.d/networkdb
/var/log/networkdb/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Metrics Collection

#### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'networkdb'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

#### Grafana Dashboards
```json
{
  "dashboard": {
    "title": "Network CMDB Metrics",
    "panels": [
      {
        "title": "API Response Times",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(api_request_duration_ms) by (route)"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "mysql_global_status_threads_connected"
          }
        ]
      }
    ]
  }
}
```

---

## Performance Optimization

### Database Optimization

#### Indexing Strategy
```sql
-- Primary indexes for reports
CREATE INDEX idx_vpcs_region_state ON vpcs(region, state);
CREATE INDEX idx_vpcs_created_at ON vpcs(created_at);
CREATE INDEX idx_vpcs_provider ON vpcs(provider);

-- Composite indexes for common queries
CREATE INDEX idx_vpcs_state_region_created ON vpcs(state, region, created_at);
CREATE INDEX idx_endpoints_vpc_service ON vpc_endpoints(vpc_id, service_name);

-- Analyze table statistics
ANALYZE TABLE vpcs, transit_gateways, customer_gateways, vpc_endpoints;
```

#### Query Optimization
```sql
-- Use EXPLAIN to analyze queries
EXPLAIN SELECT * FROM vpcs WHERE region = 'us-east-1' AND state = 'available';

-- Optimize with proper indexes
EXPLAIN SELECT vpc_id, cidr_block FROM vpcs USE INDEX(idx_vpcs_region_state)
WHERE region = 'us-east-1' AND state = 'available';
```

### Application Optimization

#### Connection Pooling
```javascript
// backend/src/config/database.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000
});
```

#### Redis Caching
```javascript
// backend/src/services/CacheService.js
class CacheService {
  async getOrSet(key, fetchFunction, ttl = 300) {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await fetchFunction();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  }
}
```

### Frontend Optimization

#### Code Splitting
```javascript
// frontend/src/App.jsx
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Reports = lazy(() => import('./components/Reports'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Suspense>
  );
}
```

#### Bundle Optimization
```javascript
// frontend/vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          antd: ['antd'],
          charts: ['echarts', 'echarts-for-react']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

---

## Backup and Recovery

### Database Backup

#### Automated Backup Script
```bash
#!/bin/bash
# /usr/local/bin/backup-networkdb.sh

BACKUP_DIR="/var/backups/networkdb"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="networkdb_backup_${DATE}.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
mysqldump --single-transaction --routines --triggers \
  -u backup -p$BACKUP_PASSWORD networkdb | \
  gzip > $BACKUP_DIR/$BACKUP_FILE

# Verify backup
if [ $? -eq 0 ]; then
    echo "Backup successful: $BACKUP_FILE"

    # Remove backups older than 30 days
    find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
else
    echo "Backup failed!"
    exit 1
fi
```

#### Schedule Backups
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-networkdb.sh

# Weekly full backup at 1 AM Sunday
0 1 * * 0 /usr/local/bin/full-backup-networkdb.sh
```

### Application Backup

#### Configuration Backup
```bash
#!/bin/bash
# Backup configuration files
tar -czf /var/backups/config-$(date +%Y%m%d).tar.gz \
  /etc/nginx/sites-available/networkdb \
  /etc/mysql/mysql.conf.d/networkdb.cnf \
  /etc/redis/redis.conf \
  /path/to/networkdb/.env
```

#### Export Files Backup
```bash
#!/bin/bash
# Backup export files
rsync -av --delete /var/exports/ /var/backups/exports/
```

### Recovery Procedures

#### Database Recovery
```bash
# Stop application
pm2 stop all

# Restore database
gunzip < /var/backups/networkdb/networkdb_backup_20240115_020000.sql.gz | \
  mysql -u root -p networkdb

# Restart services
sudo systemctl restart mysql
pm2 start all
```

#### Point-in-Time Recovery
```bash
# Enable binary logging in MySQL
echo "log-bin=/var/log/mysql/mysql-bin.log" >> /etc/mysql/mysql.conf.d/networkdb.cnf

# Restore to specific point
mysql -u root -p networkdb < backup.sql
mysqlbinlog --start-datetime="2024-01-15 10:00:00" \
  --stop-datetime="2024-01-15 10:30:00" \
  /var/log/mysql/mysql-bin.000001 | mysql -u root -p networkdb
```

---

## Troubleshooting

### Common Issues

#### Application Won't Start

**Symptoms:**
- PM2 shows application as stopped
- Error logs show connection failures
- HTTP 502 errors

**Diagnostic Steps:**
```bash
# Check application logs
pm2 logs backend

# Check system resources
free -h
df -h
top

# Test database connection
mysql -u networkdb -p -e "SELECT 1;"

# Test Redis connection
redis-cli ping
```

**Solutions:**
1. **Database Connection Issues:**
   ```bash
   # Restart MySQL
   sudo systemctl restart mysql

   # Check MySQL status
   sudo systemctl status mysql

   # Review MySQL logs
   sudo tail -f /var/log/mysql/error.log
   ```

2. **Memory Issues:**
   ```bash
   # Increase swap space
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

3. **Port Conflicts:**
   ```bash
   # Check port usage
   sudo netstat -tulpn | grep :3000

   # Kill conflicting process
   sudo kill -9 <PID>
   ```

#### Database Performance Issues

**Symptoms:**
- Slow query responses
- High CPU usage on database server
- Connection timeouts

**Diagnostic Steps:**
```bash
# Check MySQL process list
mysql -u root -p -e "SHOW PROCESSLIST;"

# Check slow query log
sudo tail -f /var/log/mysql/slow.log

# Check database size
mysql -u root -p -e "
SELECT
  table_schema AS 'Database',
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
GROUP BY table_schema;"
```

**Solutions:**
1. **Query Optimization:**
   ```sql
   -- Analyze slow queries
   SELECT query, exec_count, avg_timer_wait
   FROM performance_schema.events_statements_summary_by_digest
   ORDER BY avg_timer_wait DESC LIMIT 10;

   -- Add missing indexes
   CREATE INDEX idx_missing ON table_name(column_name);
   ```

2. **Configuration Tuning:**
   ```sql
   -- Increase buffer pool size
   SET GLOBAL innodb_buffer_pool_size = 2147483648; -- 2GB

   -- Optimize query cache
   SET GLOBAL query_cache_size = 268435456; -- 256MB
   ```

#### Export Failures

**Symptoms:**
- Export requests timeout
- Generated files are empty or corrupted
- Export queue backing up

**Diagnostic Steps:**
```bash
# Check export directory
ls -la /var/exports/
df -h /var/exports/

# Check queue status
redis-cli llen exports:queue

# Check export logs
grep "export" /var/log/networkdb/combined.log
```

**Solutions:**
1. **Disk Space Issues:**
   ```bash
   # Clean old exports
   find /var/exports -name "*.csv" -mtime +1 -delete
   find /var/exports -name "*.xlsx" -mtime +1 -delete
   ```

2. **Memory Issues:**
   ```bash
   # Increase Node.js memory limit
   node --max-old-space-size=4096 app.js
   ```

3. **Queue Processing:**
   ```bash
   # Clear stuck jobs
   redis-cli del exports:queue
   pm2 restart backend
   ```

### Performance Monitoring

#### Real-time Monitoring
```bash
# Monitor application performance
pm2 monit

# Monitor database performance
mysqladmin -u root -p processlist

# Monitor system resources
htop
iotop
```

#### Log Analysis
```bash
# Analyze error patterns
grep "ERROR" /var/log/networkdb/error.log | tail -20

# Check API response times
grep "responseTime" /var/log/networkdb/combined.log | \
  awk '{print $NF}' | sort -n | tail -10

# Monitor database queries
grep "SELECT\|INSERT\|UPDATE\|DELETE" /var/log/mysql/general.log | tail -20
```

### Health Checks

#### Automated Health Monitoring
```bash
#!/bin/bash
# /usr/local/bin/health-check.sh

API_URL="https://yourdomain.com"
SLACK_WEBHOOK="your_slack_webhook_url"

# Check API health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)

if [ $HTTP_STATUS -ne 200 ]; then
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"🚨 NetworkDB API is down! HTTP Status: '$HTTP_STATUS'"}' \
      $SLACK_WEBHOOK
fi

# Check database connectivity
if ! mysql -u monitoring -p$MONITOR_PASSWORD -e "SELECT 1;" > /dev/null 2>&1; then
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"🚨 NetworkDB Database connection failed!"}' \
      $SLACK_WEBHOOK
fi
```

#### Monitoring Alerts
```bash
# Add to crontab for health checks every 5 minutes
*/5 * * * * /usr/local/bin/health-check.sh
```

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Performance testing completed
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] SSL certificates installed
- [ ] DNS configured
- [ ] Load balancer configured

### Deployment
- [ ] Blue-green deployment strategy
- [ ] Database migrations executed
- [ ] Configuration verified
- [ ] Health checks passing
- [ ] Logs monitoring
- [ ] Performance monitoring

### Post-Deployment
- [ ] Smoke tests completed
- [ ] User acceptance testing
- [ ] Performance baseline established
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Team training completed

---

## Support and Maintenance

### Regular Maintenance Tasks

#### Daily
- [ ] Check application logs for errors
- [ ] Monitor system performance
- [ ] Verify backup completion
- [ ] Check disk space usage

#### Weekly
- [ ] Review slow query log
- [ ] Update security patches
- [ ] Clean up old export files
- [ ] Review monitoring alerts

#### Monthly
- [ ] Full security audit
- [ ] Performance review
- [ ] Capacity planning review
- [ ] Update documentation

### Support Contacts

- **Infrastructure Team:** infrastructure@yourorg.com
- **Database Team:** database@yourorg.com
- **Security Team:** security@yourorg.com
- **On-call Support:** +1-800-NETWORK

---

*Last updated: January 2024*
*Version: 1.0*