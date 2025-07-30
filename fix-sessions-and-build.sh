#!/bin/bash

echo "🚀 South Delhi Realty - Session Fix & Docker Build"
echo "=================================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Load environment variables
if [ -f ".env" ]; then
    echo "📋 Loading environment variables..."
    export $(grep -v '^#' .env | xargs)
fi

# Step 1: Apply database migration for sessions
echo ""
echo "🗄️  Step 1: Applying session table migration..."
if [ -f "apply-session-migration.mjs" ]; then
    node apply-session-migration.mjs
else
    echo "⚠️  Migration script not found. Please run manually."
fi

# Step 2: Build Docker image
echo ""
echo "🐳 Step 2: Building Docker image for Linux..."

if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Build the Docker image
echo "🔨 Building southdelhirealty image..."
docker build -t southdelhirealty:latest -t southdelhirealty:$(date +%Y%m%d) .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully"
else
    echo "❌ Docker build failed"
    exit 1
fi

# Step 3: Stop existing container if running
echo ""
echo "🔄 Step 3: Managing existing containers..."

if docker ps -q --filter "name=southdelhirealty-app" | grep -q .; then
    echo "🛑 Stopping existing container..."
    docker stop southdelhirealty-app
    docker rm southdelhirealty-app
fi

# Step 4: Start new container with Docker Compose
echo ""
echo "🚀 Step 4: Starting application with Docker Compose..."

if command_exists docker-compose || command_exists docker compose; then
    # Try docker-compose first, then docker compose
    if command_exists docker-compose; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    echo "📦 Using $COMPOSE_CMD to start services..."
    $COMPOSE_CMD up -d
    
    if [ $? -eq 0 ]; then
        echo "✅ Application started successfully"
    else
        echo "❌ Failed to start application"
        exit 1
    fi
else
    echo "⚠️  Docker Compose not found. Starting container manually..."
    docker run -d \
        --name southdelhirealty-app \
        --restart unless-stopped \
        -p 7922:7922 \
        --env-file .env \
        -e SESSION_STORE_TYPE=database \
        -e SESSION_SECURE_COOKIES=false \
        -e SSL_ENABLED=false \
        -v "$(pwd)/uploads:/app/uploads" \
        -v "$(pwd)/logs:/app/logs" \
        southdelhirealty:latest
fi

# Step 5: Wait and check health
echo ""
echo "⏳ Step 5: Waiting for application to start..."
sleep 10

# Check if container is running
if docker ps --filter "name=southdelhirealty-app" --format "table {{.Names}}\t{{.Status}}" | grep -q "Up"; then
    echo "✅ Container is running"
    
    # Test health endpoint
    echo "🏥 Testing health endpoint..."
    for i in {1..5}; do
        if curl -s http://localhost:7922/health >/dev/null 2>&1; then
            echo "✅ Health check passed"
            break
        else
            echo "⏳ Waiting for application to be ready... (attempt $i/5)"
            sleep 5
        fi
    done
else
    echo "❌ Container failed to start"
    echo "📋 Container logs:"
    docker logs southdelhirealty-app --tail 20
    exit 1
fi

# Step 6: Test database session storage
echo ""
echo "🔍 Step 6: Testing session fixes..."
echo "📊 Checking sessions table..."
node -e "
const mysql = require('mysql2/promise');
(async () => {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT || '3306')
        });
        
        const [tables] = await connection.execute(\"SHOW TABLES LIKE 'sessions'\");
        if (tables.length > 0) {
            console.log('✅ Sessions table exists');
            const [count] = await connection.execute('SELECT COUNT(*) as count FROM sessions');
            console.log(\`📊 Sessions in database: \${count[0].count}\`);
        } else {
            console.log('❌ Sessions table not found');
        }
        
        await connection.end();
    } catch (error) {
        console.log('⚠️  Could not verify sessions table:', error.message);
    }
    process.exit(0);
})();
" 2>/dev/null || echo "⚠️  Could not verify sessions table"

# Step 7: Show final status
echo ""
echo "📊 Final Status:"
echo "==============="
docker ps --filter "name=southdelhirealty-app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🎯 Next Steps:"
echo "1. Visit https://southdelhirealty.com to verify properties are visible"
echo "2. Test admin login at https://southdelhirealty.com/auth"
echo "3. Sessions are now stored in database for better reliability"
echo "4. Monitor logs: docker logs southdelhirealty-app -f"
echo ""
echo "✅ Session fix and Docker deployment completed!"

echo ""
echo "🔧 Useful Docker commands:"
echo "  View logs: docker logs southdelhirealty-app -f"
echo "  Restart:   docker restart southdelhirealty-app"
echo "  Stop:      docker stop southdelhirealty-app"
echo "  Rebuild:   docker-compose up --build -d"
