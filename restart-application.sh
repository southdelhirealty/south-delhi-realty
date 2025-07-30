#!/bin/bash

echo "🚀 South Delhi Realty - Application Restart Script"
echo "=================================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to restart application
restart_app() {
    echo "🔄 Attempting to restart the application..."
    
    # Try Docker Compose first
    if command_exists docker-compose; then
        echo "📦 Attempting Docker Compose restart..."
        if docker-compose ps | grep -q southdelhirealty; then
            docker-compose restart southdelhirealty-app
            echo "✅ Docker Compose restart completed"
            return 0
        fi
    fi
    
    # Try Docker directly
    if command_exists docker; then
        echo "🐳 Attempting Docker restart..."
        if docker ps | grep -q southdelhirealty; then
            docker restart $(docker ps --filter "name=southdelhirealty" -q)
            echo "✅ Docker restart completed"
            return 0
        fi
    fi
    
    # Try PM2
    if command_exists pm2; then
        echo "⚡ Attempting PM2 restart..."
        pm2 restart south-delhi-real-estate 2>/dev/null || pm2 restart all
        echo "✅ PM2 restart completed"
        return 0
    fi
    
    # Try systemd
    if command_exists systemctl; then
        echo "🔧 Attempting systemd restart..."
        if systemctl is-active --quiet south-delhi-realty; then
            sudo systemctl restart south-delhi-realty
            echo "✅ Systemd restart completed"
            return 0
        fi
    fi
    
    echo "⚠️  Could not determine how to restart the application"
    echo "💡 Please manually restart using your deployment method"
    return 1
}

# Function to check application status
check_status() {
    echo ""
    echo "🔍 Checking application status..."
    
    # Check if port 7922 is in use
    if netstat -tlnp 2>/dev/null | grep -q ":7922"; then
        echo "✅ Application appears to be running on port 7922"
        
        # Try to access health endpoint
        if command_exists curl; then
            echo "🏥 Testing health endpoint..."
            if curl -s http://localhost:7922/health >/dev/null; then
                echo "✅ Health check passed"
            else
                echo "⚠️  Health check failed"
            fi
        fi
    else
        echo "❌ No application found running on port 7922"
    fi
}

# Function to test database connectivity
test_database() {
    echo ""
    echo "🗄️  Testing database connectivity..."
    
    if [ -f "test-db-connection.mjs" ]; then
        node test-db-connection.mjs | tail -5
    else
        echo "⚠️  Database test script not found"
    fi
}

# Main execution
echo "Starting application restart process..."
echo ""

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "📋 Loading environment variables..."
    export $(grep -v '^#' .env | xargs)
fi

# Attempt restart
restart_app

# Check status after restart
sleep 5
check_status

# Test database
test_database

echo ""
echo "🎯 Next Steps:"
echo "1. Visit https://southdelhirealty.com to verify properties are visible"
echo "2. Test admin login at https://southdelhirealty.com/auth"
echo "3. Monitor logs for any errors"
echo ""
echo "✅ Restart script completed!"
