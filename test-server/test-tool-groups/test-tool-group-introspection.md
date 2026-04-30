# mysql-mcp Tool Group Testing: [introspection]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Do not put temp files in root; Use C:\Users\chris\Desktop\mysql-mcp\tmp

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Test Database Schema

| Table | Rows | Key Columns | JSON Columns |
|-------|------|-------------|--------------|
| `test_products` | 16 | id, name, price, category | metadata |
| `test_orders` | 20 | id, product_id (FK), customer_name, status (ENUM) | notes |

## Testing Requirements

1. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
3. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- Prefix temp tables with `temp_*`, drop after testing.
- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: introspection

### introspection Group-Specific Testing

introspection Tool Group (6 tools +1 for code mode):

1. 'mysql_dependency_graph'
2. 'mysql_topological_sort'
3. 'mysql_cascade_simulator'
4. 'mysql_schema_snapshot'
5. 'mysql_constraint_analysis'
6. 'mysql_migration_risks'
7. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_dependency_graph({schema: "test_db", maxDepth: 2})` → verify graph nodes and edges
2. `mysql_topological_sort({schema: "test_db"})` → verify ordered tables
3. `mysql_cascade_simulator({table: "test_products", operation: "DELETE"})` → verify cascading constraints output
4. `mysql_schema_snapshot({schema: "test_db"})` → verify schema snapshot state
5. `mysql_constraint_analysis({schema: "test_db"})` → verify constraint analysis
6. `mysql_migration_risks({ddlQuery: "ALTER TABLE test_products ADD COLUMN new_col INT"})` → verify migration risks reported

**Domain error paths (🔴):**

7. 🔴 `mysql_dependency_graph({schema: "nonexistent_schema"})` → `{success: false, error: "..."}` handler error
8. 🔴 `mysql_cascade_simulator({table: "nonexistent_xyz", operation: "DELETE"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

9. 🔴 `mysql_dependency_graph({})` → `{success: false, error: "..."}` (Zod validation)
10. 🔴 `mysql_migration_risks({})` → `{success: false, error: "..."}` (Zod validation)
