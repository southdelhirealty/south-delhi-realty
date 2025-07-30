#!/bin/bash

# Non-Docker deployment script for South Delhi Real Estate
# This script builds and runs the application without Docker

set -e

echo "🚀 Starting South Delhi Real Estate deployment (without Docker)..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building the application..."
npm run build:production

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs uploads

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create one based on .env.example"
    exit 1
fi

echo "✅ .env file found"

# Start the application using PM2 if available, otherwise use node directly
if command -v pm2 &> /dev/null; then
    echo "🚀 Starting application with PM2..."
    npm run pm2:start
else
    echo "🚀 Starting application with Node.js..."
    echo "Note: Install PM2 globally for production use: npm install -g pm2"
    npm start
fi

echo "✅ Deployment completed successfully!"
echo "🌐 Application should be running on port 7922"
echo "📝 Check logs in the logs/ directory"
