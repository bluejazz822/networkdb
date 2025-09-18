#!/bin/bash

# Network CMDB Production Deployment Script
# Usage: ./deploy.sh [production|staging|loadbalancer|stop|status|logs|update|backup|restore]

set -e

ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="network-cmdb"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_requirements() {
    log "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
        exit 1
    fi
    
    success "Requirements check passed"
}

setup_directories() {
    log "Setting up directories..."
    
    mkdir -p logs/{backend,frontend,staging/{backend,frontend}}
    mkdir -p config/{backend,frontend,staging/{backend,frontend}}
    
    # Set proper permissions
    chmod 755 logs/ config/
    
    success "Directories created"
}

check_environment_file() {
    local env_file=".env.${ENVIRONMENT}"
    
    if [[ ! -f "$env_file" ]]; then
        error "Environment file $env_file not found"
        error "Please create $env_file with required configuration"
        exit 1
    fi
    
    # Check required variables
    local required_vars=("DB_HOST" "DB_PORT" "DB_NAME" "DB_USER" "DB_PASSWORD")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi
    
    success "Environment file validation passed"
}

deploy() {
    local env=$1
    
    if [[ "$env" == "staging" ]]; then
        COMPOSE_FILE="docker-compose.staging.yml"
        PROJECT_NAME="network-cmdb-staging"
    fi
    
    log "Starting deployment for $env environment..."
    
    check_requirements
    setup_directories
    check_environment_file
    
    # Build and start services
    log "Building and starting services..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --build
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check health
    local backend_port="3001"
    local frontend_port="80"
    
    if [[ "$env" == "staging" ]]; then
        backend_port="3002"
        frontend_port="8080"
    fi
    
    log "Checking service health..."
    
    # Check backend health
    if curl -f -s "http://localhost:${backend_port}/health" > /dev/null; then
        success "Backend health check passed"
    else
        error "Backend health check failed"
        show_logs
        exit 1
    fi
    
    # Check frontend health
    if curl -f -s "http://localhost:${frontend_port}/" > /dev/null; then
        success "Frontend health check passed"
    else
        error "Frontend health check failed"
        show_logs
        exit 1
    fi
    
    success "Deployment completed successfully!"
    success "Frontend: http://localhost:${frontend_port}"
    success "Backend API: http://localhost:${backend_port}/api"
    
    show_status
}

stop_services() {
    local env=$1
    
    if [[ "$env" == "staging" ]]; then
        COMPOSE_FILE="docker-compose.staging.yml"
        PROJECT_NAME="network-cmdb-staging"
    fi
    
    log "Stopping $env services..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    success "Services stopped"
}

show_status() {
    log "Service Status:"
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
}

show_logs() {
    log "Recent logs:"
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs --tail=50
}

update_application() {
    local env=$1
    
    if [[ "$env" == "staging" ]]; then
        COMPOSE_FILE="docker-compose.staging.yml"
        PROJECT_NAME="network-cmdb-staging"
    fi
    
    log "Updating application..."
    
    # Pull latest code
    log "Pulling latest code..."
    git pull origin main
    
    # Rebuild and restart
    log "Rebuilding services..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --build
    
    # Wait and verify
    sleep 30
    show_status
    
    success "Application updated successfully"
}

cleanup() {
    log "Cleaning up unused Docker resources..."
    docker system prune -f
    docker volume prune -f
    success "Cleanup completed"
}

deploy_loadbalancer() {
    log "Deploying load balanced configuration..."

    COMPOSE_FILE="docker-compose.loadbalancer.yml"
    PROJECT_NAME="network-cmdb-lb"

    check_requirements
    setup_directories
    check_environment_file

    # Create nginx config directory
    mkdir -p config/nginx config/redis

    # Build and start services
    log "Building and starting load balanced services..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --build

    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 45

    # Check health
    log "Checking load balancer health..."
    if curl -f -s "http://localhost:80/health" > /dev/null; then
        success "Load balancer health check passed"
    else
        error "Load balancer health check failed"
        show_logs
        exit 1
    fi

    success "Load balanced deployment completed successfully!"
    success "Access: http://localhost:80"

    show_status
}

backup_database() {
    log "Starting database backup..."

    if [ ! -f "scripts/backup-database.sh" ]; then
        error "Backup script not found: scripts/backup-database.sh"
        exit 1
    fi

    # Source environment variables
    if [ -f ".env.production" ]; then
        export $(grep -v '^#' .env.production | xargs)
    fi

    ./scripts/backup-database.sh
}

