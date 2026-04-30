# mysql-mcp Code Mode Re-Testing: [introspection]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Requirements

1. ✅ Execute all 11 Code Mode tests successfully.
2. ✅ Validate structured `success` handling and Zod errors.

## Results: 11/11 Passed

- `failures` array returned empty (`[]`).
- Token estimates maintained within efficient bounds (`80` max meta tokens).
- Zod schema validation regressions and domain error handling successfully validated.

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
