#!/bin/bash

# Network CMDB Server Management Script
# This script ensures only one backend server runs at a time with proper database configuration

echo "🚀 Starting Network CMDB Server..."

# Step 1: Kill any existing servers on port 3001
echo "📋 Checking for existing servers on port 3001..."
EXISTING_PIDS=$(lsof -ti:3001 2>/dev/null)
if [ ! -z "$EXISTING_PIDS" ]; then
    echo "⚠️  Found existing processes on port 3001: $EXISTING_PIDS"
    echo "🛑 Killing existing processes..."
    echo "$EXISTING_PIDS" | xargs kill -9 2>/dev/null
    sleep 2
    echo "✅ Cleaned up existing processes"
else
    echo "✅ Port 3001 is available"
fi

# Step 2: Kill any conflicting Node.js processes that might interfere
echo "🧹 Cleaning up any conflicting Node.js processes..."
pkill -f "server-minimal.ts" 2>/dev/null || true
pkill -f "server-docker.js" 2>/dev/null || true
sleep 1

# Step 3: Verify port is free
echo "🔍 Verifying port 3001 is free..."
if lsof -i:3001 >/dev/null 2>&1; then
    echo "❌ Port 3001 is still in use. Waiting 5 seconds and trying again..."
    sleep 5
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Step 4: Start the production backend server
echo "🏁 Starting production backend server..."
cd /Users/sunsun/networkdb/backend

# Production database configuration
export DB_HOST=172.16.30.62
export DB_PORT=44060
export DB_NAME=mydatabase
export DB_USER=root
export DB_PASSWORD='Gq34Ko90#110'
export PORT=3001

echo "💾 Database Configuration:"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Server Port: $PORT"

# Start the server
echo "▶️  Starting server..."
npx ts-node src/server-minimal.ts &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Step 5: Verify server is running
echo "✅ Checking server status..."
if ps -p $SERVER_PID > /dev/null; then
    echo "🎉 Server started successfully with PID: $SERVER_PID"
    echo "🌐 Server accessible at: http://localhost:3001"
    echo "📊 VPC Data: http://localhost:3001/api/vpcs"
    echo "🔄 Workflows: http://localhost:3001/api/workflows"
    echo "❤️  Health Check: http://localhost:3001/health"

    # Test the API
    echo "🧪 Testing API connection..."
    if curl -f -s http://localhost:3001/health > /dev/null; then
        echo "✅ API is responding correctly"
    else
        echo "⚠️  API may not be ready yet, give it a moment"
    fi
else
    echo "❌ Server failed to start"
    exit 1
fi

echo ""
echo "🎯 Server Management Commands:"
echo "   Stop server: kill $SERVER_PID"
echo "   View logs: tail -f /Users/sunsun/networkdb/backend/server.log"
echo "   Restart: $0"
echo ""
echo "📝 To make this script executable: chmod +x $0"
echo "🔄 To restart servers permanently: $0"