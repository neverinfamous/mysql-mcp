/**
 * MySQL Prompt - Event Scheduler Setup
 *
 * Complete Event Scheduler configuration guide.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupEventsPrompt(): PromptDefinition {
  return {
    name: "mysql_setup_events",
    description: "Complete MySQL Event Scheduler setup and configuration guide",
    arguments: [],
    handler: (_args: Record<string, string>, _context: RequestContext) => {
      return Promise.resolve(`# MySQL Event Scheduler Setup Guide

MySQL Event Scheduler allows you to schedule SQL statements to run at specific times or intervals.

## Prerequisites

1. **MySQL 5.1+** (Event Scheduler available)
2. **EVENT privilege** for creating events
3. **Event Scheduler enabled** globally

## Step 1: Enable Event Scheduler

Check current status:
\`\`\`sql
SHOW VARIABLES LIKE 'event_scheduler';
\`\`\`

Enable permanently in my.cnf:
\`\`\`ini
[mysqld]
event_scheduler = ON
\`\`\`

Enable at runtime:
\`\`\`sql
SET GLOBAL event_scheduler = ON;
\`\`\`

## Step 2: Create a One-Time Event

\`\`\`sql
CREATE EVENT cleanup_old_logs
ON SCHEDULE AT CURRENT_TIMESTAMP + INTERVAL 1 HOUR
DO
    DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
\`\`\`

## Step 3: Create a Recurring Event

\`\`\`sql
CREATE EVENT daily_stats_rollup
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
    INSERT INTO daily_stats (date, total_orders, revenue)
    SELECT DATE(created_at), COUNT(*), SUM(amount)
    FROM orders
    WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    GROUP BY DATE(created_at);
\`\`\`

## Step 4: Event with Expiration

\`\`\`sql
CREATE EVENT temp_promotion
ON SCHEDULE EVERY 1 HOUR
STARTS '2024-01-01 00:00:00'
ENDS '2024-01-31 23:59:59'
DO
    UPDATE products SET discount = 0.10 WHERE category = 'promo';
\`\`\`

## Available MCP Tools

| Tool | Description |
|------|-------------|
| \`mysql_event_create\` | Create scheduled event |
| \`mysql_event_alter\` | Modify existing event |
| \`mysql_event_drop\` | Remove event |
| \`mysql_event_list\` | List all events |
| \`mysql_event_status\` | Event execution history |
| \`mysql_scheduler_status\` | Scheduler global status |

## Best Practices

1. **Use DISABLE ON SLAVE** in replication environments
2. **Set appropriate DEFINER** for security
3. **Monitor event execution** with performance_schema
4. **Handle errors gracefully** - events don't report errors visibly

## Common Issues

1. **Events not running**: Check event_scheduler is ON
2. **Permission denied**: Grant EVENT privilege
3. **Event disappeared**: Check ON COMPLETION PRESERVE setting

Start by checking the scheduler status with \`mysql_scheduler_status\`.`);
    },
  };
}
