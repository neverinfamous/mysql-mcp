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

ARG PNPM_VERSION=11.9.0

WORKDIR /app

# Silence npm update notices during image build
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install -g pnpm@${PNPM_VERSION} && \
    pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig*.json tsup.config.ts ./
COPY src/ ./src/

# Build the application
RUN pnpm run build

# -----------------
# Stage 2: Runtime
# -----------------
FROM node:26-alpine AS runtime

ARG PNPM_VERSION=11.9.0

# MCP Registry label for package validation
LABEL io.modelcontextprotocol.server.name="io.github.neverinfamous/mysql-mcp"

WORKDIR /app

# Silence npm update notices during image build
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Upgrade Alpine base packages to fix CVEs
RUN apk upgrade --no-cache

# Security Notes:
# - Last Docker Scout scan: 2026-11-05 on node:26-alpine (Node v26.13.0, Alpine 3.24), 0 critical / 0 high / 0 medium / 0 low / 0 unspecified (0 vulnerabilities across 60 packages).
# - Alpine OS packages are upgraded via `apk upgrade --no-cache` plus `musl`/`musl-utils >=1.2.6-r6` from Alpine edge (fixes CVE-2026-107891).
# - Runtime vs bundled: production dependencies are installed via `pnpm install --prod --frozen-lockfile`,
#   and both `pnpm` and `npm`/`npx` are completely removed from the runtime image after installation
#   to eliminate bundled npm CVEs (undici, brace-expansion, ip-address, minimatch, glob, tar).
# - Transitive runtime and build-time packages are pinned via `pnpm-workspace.yaml` / `package.json`
#   `overrides` and `resolutions` (`@hono/node-server`, `hono`, `esbuild`, `brace-expansion`, `ip-address`,
#   `undici`, `postcss`, `fast-uri`, `minimatch`, `glob`, `tar`, `vite`).

# Create non-root user for security
RUN addgroup -g 1001 app && \
    adduser -D -u 1001 -G app app

# Configure default bind host for HTTP transport in Docker
ENV MCP_HOST=0.0.0.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install production dependencies only (needs build tools for better-sqlite3)
# Then remove pnpm, npm, and npx to reduce runtime attack surface
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm@${PNPM_VERSION} && \
    pnpm install --prod --frozen-lockfile && \
    pnpm store prune && \
    npm uninstall -g pnpm && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /root/.npm && \
    apk del python3 make g++

# Upgrade musl and musl-utils from Alpine edge after build tools (musl-dev) are removed (fixes CVE-2026-107891)
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main 'musl>=1.2.6-r6' 'musl-utils>=1.2.6-r6'

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
