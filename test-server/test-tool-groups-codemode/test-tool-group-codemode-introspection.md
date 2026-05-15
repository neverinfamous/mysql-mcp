# mysql-mcp Code Mode Re-Testing: [introspection]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

## Test Database Schema

| Table               | Rows | Key Columns                                       | JSON Columns        |
| ------------------- | ---- | ------------------------------------------------- | ------------------- |
| `test_products`     | 16   | id, name, price, category                         | metadata            |
| `test_orders`       | 20   | id, product_id (FK), customer_name, status (ENUM) | notes               |
| `test_json_docs`    | 8    | id, doc, metadata, tags                           | doc, metadata, tags |
| `test_articles`     | 10   | id, title, body, author (FULLTEXT)                | —                   |
| `test_users`        | 10   | id, username, email, phone, bio, role             | —                   |
| `test_measurements` | 200  | id, sensor_id (INT 1-5), temperature, humidity    | —                   |
| `test_locations`    | 15   | id, name, city, latitude, longitude, geom (POINT) | —                   |
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date  | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)             | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                            | data                |
| `test_categories`   | 17   | id, name, path, level                             | —                   |

## Testing Requirements

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Clean up any `temp_*` tables after testing
4. Report all failures, unexpected behaviors, or unnecessarily large payloads
5. **Scripting Efficiency**: Bundle multiple tool checks into a single `mysql_execute_code` call. Use conditional checks to aggregate errors and return a `failures` array.
6. **Pacing**: Test up to an entire tool group in a single script if feasible, but limit scripts to ~10-15 steps to remain manageable.

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type                 | What you see                                     | Verdict            |
| -------------------- | ------------------------------------------------ | ------------------ |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct            |
| **MCP error** ❌     | Raw error string, no `success` field             | Bug — report as ❌ |

During error path testing, if an invalid Code Mode call returns a raw error string instead of a JSON object with `success` and `error` fields, report it as ❌.

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_`
- Your script should drop all `temp_*` objects at the end.

## Post-Test Procedures

1. **Cleanup**: Confirm all `temp_*` tables removed.
2. **Fix EVERY finding** — ❌ Fails, ⚠️ Issues, 📦 Payload.
3. **Read `../code-map.md` before making changes.**
4. Update the changelog if changes were made, commit without pushing.
5. Briefly summarize results with total token count prominently displayed.

---

## Group Focus: introspection

introspection Tool Group (6 tools +1 code mode):

1. `mysql_dependency_graph` 2. `mysql_topological_sort` 3. `mysql_cascade_simulator`
2. `mysql_schema_snapshot` 5. `mysql_constraint_analysis` 6. `mysql_migration_risks`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.introspection.help()` → verify method listing
2. `mysql.introspection.dependencyGraph({schema: "test_db", maxDepth: 2})` → return graph nodes and edges
3. `mysql.introspection.topologicalSort({schema: "test_db"})` → return ordered tables
4. `mysql.introspection.cascadeSimulator({table: "test_products", operation: "DELETE"})` → simulate constraints
5. `mysql.introspection.schemaSnapshot({schema: "test_db"})` → schema snapshot
6. `mysql.introspection.constraintAnalysis({schema: "test_db"})` → analyze constraints
7. `mysql.introspection.migrationRisks({ddlQuery: "ALTER TABLE test_products ADD COLUMN new_col INT"})` → report risks

**Domain error paths (🔴):**

8. 🔴 `mysql.introspection.dependencyGraph({schema: "nonexistent_schema"})` → `{success: false}`
9. 🔴 `mysql.introspection.cascadeSimulator({table: "nonexistent_table", operation: "DELETE"})` → `{success: false}`

**Zod validation error paths (🔴):**

10. 🔴 `mysql.introspection.dependencyGraph({})` → `{success: false, error: "Validation error: ..."}`
11. 🔴 `mysql.introspection.migrationRisks({})` → `{success: false, error: "Validation error: ..."}`
