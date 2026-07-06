# Core Tools (`mysql_read_query`, `mysql_write_query`, `mysql_create_table`, etc.)

**Encapsulated Tools**: `mysql_read_query`, `mysql_write_query`, `mysql_list_tables`, `mysql_describe_table`, `mysql_create_table`, `mysql_drop_table`, `mysql_create_index`, `mysql_get_indexes`, `mysql_enable_versioning`, `mysql_disable_versioning`, `mysql_check_version`, `mysql_conditional_update`

### Query Execution (`mysql_read_query`, `mysql_write_query`)
- **Prepared statements**: `mysql_read_query` and `mysql_write_query` support parameterized queries via the `params` array.
  ```json
  { "query": "SELECT * FROM users WHERE id = ?", "params": [123] }
  ```
- **Streaming & Pagination**: `mysql_read_query` applies default `LIMIT 50` for SELECT/WITH unless `LIMIT` is provided. Use `cursor` for pagination. Use `stream: true` + `chunkSize` for incremental MCP progress notifications.
- **DDL & Errors**: DDL (e.g., `CREATE TABLE`) automatically falls back to text protocol in `mysql_write_query`. Returns `{ success: false, error }` instead of throwing raw errors on query failures.

### Schema Management (`mysql_create_table`, `mysql_drop_table`, `mysql_describe_table`, `mysql_list_tables`)
- **Boolean Defaults**: `mysql_create_table` auto-converts `default: true` to `1` and `default: false` to `0`.
- **Create/Drop Safety**: Returns `{ success: false, error }` on exists/missing unless using `ifNotExists: true` or `ifExists: true` respectively, which return `{ success: true, skipped: true, reason: "..." }`.
- **Existence Checks**: Standard `{ success: false, error: "..." }` returned if target tables/databases don't exist.

### Index Management (`mysql_create_index`, `mysql_get_indexes`)
- **Index creation**: `mysql_create_index` supports BTREE (default), HASH, FULLTEXT, and SPATIAL types.
  - *Note*: InnoDB HASH is silently converted to BTREE. HASH only effective with MEMORY engine.
  - Supports `ifNotExists: true` to skip.
- **Cross-Database**: All tools support qualified names (`schema.table`).

### Optimistic Concurrency Control (OCC)
- `mysql_enable_versioning`: Adds a `_version` column and a trigger to a table.
- `mysql_disable_versioning`: Disables versioning by dropping the trigger and column.
- `mysql_check_version`: Checks the current `_version` of a specific row.
- `mysql_conditional_update`: Conditionally updates a row. On conflict, returns `CONFLICT_ERROR` ErrorResponse.
