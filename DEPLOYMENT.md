# Network CMDB Production Deployment Guide

## Overview

This guide covers the production deployment of the Network CMDB application using Docker containers with externalized configuration files. The application consists of two main components:

- **Backend**: Node.js/Express API server with TypeScript
- **Frontend**: React application served via Nginx

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Frontend      │────│    Backend      │────│   MySQL DB      │
│   (Nginx)       │    │   (Node.js)     │    │   (External)    │
│   Port: 80      │    │   Port: 3001    │    │   Port: 44060   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

- Docker Engine 20.10+ and Docker Compose 2.0+
- MySQL database accessible at 172.16.30.62:44060
- Minimum 2GB RAM and 10GB storage
- Linux/Unix environment (tested on Ubuntu 20.04+)

## Directory Structure

```
networkdb/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── src/
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx.conf
│   └── src/
├── docker-compose.yml
├── docker-compose.staging.yml
├── .env.production
├── .env.staging
├── logs/
├── config/
└── DEPLOYMENT.md
```

## Configuration Management

### Environment Files (Stored Outside Containers)

#### `.env.production`
Contains production environment variables:
```bash
DB_HOST=172.16.30.62
DB_PORT=44060
DB_NAME=mydatabase
DB_USER=root
DB_PASSWORD=your-secure-password
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:80
SESSION_SECRET=your-super-secure-session-secret
```

#### `.env.staging`
Contains staging environment variables with different ports and database names.

### Required Directory Structure
Create the following directories before deployment:

```bash
mkdir -p logs/backend logs/frontend logs/staging/backend logs/staging/frontend
mkdir -p config/backend config/frontend config/staging/backend config/staging/frontend
```

## Deployment Steps

### 1. Pre-deployment Setup

```bash
# Clone the repository
git clone <your-repo-url> networkdb
cd networkdb

# Create required directories
mkdir -p logs/{backend,frontend,staging/{backend,frontend}}
mkdir -p config/{backend,frontend,staging/{backend,frontend}}

# Set proper permissions
chmod 755 logs/ config/
chmod 644 .env.production .env.staging
```

### 2. Environment Configuration

**CRITICAL**: Update the environment files with your actual credentials:

```bash
# Edit production environment
nano .env.production

# Edit staging environment (if needed)
nano .env.staging
```

**Security Notes**:
- Never commit `.env.*` files to version control
- Use strong passwords and rotate them regularly
- Consider using Docker secrets for sensitive data

### 3. Build and Deploy

#### Production Deployment

```bash
# Build and start all services
docker-compose up -d --build

# Check deployment status
docker-compose ps
docker-compose logs -f

# Verify health checks
docker-compose exec backend curl http://localhost:3001/health
docker-compose exec frontend curl http://localhost:80/health
```

#### Staging Deployment

```bash
# Build and start staging services
docker-compose -f docker-compose.staging.yml up -d --build

# Check staging status
docker-compose -f docker-compose.staging.yml ps
```

### 4. Deployment Verification

#### Health Checks
```bash
# Backend health
curl http://localhost:3001/health

# Frontend health (through nginx)
curl http://localhost:80/health

# Full application test
curl http://localhost:80/api/vpcs
```

#### Expected Responses
- Backend health: `{"status":"ok","timestamp":"...","service":"network-cmdb-backend","version":"1.0.0"}`
- Frontend: Should serve the React application
- API: Should return VPC data from database

## Service Management

### Starting Services
```bash
# Production
docker-compose up -d

# Staging
docker-compose -f docker-compose.staging.yml up -d
```

### Stopping Services
```bash
# Production
docker-compose down

# Staging
docker-compose -f docker-compose.staging.yml down
```

### Restarting Services
```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### Updating Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Verify deployment
docker-compose logs -f
```

## Monitoring and Maintenance

### Log Management
```bash
# View live logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Log files location
ls -la logs/backend/
ls -la logs/frontend/
```

### Container Management
```bash
# Check container status
docker ps

# Check resource usage
docker stats

# Clean up unused resources
docker system prune -f
docker volume prune -f
```

### Database Connectivity
```bash
# Test database connection from backend container
docker-compose exec backend node -e "
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
sequelize.authenticate().then(() => console.log('DB OK')).catch(console.error);
"
```

## Security Considerations

### Container Security
- Containers run as non-root users
- Read-only configuration mounts
- Limited network access
- Health checks implemented
- Resource limits configured

### Network Security
```bash
# Check network isolation
docker network ls
docker network inspect network-cmdb-network
```

### File Permissions
```bash
# Set secure permissions
chmod 600 .env.production .env.staging
chmod 755 logs/ config/
chown -R 1001:1001 logs/ config/
```

## Backup and Recovery

### Configuration Backup
```bash
# Backup environment files
tar -czf networkdb-config-$(date +%Y%m%d).tar.gz .env.* config/

# Store in secure location
mv networkdb-config-*.tar.gz /backup/location/
```

### Application State
```bash
# Export container images
docker save network-cmdb-backend:latest | gzip > backend-image.tar.gz
docker save network-cmdb-frontend:latest | gzip > frontend-image.tar.gz
```

### Recovery Process
```bash
# Restore configuration
tar -xzf networkdb-config-YYYYMMDD.tar.gz

# Import images (if needed)
docker load < backend-image.tar.gz
docker load < frontend-image.tar.gz

# Restart services
docker-compose up -d
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check database connectivity
docker-compose exec backend ping 172.16.30.62
docker-compose exec backend nc -zv 172.16.30.62 44060

# Check environment variables
docker-compose exec backend env | grep DB_
```

#### Frontend Not Accessible
```bash
# Check nginx logs
docker-compose logs frontend

# Check port binding
netstat -tulpn | grep :80
```

#### Backend API Errors
```bash
# Check backend logs
docker-compose logs backend

# Check backend health
docker-compose exec backend curl http://localhost:3001/health
```

### Performance Tuning

#### Resource Limits
Add to docker-compose.yml:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

#### Database Connection Pooling
Already configured in backend with:
- Max connections: 1
- Connection timeout: 10s
- Pool timeout: 30s

## Production Checklist

### Pre-deployment
- [ ] Environment files configured with production values
- [ ] Database connectivity verified
- [ ] SSL certificates installed (if using HTTPS)
- [ ] Firewall rules configured
- [ ] Resource monitoring setup

### Post-deployment
- [ ] Health checks passing
- [ ] Application accessible via browser
- [ ] API endpoints responding correctly
- [ ] Database queries working
- [ ] Log rotation configured
- [ ] Backup procedures tested

### Security Checklist
- [ ] Environment files secured (600 permissions)
- [ ] Containers running as non-root
- [ ] Network isolation verified
- [ ] Security headers configured in nginx
- [ ] Database credentials rotated

## Support and Maintenance

### Log Rotation
```bash
# Setup logrotate for Docker logs
sudo nano /etc/logrotate.d/docker-compose
```

### Automated Updates
```bash
# Create update script
cat > update-networkdb.sh << 'EOF'
#!/bin/bash
cd /path/to/networkdb
git pull origin main
docker-compose down
docker-compose up -d --build
docker-compose logs -f --tail=50
EOF

chmod +x update-networkdb.sh
```

### Monitoring Setup
```bash
# Add monitoring endpoints
curl http://localhost:3001/health | jq .
curl http://localhost:80/api/vpcs | jq '.total'
```

## Contact Information

For deployment issues or questions:
- System Administrator: [your-email]
- Development Team: [dev-team-email]
- Emergency Contact: [emergency-contact]

---

**Last Updated**: $(date)
**Version**: 1.0.0