# =============================================================================
# MySQL MCP Server - Docker Image
# =============================================================================
# Multi-stage build for optimal image size and security
# Production-ready image: ~150MB
# =============================================================================

# -----------------
# Stage 1: Builder
# -----------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN npm run build

# -----------------
# Stage 2: Runtime
# -----------------
FROM node:20-alpine AS runtime

WORKDIR /app

# Upgrade Alpine base packages to fix CVEs
RUN apk upgrade --no-cache

# Create non-root user for security
RUN addgroup -g 1001 app && \
    adduser -D -u 1001 -G app app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Default entrypoint - run the CLI
ENTRYPOINT ["node", "dist/cli.js"]

# Default arguments (can be overridden)
CMD ["--help"]
