# Network CMDB - Configuration Management Database

A modern, web-based Configuration Management Database (CMDB) for network infrastructure management. Built with React, Node.js, and MySQL, designed for enterprise network teams.

![Network CMDB Dashboard](https://img.shields.io/badge/Status-Production%20Ready-green)
![Docker Support](https://img.shields.io/badge/Docker-Supported-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- 🏗️ **VPC Management**: Full CRUD operations for AWS VPC inventory
- 👤 **Role-Based Access**: Admin and user roles with different permissions
- 📊 **Real-time Updates**: Auto-refresh capability with live data synchronization
- 📄 **Export Capabilities**: Export to CSV, Excel, and PDF formats
- 🔒 **Secure Authentication**: Built-in user management with session handling
- 🐳 **Docker Ready**: Full containerization with docker-compose deployment
- 🎨 **Modern UI**: Clean, responsive interface built with Ant Design
- ⚡ **Fast Performance**: Optimized for large datasets with pagination

## Demo Accounts

The system comes with pre-configured demo accounts for testing:

| Role | Username | Password | Permissions |
|------|----------|----------|-------------|
| Admin | `admin` | `admin123` | Full edit permissions |
| User | `user` | `user123` | Read-only access |

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed
- MySQL database accessible (can be local or remote)

### Option 1: Automated Setup (Recommended)

```bash
git clone <repository-url>
cd networkdb
./setup.sh
```

The setup script will:
- Check prerequisites
- Create required directories
- Set up environment configuration
- Test database connection
- Build and start all services
- Provide access information and helpful commands

### Option 2: Manual Setup

### 1. Clone and Setup

```bash
git clone <repository-url>
cd networkdb
```

### 2. Configure Environment

Create a `.env.production` file in the root directory:

```env
# Database Configuration
DB_HOST=your-mysql-host
DB_PORT=3306
DB_NAME=network_cmdb
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# Application Settings
NODE_ENV=production
JWT_SECRET=your-jwt-secret-key-here
SESSION_SECRET=your-session-secret-key-here

# Optional: Logging
LOG_LEVEL=info
```

### 3. Create Required Directories

```bash
mkdir -p logs/backend logs/frontend config/backend config/frontend
```

### 4. Start the Application

```bash
# Build and start all services
docker compose up --build -d

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

### 5. Access the Application

- **Frontend**: http://localhost (port 80)
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.development
# Edit .env.development with your database settings

# Start development server
npm run dev
```

The backend will start at http://localhost:3001 with hot reload enabled.

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start at http://localhost:3000 and proxy API requests to the backend.

### Database Schema

The application expects the following MySQL table structure:

```sql
CREATE TABLE vpc_info (
    id VARCHAR(255) PRIMARY KEY,
    VpcId VARCHAR(255) NOT NULL,
    AccountId VARCHAR(255),
    Region VARCHAR(255),
    CidrBlock VARCHAR(255),
    IsDefault VARCHAR(10),
    Name VARCHAR(255),
    ENV_Name VARCHAR(255),  -- Note: Column name with underscore
    Tenant VARCHAR(255),
    Site VARCHAR(255),
    status VARCHAR(50),
    created_time DATETIME,
    termindated_time DATETIME,  -- Note: Intentionally misspelled in schema
    tags TEXT
);
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SPA     │    │   Node.js API   │    │   MySQL DB      │
│  (Port 80)      │◄──►│  (Port 3001)    │◄──►│  (Port 3306)    │
│                 │    │                 │    │                 │
│ - Ant Design    │    │ - Express.js    │    │ - vpc_info      │
│ - Authentication│    │ - Sequelize ORM │    │ - User data     │
│ - VPC Management│    │ - JWT Auth      │    │                 │
│ - Export Tools  │    │ - TypeScript    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Production Deployment

### Environment Configuration

1. **Database**: Ensure MySQL is properly configured with the required schema
2. **Security**: Use strong JWT and session secrets
3. **SSL/TLS**: Configure reverse proxy (nginx) for HTTPS
4. **Monitoring**: Set up log aggregation and monitoring

### Docker Compose Production

```yaml
# Example production override
services:
  frontend:
    ports:
      - "443:80"  # Use HTTPS
    volumes:
      - /path/to/ssl:/etc/nginx/ssl:ro
  
  backend:
    environment:
      - NODE_ENV=production
    volumes:
      - /path/to/logs:/app/logs
```

### Health Checks

The system includes built-in health checks:

- **Backend**: `GET /health` - Returns database connectivity status
- **Frontend**: HTTP 200 response check
- **Database**: Connection verification before app start

## API Documentation

### Authentication Endpoints

```
POST /api/auth/login - User authentication
POST /api/auth/logout - User logout
GET /api/auth/me - Get current user
```

### VPC Management Endpoints

```
GET /api/vpcs - List all VPCs
GET /api/vpcs/:id - Get VPC by ID
PUT /api/vpcs/:id - Update VPC (admin only)
```

### Export Endpoints

```
GET /api/export/csv - Export VPCs as CSV
GET /api/export/excel - Export VPCs as Excel
GET /api/export/pdf - Export VPCs as PDF
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check `.env.production` configuration
   - Verify MySQL server is accessible
   - Check firewall settings

2. **Frontend Build Errors**
   - Ensure Node.js 18+ is installed
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`

3. **Docker Build Issues**
   - Check Docker version compatibility
   - Ensure sufficient disk space
   - Try: `docker system prune -a` to clean up

4. **Permission Errors**
   - Verify user accounts in database
   - Check JWT secret configuration
   - Review authentication middleware logs

### Logs and Debugging

```bash
# View application logs
docker compose logs -f backend
docker compose logs -f frontend

# Access container shell
docker compose exec backend sh
docker compose exec frontend sh

# Database connection test
docker compose exec backend node -e "console.log('Testing DB connection...')"
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for type safety
- Follow existing code style and conventions
- Add tests for new features
- Update documentation for API changes

## Technology Stack

- **Frontend**: React 18, TypeScript, Ant Design, Vite
- **Backend**: Node.js, Express.js, TypeScript, Sequelize
- **Database**: MySQL 8.0
- **Containerization**: Docker, Docker Compose
- **Authentication**: JWT tokens, session management
- **Export**: CSV, Excel (xlsx), PDF generation

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review Docker logs for error details
3. Ensure all prerequisites are met
4. Create an issue with detailed error information

---

**Production Ready**: This application has been tested and is ready for production deployment with Docker.