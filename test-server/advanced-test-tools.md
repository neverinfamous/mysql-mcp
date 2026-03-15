# Advanced Stress Test — mysql-mcp

**Step 1:** Read `C:\Users\chris\Desktop\mysql-mcp\src\constants\ServerInstructions.ts` using `view_file` (not grep or search) to understand documented behaviors, edge cases, and response structures.

**Step 2:** Execute each numbered stress test below using both code mode (mysql_execute_code) and direct tool calls, not scripts/terminal.

## Test Database Schema

Refer to `test-tools.md` § Test Database Schema for the full schema reference. Key tables: `test_products` (16 rows), `test_orders` (20), `test_json_docs` (8), `test_articles` (10), `test_users` (10), `test_measurements` (200), `test_locations` (15), `test_categories` (17), `test_events` (100), `test_documents` (10), `test_partitioned` (26).

## Naming & Cleanup

- **Temporary tables**: Prefix with `stress_` (e.g., `stress_empty_table`)
- **Temporary indexes**: Prefix with `stress_idx_`
- **Temporary views**: Prefix with `stress_view_`
- **Temporary events**: Prefix with `stress_event_`
- Clean up ALL `stress_*` objects after testing

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response for the given input
- ✅ Confirmed: Edge case handled correctly (use only inline during testing; omit from Final Summary)

---

## Category 1: Boundary Values & Empty States

### 1.1 Empty Table Operations

Create `stress_empty_table (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), value DECIMAL(10,2))`, then test:

1. `mysql_read_query({query: "SELECT COUNT(*) AS n FROM stress_empty_table"})` → `{rows: [{n: 0}]}`
2. `mysql_describe_table({table: "stress_empty_table"})` → valid schema with 3 columns
3. `mysql_stats_descriptive({table: "stress_empty_table", column: "value"})` → graceful error or empty stats (not crash)
4. `mysql_export_table({table: "stress_empty_table"})` → `{rowCount: 0}` or empty data
5. `mysql_stats_sampling({table: "stress_empty_table"})` → empty results, not error

### 1.2 Single-Row Table

Insert one row into `stress_empty_table`: `(1, 'solo', 42.00)`, then test:

6. `mysql_stats_descriptive({table: "stress_empty_table", column: "value"})` → valid stats (mean=42, stddev=0 or null)
7. `mysql_stats_percentiles({table: "stress_empty_table", column: "value", percentiles: [25, 50, 75]})` → all should equal 42

### 1.3 NULL-Heavy Data

Insert 5 rows: 3 with `name IS NULL AND value IS NULL`, 2 with actual values:

8. `mysql_read_query({query: "SELECT COUNT(value) AS n FROM stress_empty_table"})` → `{rows: [{n: 3}]}` (COUNT of non-null values)
9. `mysql_stats_descriptive({table: "stress_empty_table", column: "value"})` → should count only non-null values

### 1.4 Extreme Numeric Values

Insert: `(name: 'max', value: 99999999.99)`, `(name: 'min', value: -99999999.99)`:

10. `mysql_stats_descriptive({table: "stress_empty_table", column: "value"})` → verify min, max, avg handle extremes

---

## Category 2: State Pollution & Idempotency

### 2.1 Create-Drop-Recreate Cycles

1. `mysql_create_table` → create `stress_cycle_table (id INT PRIMARY KEY, data TEXT)`
2. `mysql_create_index({table: "stress_cycle_table", columns: ["data"], name: "stress_idx_cycle"})` → success
3. `mysql_drop_table({table: "stress_cycle_table"})` → success
4. `mysql_drop_table({table: "stress_cycle_table", ifExists: true})` → should not error
5. `mysql_create_table` → recreate `stress_cycle_table` → success (no orphaned metadata)

### 2.2 Duplicate Object Detection

6. `mysql_create_table` on `test_products` (already exists) → expect error or "already exists" indication
7. `mysql_create_index` on `idx_orders_status` (already exists) → expect error or "already exists" indication

---

## Category 3: Error Message Quality

For each test, verify a **structured response** (`{success: false, error: "..."}`) — NOT raw MCP exception. Rate each for contextual usefulness.

### 3.1 Cross-Group Nonexistent Objects

1. `mysql_get_indexes({table: "nonexistent_table_xyz"})` → structured error
2. `mysql_stats_descriptive({table: "nonexistent_table_xyz", column: "price"})` → structured error
3. `mysql_fulltext_search({table: "nonexistent_xyz", columns: ["title"], query: "test"})` → structured error

### 3.2 Invalid Columns

