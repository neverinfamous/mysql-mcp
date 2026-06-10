# Critical Gotchas & Always-Available Reference

## Server Identity

- **Server Name**: This server is identified as `user-mysql` in MCP client configurations.
- **Tool Invocation**: When calling tools via MCP, they are prefixed with the server name (e.g., `user-mysql-mysql_json_extract`, `user-mysql-mysql_read_query`).
- **Resources**:
  - Resources use the `mysql://` URI scheme (e.g., `mysql://capabilities`, `mysql://schema`).
  - When listing or fetching resources, use server name `user-mysql` (e.g., `list_mcp_resources(server: "user-mysql")`, `fetch_mcp_resource(server: "user-mysql", uri: "mysql://schema")`).

## Parameter Aliases

Many tools accept **alternative parameter names** (aliases) for commonly used fields. The server normalizes these automatically—use whichever feels most natural:

- **Table name**: `table`, `tableName`, or `name` — accepted by Core tools (`mysql_describe_table`, `mysql_get_indexes`, `mysql_drop_table`, `mysql_create_index`), Text tools (`mysql_like_search`, `mysql_regexp_match`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert`), Backup tools (`mysql_export_table`, `mysql_import_data`), Partitioning tools (`mysql_partition_info`, `mysql_add_partition`, `mysql_drop_partition`, `mysql_reorganize_partition`), Performance tools (`mysql_table_stats`, `mysql_index_usage`), Optimization tools (`mysql_index_recommendation`, `mysql_force_index`), and Admin tools (`mysql_optimize_table`, `mysql_analyze_table`, `mysql_check_table`, `mysql_flush_tables`).
- **Query/SQL**: `query` or `sql` — accepted by `mysql_read_query`, `mysql_write_query`, `mysql_explain`, `mysql_explain_analyze`, `mysql_query_rewrite`, and `mysql_optimizer_trace`. Also `queries` (array) accepted by `mysql_index_recommendation`.
- **WHERE clause**: `where` or `filter` — accepted by `mysql_export_table` and Text tools (`mysql_like_search`, `mysql_regexp_match`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert`).
- **Column name**: `column` or `col` — accepted by Text tools (`mysql_like_search`, `mysql_regexp_match`, `mysql_soundex`, `mysql_substring`, `mysql_collation_convert`).
- **Admin tables array**: Admin maintenance tools accept a singular `table` (or `tableName`/`name`) as an alias for the `tables` array parameter, automatically wrapping it in an array.

## Pagination & Limits

- **Default LIMIT 50**: `mysql_read_query` injects a default `LIMIT 50` on queries without an explicit `LIMIT` clause. Use `cursor`/`nextCursor` to page through results. Add your own `LIMIT` clause to override this default.

## Typed Error Codes

All errors carry a `code` field for programmatic handling:

| Code | Category | Recoverable | When |
|---|---|---|---|
| `TIMEOUT_ERROR` | connection | ✅ | Query or connection exceeded time limit |
| `RATE_LIMIT_ERROR` | connection | ✅ | Too many requests — wait and retry |
| `CONFLICT_ERROR` | query | ✅ | Optimistic concurrency version mismatch |
| `EXTENSION_MISSING` | config | ❌ | Required MySQL plugin/extension not loaded |

Recoverable errors can be retried. Check `recoverable: true` in the response.

## Code Mode (`mysql_execute_code`)

- **Purpose**: Execute JavaScript/TypeScript code in a sandboxed VM with access to all MySQL tools via the `mysql.*` API namespace. Ideal for multi-step workflows, data aggregation, conditional logic, and complex orchestrations that would otherwise require many sequential tool calls.
- **When to use**: Prefer Code Mode when a task requires 3+ sequential tool calls, conditional branching based on query results, data transformation between steps, or aggregation across multiple tables.
- **API namespace**: The `mysql` object exposes 26 groups matching the tool groups: `mysql.core`, `mysql.json`, `mysql.transactions`, `mysql.text`, `mysql.fulltext`, `mysql.performance`, `mysql.optimization`, `mysql.admin`, `mysql.monitoring`, `mysql.backup`, `mysql.replication`, `mysql.partitioning`, `mysql.schema`, `mysql.introspection`, `mysql.migration`, `mysql.shell`, `mysql.events`, `mysql.sysschema`, `mysql.stats`, `mysql.spatial`, `mysql.security`, `mysql.roles`, `mysql.docstore`, `mysql.cluster`, `mysql.proxysql`, `mysql.router`.
- **Method naming**: Tool names map to methods by stripping the prefix: `mysql_read_query` → `mysql.core.readQuery(sql)`, `mysql_json_extract` → `mysql.json.extract({...})`, `mysqlsh_version` → `mysql.shell.version()`.
- **Positional shorthand**: Common tools accept positional arguments: `mysql.core.readQuery("SELECT 1")` instead of `mysql.core.readQuery({ query: "SELECT 1" })`.
- **Help**: Call `mysql.help()` for a full API overview, or `mysql.<group>.help()` for group-specific methods and examples.
- **Return value**: The last expression in the code block is returned as the result. Use `return` in async functions or let the final expression evaluate.
- **Security**: Code runs in an isolated VM sandbox. Blocked patterns include `require`, `import`, `process`, `eval`, `Function`, filesystem/network access. Rate-limited to prevent abuse.
- **Transaction cleanup**: Any transactions opened but not committed are automatically rolled back when execution completes.
- **Scope**: Requires `admin` scope.
