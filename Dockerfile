# Multi-stage build for South Delhi Real Estate App
FROM ubuntu:22.04 AS base

# Install Node.js 20 manually
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package*.json ./
# Remove package-lock.json and regenerate it to avoid version conflicts
RUN npm install --production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY package*.json ./
# Use npm install instead of npm ci to regenerate lock file
RUN npm install

# Copy source code
COPY . .

# Copy environment variables for build time
COPY .env .env

# Build the application (both client and server)
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV PORT=7922

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser

# Install global dependencies needed for production
RUN npm install -g tsx pm2

# Copy package.json and install production dependencies
COPY package*.json ./
RUN npm install --production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/shared ./shared
COPY --from=builder --chown=nodeuser:nodejs /app/server ./server
COPY --from=builder --chown=nodeuser:nodejs /app/migrations ./migrations

# Copy configuration files
COPY --chown=nodeuser:nodejs ecosystem.config.cjs ./
COPY --chown=nodeuser:nodejs tsconfig.json ./
COPY --chown=nodeuser:nodejs tsconfig.server.json ./
COPY --chown=nodeuser:nodejs drizzle.config.ts ./

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads && chown -R nodeuser:nodejs /app/logs /app/uploads

# Switch to non-root user
USER nodeuser

# Expose the port the app runs on
EXPOSE 7922

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: process.env.PORT || 7922, path: '/health', timeout: 2000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Start the application using tsx directly
CMD ["tsx", "server/index.ts"]
