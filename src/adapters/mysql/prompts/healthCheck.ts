/**
 * MySQL Prompt - Database Health Check
 *
 * Guides user through comprehensive database health assessment.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createDatabaseHealthCheckPrompt(): PromptDefinition {
  return {
    name: "mysql_database_health_check",
    description: "Comprehensive database health assessment workflow",
    arguments: [
      {
        name: "focus",
        description:
          "Optional focus area: connections, performance, replication, storage",
        required: false,
      },
    ],
    handler: (args: Record<string, string>, _context: RequestContext) => {
      const focus = args["focus"] ?? "all";

      return Promise.resolve(`# MySQL Database Health Check

Perform a comprehensive health assessment for this MySQL database.
${focus !== "all" ? `**Focus area:** ${focus}` : ""}

## Step 1: Check Connection Health
Use \`mysql://health\` resource or \`mysql_pool_stats\` tool to verify:
- Connection pool utilization (should be < 80%)
- No connection errors or timeouts
- Thread activity within normal range

## Step 2: Assess Performance
Use \`mysql://performance\` resource or performance tools:
- Buffer pool hit ratio (should be > 99%)
- Slow query count and trends
- Table scan vs index usage ratio
- Temporary tables to disk ratio (should be < 10%)

## Step 3: Check Storage and Tables
- Table fragmentation (use \`mysql_check_table\`)
- Index health and unused indexes (\`mysql://indexes\`)
- InnoDB status (\`mysql://innodb\`)

## Step 4: Replication Status (if applicable)
Use \`mysql://replication\` resource:
- Replication lag (should be < 1 second typically)
- IO and SQL thread status
- Binary log position

## Step 5: Generate Recommendations
Based on findings, provide:
1. Critical issues requiring immediate attention
2. Performance optimization opportunities
3. Maintenance tasks to schedule

Please proceed with the health check and report findings.`);
    },
  };
}
