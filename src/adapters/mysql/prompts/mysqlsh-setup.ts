/**
 * MySQL Prompt - MySQL Shell Setup
 *
 * MySQL Shell installation and usage guide.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupMysqlshPrompt(): PromptDefinition {
  return {
    name: "mysql_setup_shell",
    description: "MySQL Shell setup and usage guide",
    arguments: [],
    handler: (_args: Record<string, string>, _context: RequestContext) => {
      return Promise.resolve(`# MySQL Shell Setup Guide

MySQL Shell is an advanced client with JavaScript, Python, and SQL modes, plus powerful dump/load utilities.

## Step 1: Verify Installation

Use \`mysqlsh_version\` tool to check if MySQL Shell is installed:
- Requires MySQL Shell 8.0+
- Should be in PATH or configured via MYSQLSH_PATH

## Step 2: Configure Environment

Set environment variables for MCP server:
\`\`\`bash
# Path to mysqlsh binary (if not in PATH)
MYSQLSH_PATH=/usr/bin/mysqlsh

# Working directory for dump/load operations
MYSQLSH_WORK_DIR=/tmp/mysql-dumps

# Timeout for shell commands (ms, default: 300000 = 5 min)
MYSQLSH_TIMEOUT=300000
\`\`\`

## Step 3: Basic MySQL Shell Usage

### SQL Mode
\`\`\`bash
mysqlsh --sql mysql://user:pass@localhost/dbname
\`\`\`

### JavaScript Mode
\`\`\`bash
mysqlsh --js mysql://user:pass@localhost
\\js session.runSql("SELECT 1")
\`\`\`

### Python Mode
\`\`\`bash
mysqlsh --py mysql://user:pass@localhost
\\py session.run_sql("SELECT 1")
\`\`\`

## Step 4: Available MCP Tools

### Version and Upgrade Check
- \`mysqlsh_version\` - Check Shell version
- \`mysqlsh_check_upgrade\` - Check MySQL server upgrade compatibility

### Data Export
- \`mysqlsh_export_table\` - Export table to CSV/TSV
- \`mysqlsh_dump_instance\` - Dump entire instance (parallel, fast)
- \`mysqlsh_dump_schemas\` - Dump specific schemas
- \`mysqlsh_dump_tables\` - Dump specific tables

### Data Import
- \`mysqlsh_import_table\` - Parallel table import
- \`mysqlsh_import_json\` - Import JSON documents
- \`mysqlsh_load_dump\` - Load MySQL Shell dump

### Scripting
- \`mysqlsh_run_script\` - Execute JS/Python/SQL script

## Step 5: Common Workflows

### Fast Instance Backup
\`\`\`
Use mysqlsh_dump_instance tool:
- 10-20x faster than mysqldump
- Parallel execution
- Consistent snapshot
\`\`\`

### Large Table Import
\`\`\`
Use mysqlsh_import_table tool:
- Parallel chunk loading
- Automatic transaction management
- Progress reporting
\`\`\`

### Schema Migration
\`\`\`
1. Check upgrade compatibility: mysqlsh_check_upgrade
2. Dump source: mysqlsh_dump_instance
3. Load to target: mysqlsh_load_dump
\`\`\`

## Step 6: Best Practices

1. **Use dump utilities for large databases** - Much faster than mysqldump
2. **Set appropriate work directory** - Ensure enough disk space
3. **Adjust timeout for large operations** - Dumps may take hours
4. **Use compression** - Reduces storage and transfer time

## Troubleshooting

- **mysqlsh not found**: Set MYSQLSH_PATH
- **Permission denied**: Check work directory permissions
- **Timeout**: Increase MYSQLSH_TIMEOUT for large operations
- **Connection errors**: Verify MySQL connection string

Start by running \`mysqlsh_version\` to verify installation.`);
    },
  };
}
