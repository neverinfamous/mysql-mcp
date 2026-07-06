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
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig*.json tsup.config.ts ./
COPY src/ ./src/

# Build the application
RUN pnpm run build

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
# - CVE-2026-26960: tar < 7.5.8 (patch npm's bundled copy with 7.5.19)
# - CVE-2026-27904: minimatch < 10.2.3 (patch npm's bundled copy with 10.2.5)
RUN npm install -g npm@latest pnpm && \
    npm install -g tar@7.5.19 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    cp -r /usr/local/lib/node_modules/tar /usr/local/lib/node_modules/npm/node_modules/tar && \
    npm uninstall -g tar && \
    npm install -g minimatch@10.2.5 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    cp -r /usr/local/lib/node_modules/minimatch /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    npm uninstall -g minimatch && \
    npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 app && \
    adduser -D -u 1001 -G app app

# Configure default bind host for HTTP transport in Docker
ENV MCP_HOST=0.0.0.0

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only (needs build tools for better-sqlite3)
RUN apk add --no-cache python3 make g++ && \
    pnpm install --prod --frozen-lockfile && \
    pnpm store prune && \
    apk del python3 make g++

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