4. `mysql_stats_descriptive({table: "test_products", column: "nonexistent_col"})` → structured error mentioning column
5. `mysql_stats_correlation({table: "test_products", column1: "name", column2: "category"})` → error about non-numeric columns

### 3.3 Type Mismatches

6. `mysql_json_extract({table: "test_products", column: "name", path: "$.type"})` → error about non-JSON column
7. `mysql_stats_time_series` with non-datetime column → report behavior

### 3.4 Invalid Parameter Values

8. `mysql_transaction_execute({statements: []})` → report behavior (empty array)
9. `mysql_stats_histogram({table: "test_products", column: "price", buckets: 0})` → error (must be > 0)
10. `mysql_stats_histogram({table: "test_products", column: "price", buckets: -1})` → error

---

## Category 4: Concurrency & Transaction Edge Cases

### 4.1 Aborted Transaction Recovery

1. `mysql_transaction_begin` → get `transactionId`
2. Execute failing SQL within transaction: `mysql_write_query({query: "INSERT INTO nonexistent_table VALUES (1)", transactionId: <id>})`
3. Attempt another write in same transaction → report behavior
4. `mysql_transaction_rollback({transactionId: <id>})` → expect success
5. Start new transaction → verify normal operation

### 4.2 Savepoint Stress Test

6. `mysql_transaction_begin` → get `transactionId`
7. Create savepoint `sp1`
8. Insert row into `stress_cycle_table` (within transaction)
9. Create savepoint `sp2`
10. Insert another row
11. `mysql_transaction_rollback_to({transactionId: <id>, name: "sp2"})` → should undo sp2's insert
12. `mysql_transaction_rollback_to({transactionId: <id>, name: "sp1"})` → should undo all
13. `mysql_transaction_commit({transactionId: <id>})`
14. Verify `stress_cycle_table` has no test rows (pre-sp1 state)

### 4.3 Transaction Execute Mixed Statements

15. `mysql_transaction_execute({statements: [{sql: "SELECT COUNT(*) AS before_count FROM test_products"}, {sql: "INSERT INTO test_products (name, price, category) VALUES ('stress_tx', 99.99, 'test')"}, {sql: "SELECT COUNT(*) AS after_count FROM test_products"}]})` → verify `statementsExecuted: 3`
16. Cleanup: Delete the inserted row

### 4.4 Transaction Execute Failure Rollback

17. `mysql_transaction_execute({statements: [{sql: "CREATE TABLE stress_tx_fail (id INT)"}, {sql: "INSERT INTO nonexistent_table VALUES (1)"}, {sql: "CREATE TABLE stress_tx_fail2 (id INT)"}]})` → failure
18. Verify: `stress_tx_fail` does NOT exist (auto-rollback)

---

## Category 5: Extension Edge Cases

### 5.1 JSON Mutation Workflow

Create `stress_json_mut (id INT AUTO_INCREMENT PRIMARY KEY, data JSON)`, insert one row with `data: '{"name": "Alice", "tags": ["a", "b"], "nested": {"level1": {"value": 1}}}'`:

1. `mysql_json_set({table: "stress_json_mut", column: "data", path: "$.name", value: "\"Bob\"", where: "id = 1"})` → verify update
2. `mysql_json_set({table: "stress_json_mut", column: "data", path: "$.nested.level1.value", value: "42", where: "id = 1"})` → verify deep set
3. `mysql_json_remove({table: "stress_json_mut", column: "data", path: "$.tags", where: "id = 1"})` → verify removal
4. `mysql_json_merge({table: "stress_json_mut", column: "data", mergeData: {"newKey": "added"}, where: "id = 1"})` → verify merge
5. Cleanup: Drop `stress_json_mut`

### 5.2 Spatial Boundary Coordinates

6. `mysql_spatial_point({lat: 91, lng: 0})` → expect bounds validation error (lat ±90°)
7. `mysql_spatial_point({lat: 0, lng: 181})` → expect bounds validation error (lng ±180°)
8. `mysql_spatial_point({lat: 90, lng: 180})` → exact boundary, should succeed
9. `mysql_spatial_point({lat: -90, lng: -180})` → exact boundary, should succeed

### 5.3 Document Store Edge Cases

10. `mysql_doc_create_collection({name: "stress_doc_test"})` → success
11. `mysql_doc_add({collection: "stress_doc_test", documents: []})` → report behavior (empty array)
12. `mysql_doc_find({collection: "stress_doc_test", criteria: {"nonexistent_field": "x"}})` → 0 results (not error)
13. Cleanup: `mysql_doc_drop_collection({name: "stress_doc_test"})`

