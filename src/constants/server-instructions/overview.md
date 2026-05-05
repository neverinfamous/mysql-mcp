# mysql-mcp — Quick Reference

**Tool prefix**: `mysql_` (e.g., `mysql_read_query`, `mysql_json_extract`)
**Resource URI scheme**: `mysql://` (e.g., `mysql://schema`, `mysql://tables`)

## Structured Errors

All tools return `{success: false, error, code, category, suggestion, recoverable}` — never raw MCP exceptions.
Table-querying tools return `{exists: false, table}` for nonexistent tables (P154 pattern).

## Architecture

`mysql-mcp` utilizes a highly modular architecture spanning 230+ tools across 23 distinct groups (including specialized `introspection` and `migration` tools). The schema definitions are decentralized within the `src/adapters/mysql/schemas/` directory, ensuring strict type-safety and optimal build times.
