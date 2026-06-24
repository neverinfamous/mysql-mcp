# Optimization Tools (`mysql_index_recommendation`, `mysql_query_rewrite`, etc.)

**Encapsulated Tools**: `mysql_index_recommendation`, `mysql_query_rewrite`, `mysql_force_index`, `mysql_optimizer_trace`

### Index Recommendations (`mysql_index_recommendation`)
- Provides comprehensive index auditing.
- Pass `queries` to run EXPLAIN-based analysis for composite indexes.
  ```json
  { "queries": ["SELECT * FROM users WHERE status = 'active'"] }
  ```
- Scans for redundant/duplicate indexes, missing FK indexes, and unindexed large tables by default.
- Use `table` parameter to focus on one table, omit for database-wide audit.
- Returns `{ findings: [...], summary: { redundant, missingFk, ... } }`.

### Query Rewriting (`mysql_query_rewrite`)
- Analyzes queries for anti-patterns (e.g., `SELECT *`, missing `LIMIT`, `OR` conditions, leading wildcards).
- Includes EXPLAIN output and rewritten suggestions.
- Returns standard structured error for EXPLAIN failures.

### Force Index & Tracing (`mysql_force_index`, `mysql_optimizer_trace`)
- **Force Index**: Generates queries with `FORCE INDEX` hint to test optimizer behavior. Validates table/index existence, returns structured errors if not found.
- **Optimizer Trace**: Returns detailed MySQL optimizer decisions.
  - Set `summary: true` for compact output (recommended) containing key decisions rather than raw trace output.
  - Standard errors for nonexistent tables or syntax errors.
