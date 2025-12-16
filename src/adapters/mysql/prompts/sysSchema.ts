/**
 * MySQL Prompt - sys Schema Guide
 * 
 * Complete sys schema usage guide for diagnostics.
 */
import type { PromptDefinition, RequestContext } from '../../../types/index.js';

export function createSysSchemaGuidePrompt(): PromptDefinition {
    return {
        name: 'mysql_sys_schema_guide',
        description: 'Complete MySQL sys schema usage guide for diagnostics and troubleshooting',
        arguments: [],
        handler: (_args: Record<string, string>, _context: RequestContext) => {
            return Promise.resolve(`# MySQL sys Schema Guide

The sys schema provides human-readable views built on Performance Schema data for database diagnostics.

## Prerequisites

1. **MySQL 5.7+** (sys schema included by default)
2. **Performance Schema enabled** (default ON in 5.7+)
3. **SELECT privilege** on sys schema

## Key Views for Diagnostics

### User Activity
\`\`\`sql
-- Who is consuming resources?
SELECT * FROM sys.user_summary;
SELECT * FROM sys.user_summary_by_file_io;
SELECT * FROM sys.user_summary_by_statement_type;
\`\`\`

### Statement Analysis
\`\`\`sql
-- Find slow queries
SELECT * FROM sys.statements_with_runtimes_in_95th_percentile;

-- Full table scans
SELECT * FROM sys.statements_with_full_table_scans;

-- Temporary tables
SELECT * FROM sys.statements_with_temp_tables;
\`\`\`

### I/O Analysis
\`\`\`sql
-- Hot tables by I/O
SELECT * FROM sys.io_global_by_file_by_bytes;

-- Wait analysis
SELECT * FROM sys.wait_classes_global_by_avg_latency;
\`\`\`

### Lock Analysis
\`\`\`sql
-- Current lock waits
SELECT * FROM sys.innodb_lock_waits;

-- Blocked transactions
SELECT * FROM sys.schema_table_lock_waits;
\`\`\`

### Memory Analysis
\`\`\`sql
-- Memory by user
SELECT * FROM sys.memory_by_user_by_current_bytes;

-- Memory by thread
SELECT * FROM sys.memory_by_thread_by_current_bytes;
\`\`\`

## Available MCP Tools

| Tool | Description |
|------|-------------|
| \`mysql_sys_user_summary\` | User activity summary |
| \`mysql_sys_io_summary\` | I/O by file/table |
| \`mysql_sys_statement_summary\` | Statement statistics |
| \`mysql_sys_wait_summary\` | Wait event analysis |
| \`mysql_sys_innodb_lock_waits\` | Lock contention |
| \`mysql_sys_schema_stats\` | Schema object stats |
| \`mysql_sys_host_summary\` | Host connection summary |
| \`mysql_sys_memory_summary\` | Memory usage |

## Useful Procedures

\`\`\`sql
-- Reset statement stats
CALL sys.ps_truncate_all_tables(FALSE);

-- Kill a connection
CALL sys.kill_connection(thread_id);

-- Get statement digest
SELECT sys.format_statement('SELECT * FROM users WHERE id = 1');
\`\`\`

## Best Practices

1. **Don't query in production peaks** - sys views can be heavy
2. **Use x$ views for exact values** (no formatting)
3. **Reset stats after schema changes**
4. **Monitor performance_schema memory**

Start by checking overall user activity with \`mysql_sys_user_summary\`.`);
        }
    };
}
