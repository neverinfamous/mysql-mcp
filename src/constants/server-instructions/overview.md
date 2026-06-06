# mysql-mcp (MySQL MCP Server)

## Quick Access

| Purpose         | Action                    |
| --------------- | ------------------------- |
| Database schema | `mysql://schema` resource |
| Server health   | `mysql://capabilities`    |
| Tool help       | `mysql://help` resource   |

## Help Resources

Read `mysql://help` for gotchas and critical usage patterns.
Read `mysql://help/{group}` for group-specific tool reference.
Only help resources for your enabled tool groups are registered.

## Structured Errors

All tools return `{success: false, error, code, category, suggestion, recoverable}` — never raw MCP exceptions.
Table-querying tools return `{exists: false, table}` for nonexistent tables (P154 pattern).
