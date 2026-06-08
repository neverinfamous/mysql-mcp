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

## Subscriptions

The server supports MCP `resources/subscribe` for live updates. Subscribable URIs include:
- `mysql://health`: Polled every 60 seconds for health changes.
- `mysql://schema`, `mysql://tables`, `mysql://table/{name}`: Event-driven notifications on DDL changes.

## Security Sandbox

Tools interacting with the filesystem (like `backup` or `shell` tools) operate within a strict sandbox. All file paths provided as arguments must be absolute and reside within the directories explicitly permitted by the `ALLOWED_IO_ROOTS` server configuration.

## Configuration

The server supports `.yaml` or `.json` configuration files via the `--config <path>` flag. Configuration follows a strict precedence hierarchy:
1. **CLI flags** (highest priority)
2. **Environment variables**
3. **Configuration file**
4. **Defaults** (lowest priority)

You can verify the final merged configuration the server will use by running with the `--dump-config` flag.
