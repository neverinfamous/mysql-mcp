# Optimization Tools (`mysql_index_recommendation`, `mysql_query_rewrite`, etc.)

- **Index recommendations**: `mysql_index_recommendation` analyzes table structure and suggests missing indexes. Returns `{ exists: false, table }` when the table does not exist.
- **Query optimization**: `mysql_query_rewrite` analyzes queries for common anti-patterns (SELECT *, missing LIMIT, OR conditions, leading wildcards) and includes EXPLAIN output. Returns `explainPlan: null` with `explainError` when EXPLAIN fails (e.g., nonexistent table).
- **Force index**: `mysql_force_index` generates a query with `FORCE INDEX` hint for testing index behavior. Returns `{ exists: false, table }` when the table does not exist. Validates index existence and returns a `warning` if the index is not found on the table.
- **Optimizer trace**: `mysql_optimizer_trace` returns detailed MySQL optimizer decisions. Use `summary: true` for compact output with only key decisions (recommended for most cases). Returns `{ query, trace: null, error }` (or `{ query, decisions: [], error }` in summary mode) when the query fails (e.g., nonexistent table, syntax error).
