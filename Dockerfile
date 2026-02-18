# =============================================================================
# MySQL MCP Server - Docker Image
# =============================================================================
# Multi-stage build for optimal image size and security
# Production-ready image: ~150MB
# =============================================================================

# -----------------
# Stage 1: Builder
# -----------------
FROM node:24-alpine AS builder

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
FROM node:24-alpine AS runtime

# MCP Registry label for package validation
LABEL io.modelcontextprotocol.server.name="io.github.neverinfamous/mysql-mcp"

WORKDIR /app

# Upgrade Alpine base packages to fix CVEs
RUN apk upgrade --no-cache

# Upgrade npm to fix CVEs in bundled dependencies:
# - CVE-2024-21538: cross-spawn < 7.0.5
# - CVE-2025-64756: glob < 10.5.0
# - CVE-2025-5889: brace-expansion <= 2.0.1
# - CVE-2026-26960: tar < 7.5.8 (patch npm's bundled copy)
RUN npm install -g npm@latest && \
    npm install -g tar@latest && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    cp -r /usr/local/lib/node_modules/tar /usr/local/lib/node_modules/npm/node_modules/tar && \
    npm uninstall -g tar && \
    npm cache clean --force

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
