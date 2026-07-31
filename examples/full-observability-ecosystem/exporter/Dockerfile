FROM node:26-alpine

# Install build dependencies required for native node modules (e.g. better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install the mysql-mcp package globally
RUN npm install -g @neverinfamous/mysql-mcp

# Remove build dependencies to keep the image small
RUN apk del python3 make g++

# Configure default bind host for HTTP transport in Docker
ENV MCP_HOST=0.0.0.0

# Ensure the logs directory exists
RUN mkdir -p /var/log/mysql-mcp

# The entrypoint launches the global binary
ENTRYPOINT ["mysql-mcp"]
