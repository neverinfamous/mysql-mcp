# mysql-mcp — Quick Reference

**Tool prefix**: `mysql_` (e.g., `mysql_read_query`, `mysql_json_extract`)
**Resource URI scheme**: `mysql://` (e.g., `mysql://schema`, `mysql://tables`)

## Help Resources

Read `mysql://help` for critical gotchas, parameter aliases, and Code Mode API reference.
Read `mysql://help/{group}` for group-specific tool reference (e.g., `mysql://help/json`, `mysql://help/stats`).

## Structured Errors

All tools return `{success: false, error, code, category, suggestion, recoverable}` — never raw MCP exceptions.
Table-querying tools return `{exists: false, table}` for nonexistent tables (P154 pattern).
