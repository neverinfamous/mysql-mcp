# Group-Specific Tool Testing — Data Groups

### json Group-Specific Testing

json Tool Group (17 tools +1 for code mode):

1. 'mysql_json_extract'
2. 'mysql_json_set'
3. 'mysql_json_insert'
4. 'mysql_json_replace'
5. 'mysql_json_remove'
6. 'mysql_json_contains'
7. 'mysql_json_keys'
8. 'mysql_json_array_append'
9. 'mysql_json_get'
10. 'mysql_json_update'
11. 'mysql_json_search'
12. 'mysql_json_validate'
13. 'mysql_json_merge'
14. 'mysql_json_diff'
15. 'mysql_json_normalize'
16. 'mysql_json_stats'
17. 'mysql_json_index_suggest'
18. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

**Test data:** Use `test_json_docs` table which has these JSON structures:

- `doc`: `{"type": "article", "title": "...", "author": "...", "views": N}`
- `metadata`: `{"source": "blog", "language": "en", "version": N}`
- `tags`: `["database", "tutorial", "beginner"]`
- Nested access: row with `doc.nested.level1.level2`

**Checklist:**

1. `mysql_json_extract({table: "test_json_docs", column: "doc", path: "$.author", where: "id = 1"})` → result contains author name
2. `mysql_json_extract({table: "test_json_docs", column: "doc", path: "$.views", where: "id = 1"})` → numeric value
3. `mysql_json_keys({table: "test_json_docs", column: "doc", where: "id = 1"})` → keys include `type`, `title`, `author`, `views`
4. `mysql_json_validate({value: "{\"valid\": true}"})` → `{valid: true}`
5. `mysql_json_validate({value: "{invalid json"})` → `{valid: false}`
6. `mysql_json_contains({table: "test_json_docs", column: "doc", contains: {"type": "article"}, where: "id = 1"})` → true
7. `mysql_json_stats({table: "test_json_docs", column: "doc"})` → verify `topKeys` present
8. `mysql_json_diff({doc1: {"a": 1, "b": 2}, doc2: {"a": 1, "c": 3}})` → verify differences detected
9. `mysql_json_index_suggest({table: "test_json_docs", column: "doc"})` → verify suggestions returned

**Domain error paths (🔴):**

10. 🔴 `mysql_json_extract({table: "nonexistent_xyz", column: "doc", path: "$.x"})` → `{success: false, error: "..."}` handler error
11. 🔴 `mysql_json_extract({table: "test_json_docs", column: "nonexistent_col", path: "$.x"})` → `{success: false, error: "..."}` mentioning column

**Zod validation error paths (🔴):**

