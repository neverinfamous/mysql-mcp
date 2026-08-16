# =============================================================================
# MySQL MCP Server - Docker Image
# =============================================================================
# Multi-stage build for optimal image size and security
# Production-ready image: ~150MB
# =============================================================================

# -----------------
# Stage 1: Builder
# -----------------
FROM node:26-alpine AS builder

ARG PNPM_VERSION=9.15.4

WORKDIR /app

# Silence npm update notices during image build
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install -g pnpm@${PNPM_VERSION} && \
    pnpm install --frozen-lockfile > /dev/null 2>&1

# Copy source code
COPY tsconfig*.json tsup.config.ts ./
COPY src/ ./src/

# Build the application
RUN pnpm run build

# -----------------
# Stage 2: Runtime
# -----------------
FROM node:26-alpine AS runtime

ARG PNPM_VERSION=9.15.4

# MCP Registry label for package validation
LABEL io.modelcontextprotocol.server.name="io.github.neverinfamous/mysql-mcp"

WORKDIR /app

# Silence npm update notices during image build
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Upgrade Alpine base packages to fix CVEs
RUN apk upgrade --no-cache

# Upgrade npm to fix CVEs in bundled dependencies:
# - CVE-2024-21538: cross-spawn < 7.0.5
# - CVE-2025-64756: glob < 10.5.0
# - CVE-2025-5889: brace-expansion <= 2.0.1
# - CVE-2026-26960: tar < 7.5.8 (patch npm's bundled copy with 7.5.22)
# - CVE-2026-27904: minimatch < 10.2.3 (patch npm's bundled copy with 10.2.6)
# - CVE-2026-69152: brace-expansion < 5.0.9 (patch npm's bundled copy with 5.0.9)
# - CVE-2026-69192: ip-address <= 10.3.0 (patch npm's bundled copy with 10.5.0)
# - CVE-2026-16729: undici < 6.28.0 (patch npm's bundled copy with 8.10.0)
RUN npm install -g npm@latest && \
    npm install -g tar@7.5.22 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    cp -r /usr/local/lib/node_modules/tar /usr/local/lib/node_modules/npm/node_modules/tar && \
    npm uninstall -g tar && \
    npm install -g minimatch@10.2.6 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    cp -r /usr/local/lib/node_modules/minimatch /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    npm uninstall -g minimatch && \
    npm install -g brace-expansion@5.0.9 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/brace-expansion && \
    cp -r /usr/local/lib/node_modules/brace-expansion /usr/local/lib/node_modules/npm/node_modules/brace-expansion && \
    npm uninstall -g brace-expansion && \
    npm install -g ip-address@10.5.0 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/ip-address && \
    cp -r /usr/local/lib/node_modules/ip-address /usr/local/lib/node_modules/npm/node_modules/ip-address && \
    npm uninstall -g ip-address && \
    npm install -g undici@8.10.0 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/undici && \
    cp -r /usr/local/lib/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/undici && \
    npm uninstall -g undici && \
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
    npm install -g pnpm@${PNPM_VERSION} && \
    pnpm install --prod --frozen-lockfile > /dev/null 2>&1 && \
    pnpm store prune && \
    npm uninstall -g pnpm && \
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
