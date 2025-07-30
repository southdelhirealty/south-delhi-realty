#!/bin/bash

# South Delhi Real Estate - Direct Node.js Deployment
# This runs the application directly with external MySQL database
# Use this when Docker networking issues prevent container builds

set -e

echo "🚀 Starting South Delhi Real Estate Application (Direct Node.js)"
echo "============================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create it with your database credentials."
    exit 1
fi

echo "✅ Environment file found: .env"
echo "✅ Node.js version: $(node --version)"

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs uploads

# Build the application
echo "🏗️  Building application..."
npm run build

# Start the application
echo "🚀 Starting application on port 7922..."
echo "🌐 Application will be available at: http://localhost:7922"
echo "📊 Press Ctrl+C to stop the application"
echo ""

# Change to dist directory and start
cd dist && node server/index.js
