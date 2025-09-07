#!/bin/bash

# Network CMDB Quick Setup Script
# This script helps set up the Network CMDB application for Docker deployment

set -e

echo "🏗️  Network CMDB Setup Script"
echo "=============================="

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null; then
        echo "❌ Docker Compose is not available. Please install Docker Compose."
        exit 1
    else
        DOCKER_COMPOSE="docker compose"
    fi
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "✅ Docker and Docker Compose are available"

# Create required directories
echo "📁 Creating required directories..."
mkdir -p logs/backend logs/frontend config/backend config/frontend
echo "✅ Directories created"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "⚙️  Setting up environment configuration..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.production
        echo "✅ Created .env.production from example"
        echo ""
        echo "🔧 IMPORTANT: Please edit .env.production and update the following:"
        echo "   - DB_HOST: Your MySQL server hostname"
        echo "   - DB_NAME: Your database name"
        echo "   - DB_USER: Your database username"
        echo "   - DB_PASSWORD: Your database password"
        echo "   - JWT_SECRET: A secure secret key (32+ characters)"
        echo "   - SESSION_SECRET: A secure secret key (32+ characters)"
        echo ""
        read -p "Press Enter when you've configured .env.production..."
    else
        echo "❌ .env.example not found. Please create .env.production manually."
        exit 1
    fi
else
    echo "✅ .env.production already exists"
fi

# Check if we can connect to database
echo "🔍 Checking database configuration..."
if command -v mysql &> /dev/null; then
    # Source the .env.production file
    if [ -f ".env.production" ]; then
        export $(grep -v '^#' .env.production | xargs)
        
        echo "Testing database connection..."
        if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" &> /dev/null; then
            echo "✅ Database connection successful"
        else
            echo "⚠️  Could not connect to database. Please verify your database configuration."
            echo "   The application will still build, but may not work without a proper database connection."
        fi
    fi
else
    echo "⚠️  MySQL client not found. Skipping database connection test."
fi

# Build and start the application
echo "🐳 Building and starting Docker containers..."
echo "This may take a few minutes on first run..."

if $DOCKER_COMPOSE up --build -d; then
    echo "✅ Containers started successfully"
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    # Check service status
    echo "📊 Service Status:"
    $DOCKER_COMPOSE ps
    
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "🌐 Access your Network CMDB:"
    echo "   Frontend: http://localhost"
    echo "   Backend API: http://localhost:3001"
    echo "   Health Check: http://localhost:3001/health"
    echo ""
    echo "👤 Demo Accounts:"
    echo "   Admin: admin / admin123 (Full access)"
    echo "   User:  user / user123   (Read-only)"
    echo ""
    echo "📝 Useful commands:"
    echo "   View logs:     $DOCKER_COMPOSE logs -f"
    echo "   Stop services: $DOCKER_COMPOSE down"
    echo "   Restart:       $DOCKER_COMPOSE restart"
    echo "   Update:        $DOCKER_COMPOSE up --build -d"
    
else
    echo "❌ Failed to start containers. Check the logs:"
    echo "   $DOCKER_COMPOSE logs"
    exit 1
fi