# mysql-mcp Code Mode Re-Testing: [introspection]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

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