restore_database() {
    log "Starting database restore..."

    if [ ! -f "scripts/restore-database.sh" ]; then
        error "Restore script not found: scripts/restore-database.sh"
        exit 1
    fi

    # Source environment variables
    if [ -f ".env.production" ]; then
        export $(grep -v '^#' .env.production | xargs)
    fi

    ./scripts/restore-database.sh
}

health_check() {
    local env=$1

    if [[ "$env" == "staging" ]]; then
        local backend_port="3302"
        local frontend_port="8080"
    elif [[ "$env" == "loadbalancer" ]]; then
        local backend_port="80"
        local frontend_port="80"
    else
        local backend_port="3301"
        local frontend_port="80"
    fi

    log "Performing comprehensive health check..."

    # Backend health
    if curl -f -s "http://localhost:${backend_port}/health" > /dev/null; then
        success "Backend health check passed"
    else
        error "Backend health check failed"
        return 1
    fi

    # Frontend health
    if curl -f -s "http://localhost:${frontend_port}/" > /dev/null; then
        success "Frontend health check passed"
    else
        error "Frontend health check failed"
        return 1
    fi

    # API endpoint test
    if curl -f -s "http://localhost:${frontend_port}/api/health" > /dev/null; then
        success "API endpoint check passed"
    else
        warning "API endpoint check failed (may be expected if backend is behind load balancer)"
    fi

    success "Health check completed"
}

monitoring_setup() {
    log "Setting up monitoring and alerting..."

    # Create monitoring directories
    mkdir -p monitoring/{prometheus,grafana,alertmanager}

    # Basic monitoring setup placeholder
    log "Monitoring directories created"
    warning "Full monitoring setup requires additional configuration"
    warning "Consider integrating with Prometheus, Grafana, or your preferred monitoring solution"
}

case "$ENVIRONMENT" in
    "production")
        deploy "production"
        ;;
    "staging")
        deploy "staging"
        ;;
    "loadbalancer")
        deploy_loadbalancer
        ;;
    "stop")
        env=${2:-production}
        stop_services "$env"
        ;;
    "status")
        env=${2:-production}
        if [[ "$env" == "staging" ]]; then
            COMPOSE_FILE="docker-compose.staging.yml"
            PROJECT_NAME="network-cmdb-staging"
        elif [[ "$env" == "loadbalancer" ]]; then
            COMPOSE_FILE="docker-compose.loadbalancer.yml"
            PROJECT_NAME="network-cmdb-lb"
        fi
        show_status
        ;;
    "logs")
        env=${2:-production}
        if [[ "$env" == "staging" ]]; then
            COMPOSE_FILE="docker-compose.staging.yml"
            PROJECT_NAME="network-cmdb-staging"
        elif [[ "$env" == "loadbalancer" ]]; then
            COMPOSE_FILE="docker-compose.loadbalancer.yml"
            PROJECT_NAME="network-cmdb-lb"
        fi
        show_logs
        ;;
    "update")
        env=${2:-production}
        update_application "$env"
        ;;
    "cleanup")
        cleanup
        ;;
    "backup")
        backup_database
        ;;
    "restore")
        restore_database
        ;;
    "health")
        env=${2:-production}
        health_check "$env"
        ;;
    "monitoring")
        monitoring_setup
        ;;
    *)
        echo "Usage: $0 {production|staging|loadbalancer|stop [env]|status [env]|logs [env]|update [env]|cleanup|backup|restore|health [env]|monitoring}"
        echo ""
        echo "Commands:"
        echo "  production      Deploy to production environment"
        echo "  staging         Deploy to staging environment"
        echo "  loadbalancer    Deploy with load balancer (multiple instances)"
        echo "  stop [env]      Stop services (default: production)"
        echo "  status [env]    Show service status (default: production)"
        echo "  logs [env]      Show service logs (default: production)"
        echo "  update [env]    Update application (default: production)"
        echo "  cleanup         Clean up unused Docker resources"
        echo "  backup          Create database backup"
        echo "  restore         Restore database from backup"
        echo "  health [env]    Perform health check (default: production)"
        echo "  monitoring      Setup monitoring directories"
        echo ""
        echo "Examples:"
        echo "  $0 production"
        echo "  $0 loadbalancer"
        echo "  $0 stop production"
        echo "  $0 health loadbalancer"
        echo "  $0 backup"
        exit 1
        ;;
esac