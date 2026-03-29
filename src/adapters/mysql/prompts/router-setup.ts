/**
 * MySQL Prompt - Router Setup
 *
 * Complete MySQL Router configuration guide.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupRouterPrompt(): PromptDefinition {
  return {
    name: "mysql_setup_router",
    description: "Complete MySQL Router setup and configuration guide",
    arguments: [],
    handler: (_args: Record<string, string>, _context: RequestContext) => {
      return Promise.resolve(`# MySQL Router Setup Guide

MySQL Router provides transparent routing between applications and MySQL servers, supporting InnoDB Cluster for high availability.

## Prerequisites

1. **MySQL Router installed** (comes with MySQL 8.0+)
2. **InnoDB Cluster** (optional but recommended for HA)
3. **Admin credentials** for MySQL servers

## Step 1: Bootstrap Router (InnoDB Cluster)

If using InnoDB Cluster:
\`\`\`bash
mysqlrouter --bootstrap admin@primary-host:3306 --user=mysqlrouter
\`\`\`

This auto-configures Router to work with your cluster.

## Step 2: Manual Configuration

For manual setup, edit \`mysqlrouter.conf\`:
\`\`\`ini
[routing:primary]
bind_address = 0.0.0.0
bind_port = 6446
destinations = primary-host:3306
routing_strategy = first-available
mode = read-write

[routing:secondary]
bind_address = 0.0.0.0
bind_port = 6447
destinations = secondary1:3306,secondary2:3306
routing_strategy = round-robin
mode = read-only
\`\`\`

## Step 3: Enable REST API (for monitoring)

Add to mysqlrouter.conf:
\`\`\`ini
[rest_api]
require_realm = default_realm

[rest_router]
require_realm = default_realm

[rest_metadata_cache]
require_realm = default_realm

[rest_connection_pool]
require_realm = default_realm

[http_server]
port = 8443
ssl = 1
ssl_cert = /path/to/router-cert.pem
ssl_key = /path/to/router-key.pem
\`\`\`

> **Note**: \`mysql_router_pool_status\` also requires \`connection_sharing=1\` on at least one route.

## Step 4: Configure MCP Server

Set environment variables:
\`\`\`bash
MYSQL_ROUTER_URL=https://localhost:8443
MYSQL_ROUTER_USERNAME=admin
MYSQL_ROUTER_PASSWORD=your_password
MYSQL_ROUTER_INSECURE=true  # For self-signed certs
\`\`\`

## Step 5: Verify with MCP Tools

Use Router tools to verify:
- \`mysql_router_status\` - Check Router is running
- \`mysql_router_routes\` - List configured routes
- \`mysql_router_route_health\` - Check route health

## Routing Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| first-available | Routes to first healthy server | Primary writes |
| round-robin | Distributes across all servers | Read scaling |
| round-robin-with-fallback | Round-robin with fallback | HA reads |

## Common Issues

1. **Connection refused**: Check Router is running and ports are open
2. **SSL errors**: Use MYSQL_ROUTER_INSECURE=true for self-signed certs
3. **No destinations**: Verify backend servers are healthy

Start by checking if MySQL Router is installed and running.`);
    },
  };
}
