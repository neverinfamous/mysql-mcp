# mysql-mcp Code Mode Re-Testing: [cross-group]

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

## Group Focus: cross-group

This prompt tests Code Mode integration across multiple tool groups within a single `mysql_execute_code` script.

> **Instructions**: Build a single `mysql_execute_code` script that exercises the workflows below, pushing deviations to a `failures` array.

### Workflow 1: Discovery

1. `mysql.help()` → verify top-level namespace listing includes `core`, `json`, `stats`, `admin`, etc.
2. `mysql.core.help()` → verify core method names
3. `mysql.json.help()` → verify json method names
4. `mysql.stats.help()` → verify stats method names

### Workflow 2: Core → JSON → Stats Pipeline

5. `mysql.core.readQuery({query: "SELECT COUNT(*) AS n FROM test_json_docs"})` → 8 rows
6. `mysql.json.extract({table: "test_json_docs", column: "doc", path: "$.views"})` → numeric values
7. `mysql.stats.descriptive({table: "test_measurements", column: "temperature"})` → stats

### Workflow 3: Admin → Performance Health Check

8. `mysql.admin.analyzeTable({table: "test_products"})` → `success: true`
9. `mysql.performance.tableStats({table: "test_products"})` → row count, data size
10. `mysql.monitoring.serverHealth()` → health status

### Workflow 4: Schema → Core Lifecycle

11. Create temp table via `mysql.core.createTable({table: "temp_cm_cross", columns: [{name: "id", type: "INT", primaryKey: true}, {name: "data", type: "JSON"}]})`
12. Insert via `mysql.core.writeQuery({query: "INSERT INTO temp_cm_cross (id, data) VALUES (1, '{\"test\": true}')"})`
13. Validate via `mysql.json.extract({table: "temp_cm_cross", column: "data", path: "$.test", where: "id = 1"})` → true
14. Cleanup via `mysql.core.dropTable({table: "temp_cm_cross"})`

### Workflow 5: Error Path Cross-Group

15. 🔴 `mysql.core.readQuery({query: "SELECT * FROM nonexistent_xyz"})` → structured error
16. 🔴 `mysql.json.extract({table: "nonexistent_xyz", column: "doc", path: "$.x"})` → structured error
17. 🔴 `mysql.stats.descriptive({table: "nonexistent_xyz", column: "x"})` → structured error
