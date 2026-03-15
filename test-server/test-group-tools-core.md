# Group-Specific Tool Testing — Core, Transactions, Schema

### core Group-Specific Testing

core Tool Group (8 tools +1 for code mode):

1. 'mysql_read_query'
2. 'mysql_write_query'
3. 'mysql_list_tables'
4. 'mysql_describe_table'
5. 'mysql_create_table'
6. 'mysql_drop_table'
7. 'mysql_create_index'
8. 'mysql_get_indexes'
9. 'mysql_execute_code' (codemode, auto-added)

All tools implement P154 structured error handling for nonexistent tables. Test with `test_products` and `test_orders`.

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

**Read/Write/Schema tools:**

1. `mysql_read_query({query: "SELECT COUNT(*) AS n FROM test_orders"})` → `{rows: [{n: 20}], rowCount: 1}`
2. `mysql_read_query({query: "SELECT id, name, price FROM test_products WHERE price > 50 LIMIT 3"})` → 3 rows with valid data
3. `mysql_list_tables({database: "testdb", limit: 5})` → `{tables: [...], count: 5, truncated: true}`
4. `mysql_describe_table({table: "test_products"})` → verify `columns` includes `id`, `name`, `price`, `category`, `metadata`; `primaryKey` present
5. `mysql_get_indexes({table: "test_orders"})` → verify `idx_orders_status` and `idx_orders_date` in results
6. `mysql_list_tables({database: "testdb"})` → verify ≥11 test tables present

**Domain error paths (🔴):**

7. 🔴 `mysql_read_query({query: "SELECT * FROM nonexistent_table_xyz"})` → `{success: false, error: "..."}` mentioning table name — NOT raw MCP error
8. 🔴 `mysql_write_query({query: "INSERT INTO nonexistent_xyz VALUES (1)"})` → `{success: false, error: "..."}` handler error
9. 🔴 `mysql_read_query({query: "SELECT nonexistent_col FROM test_products"})` → `{success: false, error: "..."}` mentioning column name
10. 🔴 `mysql_describe_table({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}` mentioning table name
11. 🔴 `mysql_get_indexes({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}` handler error
12. 🔴 `mysql_read_query({query: "SELEKT * FROM test_products"})` → `{success: false, error: "..."}` SQL syntax error

**Zod validation error paths (🔴 — verify `"Validation error: ..."` format, NOT raw JSON array):**

13. 🔴 `mysql_create_table({})` → `{success: false, error: "Validation error: ..."}` — NOT raw MCP error
14. 🔴 `mysql_describe_table({})` → `{success: false, error: "Validation error: ..."}` (missing required `table`)
15. 🔴 `mysql_read_query({})` → `{success: false, error: "Validation error: ..."}` (missing required `query`)
16. 🔴 `mysql_write_query({})` → `{success: false, error: "Validation error: ..."}` (missing required `query`)
17. 🔴 `mysql_create_index({})` → `{success: false, error: "Validation error: ..."}` (missing required params)
18. 🔴 `mysql_drop_table({})` → `{success: false, error: "Validation error: ..."}` (missing required `table`)

**Wrong-type numeric param coercion (🔴):**

19. 🔴 `mysql_list_tables({limit: "abc"})` → must NOT return raw MCP `-32602` error — should return handler error or silently default `limit`
20. 🔴 `mysql_read_query({query: "SELECT * FROM test_products", limit: "abc"})` → must NOT return raw MCP error

**Alias acceptance (verify aliases produce identical results):**

21. `mysql_read_query({sql: "SELECT 1 AS test"})` → works via `sql` alias for `query`
22. `mysql_describe_table({name: "test_products"})` → works via `name` alias for `table`
23. `mysql_describe_table({tableName: "test_products"})` → works via `tableName` alias for `table`
24. `mysql_drop_table({name: "temp_alias_test", ifExists: true})` → works via `name` alias

**Create → Use → Drop lifecycle (temp tables):**

25. `mysql_create_table({table: "temp_lifecycle", columns: [{name: "id", type: "INT", primaryKey: true, autoIncrement: true}, {name: "name", type: "VARCHAR(100)", notNull: true}]})` → `{success: true}`
26. `mysql_write_query({query: "INSERT INTO temp_lifecycle (name) VALUES ('Alice'), ('Bob')"})` → `{rowsAffected: 2}`
27. `mysql_read_query({query: "SELECT COUNT(*) AS n FROM temp_lifecycle"})` → `{rows: [{n: 2}]}`
28. `mysql_create_index({table: "temp_lifecycle", columns: ["name"], name: "idx_temp_name"})` → `{success: true}`
29. `mysql_get_indexes({table: "temp_lifecycle"})` → verify `idx_temp_name` appears
30. `mysql_drop_table({table: "temp_lifecycle", ifExists: true})` → `{success: true}`
31. `mysql_drop_table({table: "temp_lifecycle", ifExists: true})` → `{success: true}` or `{existed: false}` (already dropped)

**Code mode (`mysql_execute_code`) deterministic items:**

