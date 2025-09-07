# Network CMDB - Quick Start Guide

## 🚀 Fast Production Deployment

### Prerequisites
- Docker & Docker Compose installed
- MySQL database running at 172.16.30.62:44060
- Git repository cloned

### 1️⃣ Configure Environment (2 minutes)

```bash
# Navigate to project directory
cd networkdb

# Copy and configure environment file
cp .env.template .env.production

# Edit with your database credentials
nano .env.production
```

**Required changes in `.env.production`:**
```bash
DB_HOST=172.16.30.62
DB_PORT=44060
DB_NAME=mydatabase
DB_USER=root
DB_PASSWORD=your-actual-password
SESSION_SECRET=generate-a-secure-32-character-string
```

### 2️⃣ Deploy with One Command (3 minutes)

```bash
# Make deployment script executable and deploy
chmod +x deploy.sh
./deploy.sh production
```

### 3️⃣ Verify Deployment (30 seconds)

✅ **Frontend**: http://localhost:80
✅ **Backend API**: http://localhost:3001/health
✅ **VPC Data**: http://localhost:80/api/vpcs

## 📋 Quick Commands

```bash
# Deploy to production
./deploy.sh production

# Deploy to staging
./deploy.sh staging

# Check status
./deploy.sh status

# View logs
./deploy.sh logs

# Stop services
./deploy.sh stop

# Update application
./deploy.sh update

# Clean up
./deploy.sh cleanup
```

## 🔧 Manual Deployment (Alternative)

```bash
# Build and start services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 🚨 Troubleshooting

### Issue: Database connection failed
```bash
# Test database connectivity
ping 172.16.30.62
telnet 172.16.30.62 44060

# Check environment variables
docker-compose exec backend env | grep DB_
```

### Issue: Frontend not accessible
```bash
# Check if port 80 is in use
sudo netstat -tulpn | grep :80

# View nginx logs
docker-compose logs frontend
```

### Issue: Services won't start
```bash
# Check Docker status
sudo systemctl status docker

# Free up resources
docker system prune -f

# Check logs for specific errors
docker-compose logs backend
```

## 📊 Production Checklist

Before going live:

- [ ] Database credentials are correct
- [ ] Session secret is secure (32+ characters)
- [ ] Firewall allows ports 80 and 3001
- [ ] SSL certificate configured (if using HTTPS)
- [ ] Backup procedures in place
- [ ] Monitoring alerts configured

## 🔐 Security Notes

- Environment files contain sensitive data - never commit them
- Use strong passwords for database and session secret
- Consider using Docker secrets for production
- Set up log rotation for production use
- Regular security updates for base images

## 📞 Quick Support

**Most Common Issues:**
1. **Database connection**: Check credentials in `.env.production`
2. **Port conflicts**: Ensure ports 80 and 3001 are available
3. **Permission errors**: Check file permissions on config directories
4. **Build failures**: Ensure Docker has enough disk space

**Emergency Recovery:**
```bash
# Stop all services
./deploy.sh stop

# Clean everything
docker system prune -a -f

# Redeploy from scratch
./deploy.sh production
```

---

📖 **Full Documentation**: See `DEPLOYMENT.md`
🔧 **Configuration**: Edit `.env.production`
📝 **Logs**: `docker-compose logs -f`