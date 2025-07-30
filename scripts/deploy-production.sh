#!/bin/bash

# Production Deployment Script with Database Health Checks
# This script helps deploy the South Delhi Realty application with proper database connectivity

echo "🚀 South Delhi Realty - Production Deployment Script"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Step 1: Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

print_status "Found package.json - in correct directory"

# Step 2: Check if environment variables are set
print_info "Checking environment variables..."

required_vars=(
    "DB_HOST"
    "DB_USER" 
    "DB_PASSWORD"
    "DB_NAME"
    "SESSION_SECRET"
    "CLOUDINARY_CLOUD_NAME"
    "CLOUDINARY_API_KEY"
    "CLOUDINARY_API_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    print_info "Please set these environment variables before deployment"
    exit 1
fi

print_status "All required environment variables are set"

# Step 3: Test database connection
print_info "Testing database connection..."
node scripts/check-db-connection.js

if [ $? -ne 0 ]; then
    print_error "Database connection test failed"
    print_info "Please check your database configuration and try again"
    exit 1
fi

print_status "Database connection test passed"

# Step 4: Install dependencies
print_info "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi

print_status "Dependencies installed successfully"

# Step 5: Build client
print_info "Building client application..."
npm run build:client

if [ $? -ne 0 ]; then
    print_error "Client build failed"
    exit 1
fi

print_status "Client build completed"

# Step 6: Build server
print_info "Building server application..."
npm run build:server

if [ $? -ne 0 ]; then
    print_error "Server build failed"
    exit 1
fi

print_status "Server build completed"

# Step 7: Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 not found. Installing PM2..."
    npm install -g pm2
fi

print_status "PM2 is available"

# Step 8: Start or restart the application
print_info "Starting/restarting the application..."

# Check if the application is already running
if pm2 list | grep -q "south-delhi-realty"; then
    print_info "Application is running. Restarting..."
    pm2 restart south-delhi-realty
else
    print_info "Starting new application instance..."
    pm2 start ecosystem.config.cjs
fi

if [ $? -ne 0 ]; then
    print_error "Failed to start application"
    exit 1
fi

print_status "Application started successfully"

# Step 9: Test application health
print_info "Waiting for application to start..."
sleep 10

# Test if the application is responding
if curl -f http://localhost:7922 > /dev/null 2>&1; then
    print_status "Application is responding on port 7922"
else
    print_warning "Application may not be responding. Check PM2 logs:"
    print_info "Run: pm2 logs south-delhi-realty"
fi

# Step 10: Display PM2 status
print_info "PM2 Status:"
pm2 status

# Step 11: Show logs command
print_info "To view logs, run: pm2 logs south-delhi-realty"
print_info "To monitor the application, run: pm2 monit"

echo ""
print_status "Deployment completed successfully!"
echo ""
print_info "Application should be available at: http://localhost:7922"
print_info "If using nginx, make sure your reverse proxy is configured correctly"

# Step 12: Show important commands
echo ""
print_info "Important commands:"
echo "  - View logs: pm2 logs south-delhi-realty"
echo "  - Restart app: pm2 restart south-delhi-realty"
echo "  - Stop app: pm2 stop south-delhi-realty"
echo "  - Monitor: pm2 monit"
echo "  - Test DB: node scripts/check-db-connection.js"