---

## Category 6: Large Payload & Truncation Verification

### 6.1 Truncation Indicators

1. `mysql_list_tables({limit: 2})` → expect `truncated: true` and total count > 2
2. `mysql_export_table({table: "test_measurements", limit: 5})` → expect 5 rows
3. `mysql_query_stats({limit: 1})` → expect limited results

### 6.2 Default Payload Sizes

4. `mysql_read_query({query: "SELECT * FROM test_measurements"})` → 200 rows — check payload size
5. `mysql_read_query({query: "SELECT * FROM test_events"})` → 100 rows — check payload size
6. `mysql_innodb_status()` → check if full output is excessively large vs summary mode

---

## Category 7: Code Mode Parity

### 7.1 Core API Parity

```javascript
// Run via mysql_execute_code
const direct = await mysql.core.readQuery({query: "SELECT COUNT(*) AS n FROM test_products"});
const alias = await mysql.readQuery("SELECT COUNT(*) AS n FROM test_products");
return {
  direct: direct.rows[0].n,
  alias: alias.rows[0].n,
  match: direct.rows[0].n === alias.rows[0].n
};
```

Expect: `match: true`

### 7.2 Discovery Methods

1. `mysql_execute_code({code: "return await mysql.help()"})` → verify returns group→methods mapping for all groups
2. `mysql_execute_code({code: "return await mysql.core.help()"})` → verify core-specific methods
3. `mysql_execute_code({code: "return await mysql.json.help()"})` → verify JSON-specific methods
4. `mysql_execute_code({code: "return await mysql.stats.help()"})` → verify stats-specific methods

### 7.3 Code Mode Error Handling

```javascript
const result = await mysql.core.readQuery({query: "SELECT * FROM nonexistent_xyz"});
return {
  success: result.success,
  hasError: !!result.error,
  hasTableName: result.error?.includes("nonexistent_xyz")
};
```

Expect: `{success: false, hasError: true, hasTableName: true}`

---

## Category 8: Cross-Group Integration Workflows

### Workflow 1: Core → JSON → Stats (Data Pipeline)

1. `mysql_create_table({table: "stress_pipeline", columns: [{name: "id", type: "INT", primaryKey: true, autoIncrement: true}, {name: "data", type: "JSON"}, {name: "score", type: "DECIMAL(5,2)"}]})` → success
2. Insert 5 rows with JSON data and scores
3. `mysql_json_extract({table: "stress_pipeline", column: "data", path: "$.category"})` → verify extraction
4. `mysql_stats_descriptive({table: "stress_pipeline", column: "score"})` → verify stats
5. Cleanup: drop `stress_pipeline`

### Workflow 2: Core → Fulltext → Document (Search Pipeline)

6. Create `stress_search` with FULLTEXT columns → insert articles → search → cleanup
7. `mysql_fulltext_search` on the temp table → verify results
8. Cleanup: drop `stress_search`

### Workflow 3: Admin → Performance (Health Check Pipeline)

9. `mysql_check_table({table: "test_products"})` → integrity check
10. `mysql_analyze_table({table: "test_products"})` → update statistics
11. `mysql_explain({query: "SELECT * FROM test_products WHERE name = 'Laptop'"})` → query plan
12. `mysql_optimize_table({table: "test_products"})` → optimize
13. `mysql_explain({query: "SELECT * FROM test_products WHERE name = 'Laptop'"})` → same query after optimize, compare plans

---

## Post-Test Procedures

### Final Summary

Compile a summary of all findings:

1. **Fails (❌)**: Tool errors or incorrect results that need code fixes
2. **Issues (⚠️)**: Unexpected behaviors or improvement opportunities
3. **Payload (📦)**: Unnecessarily large responses
4. **Error quality ratings**: Rate each error message 1-5 for contextual usefulness

### After Testing

1. **Cleanup**: Confirm ALL `stress_*` objects are removed
2. **Triage findings**: If issues were found, create an implementation plan. If the plan requires no user decisions, proceed directly to implementation
3. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `ServerInstructions.ts`
   - Test database (`test-seed.sql`)
   - This prompt (`advanced-test-tools.md`)

### After Implementation

4. **Validate**: Run test suite and fix broken tests, run lint + typecheck and fix issues, run prettier, update changelog (no duplicate headers)
5. **Commit**: Stage and commit all changes — do NOT push
6. **Live re-test**: Test fixes with direct MCP tool calls
7. **Final summary**: If no issues found, provide the final summary after testing. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working

> **Note:** `test-server/` is in `.gitignore` as intended.

