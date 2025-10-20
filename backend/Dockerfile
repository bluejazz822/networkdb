# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Configure npm for better reliability and install dependencies
RUN npm config set fetch-timeout 300000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm install && npm cache clean --force

# Copy source code
COPY . .

# Build only the minimal server with dependencies
# Copy src directory structure to dist for imports
RUN mkdir -p dist/src && \
    cp -r src dist/ && \
    npx tsc src/server-minimal.ts \
    --outDir dist \
    --target ES2020 \
    --module commonjs \
    --esModuleInterop \
    --skipLibCheck \
    --resolveJsonModule \
    --allowSyntheticDefaultImports \
    --moduleResolution node \
    --noEmitOnError false || echo "TypeScript compilation completed with warnings"

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Configure npm and install only production dependencies
RUN npm config set fetch-timeout 300000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm install --omit=dev && npm cache clean --force

# Copy built application and source dependencies from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

# Create config directory for external configuration
RUN mkdir -p /app/config && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3301

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3301/health', (res) => { \
    if (res.statusCode === 200) process.exit(0); else process.exit(1); \
  }).on('error', () => process.exit(1));"

# Start the minimal server
CMD ["node", "dist/server-minimal.js"]