/**
 * MySQL Prompt - ProxySQL Setup
 *
 * Complete ProxySQL configuration guide.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupProxysqlPrompt(): PromptDefinition {
  return {
    name: "mysql_setup_proxysql",
    description: "Complete ProxySQL setup and configuration guide",
    arguments: [],
    handler: (_args: Record<string, string>, _context: RequestContext) => {
      return Promise.resolve(`# ProxySQL Setup Guide

ProxySQL is a high-performance MySQL proxy supporting connection pooling, query routing, and caching.

## Prerequisites

1. **ProxySQL installed** (v2.x recommended)
2. **MySQL backend servers** accessible
3. **Admin access** to ProxySQL (default: admin:admin on port 6032)

## Step 1: Connect to ProxySQL Admin

\`\`\`bash
mysql -h 127.0.0.1 -P 6032 -u admin -padmin
\`\`\`

## Step 2: Configure Backend Servers

\`\`\`sql
-- Add primary server (hostgroup 0 = writers)
INSERT INTO mysql_servers (hostgroup_id, hostname, port, weight)
VALUES (0, 'primary-host', 3306, 1000);

-- Add replica servers (hostgroup 1 = readers)
INSERT INTO mysql_servers (hostgroup_id, hostname, port, weight)
VALUES (1, 'replica1-host', 3306, 500),
       (1, 'replica2-host', 3306, 500);

-- Load and save configuration
LOAD MYSQL SERVERS TO RUNTIME;
SAVE MYSQL SERVERS TO DISK;
\`\`\`

## Step 3: Configure Users

\`\`\`sql
-- Add MySQL users that will connect through ProxySQL
INSERT INTO mysql_users (username, password, default_hostgroup)
VALUES ('app_user', 'password', 0);

LOAD MYSQL USERS TO RUNTIME;
SAVE MYSQL USERS TO DISK;
\`\`\`

## Step 4: Configure Query Rules

\`\`\`sql
-- Route SELECT queries to readers (hostgroup 1)
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup)
VALUES (1, 1, '^SELECT.*FOR UPDATE', 0),      -- SELECT FOR UPDATE to writers
       (2, 1, '^SELECT', 1);                   -- Other SELECTs to readers

LOAD MYSQL QUERY RULES TO RUNTIME;
SAVE MYSQL QUERY RULES TO DISK;
\`\`\`

## Step 5: Configure MCP Server

Set environment variables:
\`\`\`bash
PROXYSQL_HOST=localhost
PROXYSQL_PORT=6032
PROXYSQL_USER=admin
PROXYSQL_PASSWORD=admin
\`\`\`

## Step 6: Verify with MCP Tools

Use ProxySQL tools to verify:
- \`proxysql_status\` - Check ProxySQL is running
- \`proxysql_servers\` - List configured servers
- \`proxysql_connection_pool\` - View connection pool stats (filterable by hostgroup_id)
- \`proxysql_query_rules\` - Review routing rules
- \`proxysql_query_digest\` - Analyze query patterns

## Connection Pooling

ProxySQL provides connection multiplexing:
\`\`\`sql
-- Configure max connections per hostgroup
UPDATE mysql_servers SET max_connections = 100;
LOAD MYSQL SERVERS TO RUNTIME;
\`\`\`

## Monitoring Queries

Use \`proxysql_query_digest\` to find:
- Slow queries
- Most frequent queries
- Queries for caching candidates

## Best Practices

1. **Connection pooling**: Set max_connections appropriately
2. **Query caching**: Cache read-heavy, stable queries
3. **Health checks**: Configure proper health check intervals
4. **Monitor**: Watch query digest for performance issues

Start by checking ProxySQL connection with \`proxysql_status\`.`);
    },
  };
}