12. 🔴 `mysql_json_keys({})` → `{success: false, error: "..."}` (Zod validation)
13. 🔴 `mysql_json_extract({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

14. 🔴 `mysql_json_stats({table: "test_json_docs", column: "doc", sampleSize: "abc"})` → must NOT return raw MCP `-32602` error
15. 🔴 `mysql_json_contains({table: "test_json_docs", column: "doc", contains: {"type": "article"}, limit: "abc"})` → must NOT return raw MCP error

**Code mode parity:**

16. `mysql_execute_code({code: "return await mysql.json.help()"})` → verify lists JSON methods
17. `mysql_execute_code({code: "return await mysql.json.extract({table: 'test_json_docs', column: 'doc', path: '$.author', where: 'id = 1'})"})` → same result as item 1

---

### fulltext Group-Specific Testing

fulltext Tool Group (5 tools +1 for code mode):

1. 'mysql_fulltext_create'
2. 'mysql_fulltext_drop'
3. 'mysql_fulltext_search'
4. 'mysql_fulltext_boolean'
5. 'mysql_fulltext_expand'
6. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

**Test data:** Uses `test_articles` which has a FULLTEXT INDEX on `(title, body)`.

Searchable terms: `MySQL`, `database`, `JSON`, `FTS`, `MCP`, `API`, `search`, `replication`.

**Checklist:**

1. `mysql_fulltext_search({table: "test_articles", columns: ["title", "body"], query: "MySQL"})` → at least 1 result with relevance scores
2. `mysql_fulltext_search({table: "test_articles", columns: ["title", "body"], query: "nonexistent_word_xyz"})` → 0 results
3. `mysql_fulltext_boolean({table: "test_articles", columns: ["title", "body"], query: "+MySQL +database"})` → results containing both terms
4. `mysql_fulltext_boolean({table: "test_articles", columns: ["title", "body"], query: "+MySQL -JSON"})` → results with MySQL but not JSON
5. `mysql_fulltext_expand({table: "test_articles", columns: ["title", "body"], query: "database"})` → expanded results (may include synonyms)

**Domain error paths (🔴):**

6. 🔴 `mysql_fulltext_search({table: "nonexistent_xyz", columns: ["title"], query: "test"})` → `{success: false, error: "..."}` handler error
7. 🔴 `mysql_fulltext_search({table: "test_products", columns: ["name"], query: "test"})` → `{success: false, error: "..."}` (no FULLTEXT index)

**Zod validation error paths (🔴):**

8. 🔴 `mysql_fulltext_search({})` → `{success: false, error: "..."}` (missing required params)
9. 🔴 `mysql_fulltext_create({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

10. 🔴 `mysql_fulltext_search({table: "test_articles", columns: ["title", "body"], query: "MySQL", limit: "abc"})` → must NOT return raw MCP error

**Code mode parity:**

11. `mysql_execute_code({code: "return await mysql.fulltext.help()"})` → verify lists fulltext methods
12. `mysql_execute_code({code: "return await mysql.fulltext.search({table: 'test_articles', columns: ['title', 'body'], query: 'MySQL'})"})` → same structure as item 1

---

### document Group-Specific Testing

document Tool Group (9 tools +1 for code mode):

1. 'mysql_doc_list_collections'
2. 'mysql_doc_create_collection'
3. 'mysql_doc_drop_collection'
4. 'mysql_doc_find'
5. 'mysql_doc_add'
6. 'mysql_doc_modify'
7. 'mysql_doc_remove'
8. 'mysql_doc_create_index'
9. 'mysql_doc_collection_info'
10. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

**Test data:** Uses `test_documents` (10 rows, collection_name, doc JSON, _id UUID).

**Checklist:**

1. `mysql_doc_list_collections()` → verify `test_documents` appears in results
2. `mysql_doc_find({collection: "test_documents", limit: 3})` → verify 3 documents returned with `_id` fields
3. `mysql_doc_collection_info({collection: "test_documents"})` → verify `{count: 10, ...}` or similar structure

**Create → Use → Drop lifecycle:**

4. `mysql_doc_create_collection({name: "temp_doc_test"})` → `{success: true}`
5. `mysql_doc_add({collection: "temp_doc_test", documents: [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]})` → verify 2 documents added
6. `mysql_doc_find({collection: "temp_doc_test"})` → verify 2 documents
7. `mysql_doc_modify({collection: "temp_doc_test", criteria: {"name": "Alice"}, update: {"age": 31}})` → verify update
8. `mysql_doc_remove({collection: "temp_doc_test", criteria: {"name": "Bob"}})` → verify removal
9. `mysql_doc_drop_collection({name: "temp_doc_test"})` → `{success: true}`

**Domain error paths (🔴):**

10. 🔴 `mysql_doc_find({collection: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error
11. 🔴 `mysql_doc_collection_info({collection: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

12. 🔴 `mysql_doc_add({})` → `{success: false, error: "..."}` (missing required params)
13. 🔴 `mysql_doc_create_collection({})` → `{success: false, error: "..."}` (missing required `name`)

**Wrong-type numeric param coercion (🔴):**

14. 🔴 `mysql_doc_find({collection: "test_documents", limit: "abc"})` → must NOT return raw MCP error

**Code mode parity:**

15. `mysql_execute_code({code: "return await mysql.document.help()"})` → verify lists document methods

---

### text Group-Specific Testing

text Tool Group (6 tools +1 for code mode):

1. 'mysql_regexp_match'
2. 'mysql_like_search'
3. 'mysql_soundex'
4. 'mysql_substring'
5. 'mysql_concat'
6. 'mysql_collation_convert'
7. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

**Test data:** Uses `test_users` (10 rows: username, email, phone, bio, role) and `test_products` (16 rows).

**Checklist:**

1. `mysql_regexp_match({table: "test_users", column: "email", pattern: "^[a-z]+\\.[a-z]+@"})` → verify matching dotted emails
2. `mysql_like_search({table: "test_products", column: "name", pattern: "%Laptop%"})` → results matching "Laptop"
3. `mysql_soundex({table: "test_users", column: "username", value: "john"})` → verify phonetic matches
4. `mysql_substring({table: "test_users", column: "email", start: 1, length: 5})` → first 5 chars of each email
5. `mysql_concat({table: "test_users", columns: ["username", "email"], separator: " - "})` → concatenated values

**Domain error paths (🔴):**

6. 🔴 `mysql_regexp_match({table: "nonexistent_xyz", column: "x", pattern: "."})` → `{success: false, error: "..."}` handler error
7. 🔴 `mysql_like_search({table: "test_users", column: "nonexistent_col", pattern: "%test%"})` → `{success: false, error: "..."}`

**Zod validation error paths (🔴):**

8. 🔴 `mysql_regexp_match({})` → `{success: false, error: "..."}` (Zod validation)
9. 🔴 `mysql_like_search({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

10. 🔴 `mysql_substring({table: "test_users", column: "email", start: "abc", length: 5})` → must NOT return raw MCP error
11. 🔴 `mysql_like_search({table: "test_users", column: "email", pattern: "%@%", limit: "abc"})` → must NOT return raw MCP error

**Code mode parity:**

12. `mysql_execute_code({code: "return await mysql.text.help()"})` → verify lists text methods

---

### stats Group-Specific Testing

stats Tool Group (8 tools +1 for code mode):

1. 'mysql_stats_descriptive'
2. 'mysql_stats_percentiles'
3. 'mysql_stats_correlation'
4. 'mysql_stats_distribution'
5. 'mysql_stats_time_series'
6. 'mysql_stats_regression'
7. 'mysql_stats_sampling'
8. 'mysql_stats_histogram'
9. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

**Test data:** Uses `test_measurements` (200 rows, sensor_id 1-5, columns: temperature, humidity).

**Checklist:**

1. `mysql_stats_descriptive({table: "test_measurements", column: "temperature"})` → verify `mean`, `stddev`, `min`, `max` present
2. `mysql_stats_percentiles({table: "test_measurements", column: "temperature", percentiles: [25, 50, 75]})` → verify 3 percentile values
3. `mysql_stats_correlation({table: "test_measurements", column1: "temperature", column2: "humidity"})` → verify correlation value between -1 and 1
4. `mysql_stats_distribution({table: "test_measurements", column: "temperature", buckets: 10})` → verify `buckets` array with entries
5. `mysql_stats_histogram({table: "test_measurements", column: "temperature", buckets: 10})` → verify histogram data
6. `mysql_stats_sampling({table: "test_measurements", sampleSize: 10})` → verify approximately 10 rows returned
7. `mysql_stats_regression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity"})` → verify regression coefficients returned

**Domain error paths (🔴):**

8. 🔴 `mysql_stats_descriptive({table: "nonexistent_xyz", column: "x"})` → `{success: false, error: "..."}` handler error
9. 🔴 `mysql_stats_correlation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric columns

**Zod validation error paths (🔴):**

10. 🔴 `mysql_stats_descriptive({})` → `{success: false, error: "..."}` (Zod validation)
11. 🔴 `mysql_stats_percentiles({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

12. 🔴 `mysql_stats_sampling({table: "test_measurements", sampleSize: "abc"})` → must NOT return raw MCP error
13. 🔴 `mysql_stats_distribution({table: "test_measurements", column: "temperature", buckets: "abc"})` → must NOT return raw MCP error
14. 🔴 `mysql_stats_histogram({table: "test_measurements", column: "temperature", buckets: "abc"})` → must NOT return raw MCP error

**Code mode parity:**

15. `mysql_execute_code({code: "return await mysql.stats.help()"})` → verify lists stats methods
16. `mysql_execute_code({code: "return await mysql.stats.descriptive({table: 'test_measurements', column: 'temperature'})"})` → same structure as item 1