32. `mysql_execute_code({code: "return await mysql.core.help()"})` → verify lists ~8 core methods
33. `mysql_execute_code({code: "return await mysql.core.readQuery({query: 'SELECT 1 AS n'})"})` → verify `{rows: [{n: 1}]}`
34. `mysql_execute_code({code: "return await mysql.readQuery('SELECT COUNT(*) AS n FROM test_products')"})` → verify works via top-level alias
35. `mysql_execute_code({code: "return await mysql.core.readQuery({query: 'SELECT * FROM nonexistent_xyz'})"})` → verify error is returned (not thrown), contains `{success: false}` or error object

---

### transactions Group-Specific Testing

transactions Tool Group (7 tools +1 for code mode):

1. 'mysql_transaction_begin'
2. 'mysql_transaction_commit'
3. 'mysql_transaction_rollback'
4. 'mysql_transaction_savepoint'
5. 'mysql_transaction_release'
6. 'mysql_transaction_rollback_to'
7. 'mysql_transaction_execute'
8. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

1. `mysql_transaction_begin()` → capture `transactionId`
2. `mysql_read_query({query: "SELECT 1 AS test", transactionId: <id>})` → `{rows: [{test: 1}]}`
3. `mysql_transaction_savepoint({transactionId: <id>, name: "checklist_sp1"})` → `{success: true}`
4. `mysql_transaction_rollback_to({transactionId: <id>, name: "checklist_sp1"})` → `{success: true}`
5. `mysql_transaction_release({transactionId: <id>, name: "checklist_sp1"})` → note behavior (released savepoints cannot be rolled back to)
6. `mysql_transaction_commit({transactionId: <id>})` → `{success: true}`
7. `mysql_transaction_execute({statements: [{sql: "SELECT 1 AS a"}, {sql: "SELECT 2 AS b"}]})` → `{success: true, statementsExecuted: 2}`

**Domain error paths (🔴):**

8. 🔴 `mysql_transaction_commit({transactionId: "nonexistent-uuid"})` → `{success: false, error: "..."}` handler error
9. 🔴 `mysql_transaction_rollback({transactionId: "nonexistent-uuid"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

10. 🔴 `mysql_transaction_execute({})` → `{success: false, error: "..."}` (Zod validation — missing `statements`)
11. 🔴 `mysql_transaction_savepoint({})` → `{success: false, error: "..."}` (missing required params)
12. 🔴 `mysql_transaction_rollback_to({})` → `{success: false, error: "..."}` (missing required params)

**Code mode parity:**

13. `mysql_execute_code({code: "const tx = await mysql.transactions.begin(); const r = await mysql.core.readQuery({query: 'SELECT 1 AS n', transactionId: tx.transactionId}); await mysql.transactions.rollback({transactionId: tx.transactionId}); return r"})` → verify `{rows: [{n: 1}]}`
14. `mysql_execute_code({code: "return await mysql.transactions.help()"})` → verify lists transaction methods

---

### schema Group-Specific Testing

schema Tool Group (10 tools +1 for code mode):

1. 'mysql_list_schemas'
2. 'mysql_create_schema'
3. 'mysql_drop_schema'
4. 'mysql_list_views'
5. 'mysql_create_view'
6. 'mysql_list_stored_procedures'
7. 'mysql_list_functions'
8. 'mysql_list_triggers'
9. 'mysql_list_constraints'
10. 'mysql_list_events'
11. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

1. `mysql_list_schemas()` → verify `testdb`, `information_schema`, `mysql` in results
2. `mysql_list_views({database: "testdb"})` → verify response structure (may be empty)
3. `mysql_list_constraints({table: "test_orders"})` → verify FK to `test_products` appears
4. `mysql_list_triggers({database: "testdb"})` → verify response structure (may be empty)
5. `mysql_list_stored_procedures({database: "testdb"})` → verify response structure
6. `mysql_list_functions({database: "testdb"})` → verify response structure
7. `mysql_list_events({database: "testdb"})` → verify response structure

**Create → Use → Drop lifecycle:**

8. `mysql_create_view({name: "temp_view_order_totals", query: "SELECT product_id, SUM(total_price) AS total FROM test_orders GROUP BY product_id"})` → `{success: true}`
9. `mysql_list_views({database: "testdb"})` → verify `temp_view_order_totals` appears

**Domain error paths (🔴):**

10. 🔴 `mysql_list_constraints({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}` or empty results — not raw MCP error
11. 🔴 `mysql_drop_schema({name: "nonexistent_db_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

12. 🔴 `mysql_create_view({})` → `{success: false, error: "Validation error: ..."}` (missing required params)
13. 🔴 `mysql_create_schema({})` → `{success: false, error: "Validation error: ..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

14. 🔴 `mysql_list_constraints({limit: "abc"})` → must NOT return raw MCP `-32602` error

**Code mode parity:**

15. `mysql_execute_code({code: "return await mysql.schema.help()"})` → verify lists schema methods
16. `mysql_execute_code({code: "return await mysql.schema.listSchemas()"})` → verify returns databases

**Cleanup:**

17. Drop `temp_view_order_totals` view via `mysql_write_query({query: "DROP VIEW IF EXISTS temp_view_order_totals"})`

