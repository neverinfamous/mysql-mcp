# mysql-mcp Code Mode Re-Testing: [schema]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting Format

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Test Database Schema

| Table | Rows | Key Columns |
|-------|------|-------------|
| `test_products` | 16 | id, name, price, category |
| `test_orders` | 20 | id, product_id (FK), customer_name, status |

## Testing Requirements

1. **Code Mode Strict Coverage Matrix**: Track in `tmp/task.md`. Log Happy Path + Domain Error for EVERY tool.
2. **Scripting Efficiency**: Bundle checks into a single `mysql_execute_code` call with `failures` array.
3. **Deterministic checklist first**: Complete ALL items below before freeform exploration.
4. Handler errors must return `{success: false, error: "..."}` — NOT raw MCP errors.

## Post-Test: Fix findings, read `code-map.md`, update changelog, commit without pushing.

---

## Group Focus: schema

schema Tool Group (10 tools +1 code mode):

1. `mysql_list_schemas` 2. `mysql_create_schema` 3. `mysql_drop_schema` 4. `mysql_list_views`
5. `mysql_create_view` 6. `mysql_list_stored_procedures` 7. `mysql_list_functions`
8. `mysql_list_triggers` 9. `mysql_list_constraints` 10. `mysql_list_events`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.schema.help()` → verify method listing
2. `mysql.schema.listSchemas()` → verify `testdb` present
3. `mysql.schema.listViews({database: "testdb"})` → verify structure
4. `mysql.schema.listConstraints({table: "test_orders"})` → verify FK present
5. `mysql.schema.listTriggers({database: "testdb"})` → verify structure
6. `mysql.schema.listStoredProcedures({database: "testdb"})` → verify structure
7. `mysql.schema.listFunctions({database: "testdb"})` → verify structure
8. `mysql.schema.listEvents({database: "testdb"})` → verify structure

**Create → Drop lifecycle:**

9. `mysql.schema.createView({name: "temp_cm_view", query: "SELECT id, name FROM test_products"})` → `success: true`
10. `mysql.schema.listViews({database: "testdb"})` → verify `temp_cm_view` present
11. Drop via `mysql.core.writeQuery({query: "DROP VIEW IF EXISTS temp_cm_view"})`

**Domain error paths (🔴):**

12. 🔴 `mysql.schema.listConstraints({table: "nonexistent_xyz"})` → `{success: false}` or empty
13. 🔴 `mysql.schema.dropSchema({name: "nonexistent_db_xyz"})` → `{success: false, error: "..."}`

**Zod validation error paths (🔴):**

14. 🔴 `mysql.schema.createView({})` → `{success: false, error: "Validation error: ..."}`
15. 🔴 `mysql.schema.createSchema({})` → `{success: false, error: "Validation error: ..."}`
