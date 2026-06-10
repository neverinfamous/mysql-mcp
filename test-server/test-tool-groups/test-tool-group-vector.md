# mysql-mcp Tool Group Testing: [vector]

## Essential Instructions
1. Run these tests using direct MCP tool calls (NOT Code Mode)
2. Use `--tool-filter vector` when starting the server
3. **Do not modify or skip tests** - report failures exactly as they occur
4. Any temp files should be created in `C:\Users\chris\Desktop\mysql-mcp\tmp`
5. Ensure your findings are consistent with the overall architecture in `../code-map.md`

## Reporting Format
When reporting results, use these status markers:
- `❌ Fail` - Tool errors, crashes, or produces incorrect results (requires immediate fix)
- `⚠️ Issue` - Unexpected behavior, confusing error messages, or improvement opportunity
- `📦 Payload` - Unnecessarily large response that wastes token context (blocking issue, must fix)

*Note: Every tool response includes `_meta.tokenEstimate`. Keep an eye on these values.*

## Test Database Schema
*Note: Use these existing tables for read operations. Do NOT modify them.*

| Table Name | Rows | Key Columns | Notes |
|------------|------|-------------|-------|
| test_products | 16 | id, name, price | E-commerce items |
| test_orders | 20 | id, user_id, status | Order records |
| test_json_docs | 8 | id, metadata, settings | JSON storage |
| test_articles | 10 | id, title, body | Fulltext indexed |
| test_users | 10 | id, email, role | User accounts |
| test_measurements| 200 | id, timestamp, value | Time-series data |
| test_locations | 15 | id, name, geo | Spatial data |
| test_categories | 17 | id, parent_id, name | Hierarchical data |
| test_events | 100 | id, type, created_at| Event log |
| test_documents | 10 | _id, doc | DocStore data |
| test_partitioned | 26 | id, created_date | Partitioned by year |

## Testing Requirements
1. **Reads**: Use `test_*` tables when possible
2. **Writes**: ALWAYS create `temp_*` tables for any write operations
3. **Cleanup**: Drop all `temp_*` tables when finished
4. **Error Paths**: For every tool, test the domain error path (e.g. non-existent table) and Zod validation error path (e.g. missing params)

### Structured Error Response Pattern
When testing error paths, ensure the server returns structured errors, NOT raw MCP errors:

| Scenario | Expected Output | Status |
|----------|-----------------|--------|
| Handler error | JSON object with `success: false` and `error` field | ✅ Correct |
| Zod validation error | JSON object with `success: false` and `error` array | ✅ Correct |
| MCP error | Raw text error string with `isError: true` | ❌ Bug |

### P154: Entity Existence Pattern
Any tool operating on a specific entity (table, row, view, etc.) MUST return a structured response when that entity does not exist, rather than failing with a raw database error. Example: `{ exists: false, table: "nonexistent" }` or `{ success: false, error: "Row not found" }`.

---

## Group Focus: vector

Before starting, run `mysql_vector_info({ table: "test_articles" })` to verify vector support. If it returns `{ success: false, code: "EXTENSION_MISSING" }`, stop here — your MySQL instance does not support vectors (9.0+ required).

First, create a temp table for testing:
`mysql_write_query({ query: "CREATE TABLE temp_embeddings (id INT PRIMARY KEY, content TEXT, embedding VECTOR(3));" })`
`mysql_write_query({ query: "ALTER TABLE temp_embeddings ADD FULLTEXT(content);" })`

1. `mysql_vector_info({ table: "temp_embeddings" })`
   - Verify it returns the `embedding` column with dimensions: 3.
2. `mysql_vector_store({ table: "temp_embeddings", column: "embedding", id: 1, vector: [0.1, 0.2, 0.3] })`
   - Verify success.
3. `mysql_write_query({ query: "UPDATE temp_embeddings SET content = 'machine learning' WHERE id = 1" })`
   - Update text content for hybrid search later.
4. `mysql_vector_batch_store({ table: "temp_embeddings", column: "embedding", items: [{id: 2, vector: [0.9, 0.1, 0.1]}, {id: 3, vector: [0.1, 0.8, 0.1]}] })`
   - Verify both items stored.
5. `mysql_write_query({ query: "UPDATE temp_embeddings SET content = 'deep learning' WHERE id = 2; UPDATE temp_embeddings SET content = 'artificial intelligence' WHERE id = 3;" })`
   - Update text content.
6. `mysql_vector_get({ table: "temp_embeddings", id: 1 })`
   - Verify it returns the array `[0.1, 0.2, 0.3]`.
7. `mysql_vector_search({ table: "temp_embeddings", column: "embedding", queryVector: [0.1, 0.9, 0.1], k: 2, metric: "COSINE" })`
   - Verify it returns nearest neighbors (id 3 should be closest).
8. `mysql_vector_range_search({ table: "temp_embeddings", column: "embedding", queryVector: [0.1, 0.2, 0.3], maxDistance: 0.1 })`
   - Verify it finds id 1.
79. `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryVector: [0.9, 0.1, 0.1], queryText: "machine learning" })`
   - Verify it returns results with `vector_distance`, `text_score`, and `combined_score`.
79a. `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryVector: [0.9, 0.1, 0.1] })`
   - Verify vector-only fallback works (`text_score` = 0).
79b. `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryText: "machine learning" })`
   - Verify text-only fallback works (`vector_distance` = null).
79c. `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryVector: [0.9, 0.1, 0.1], queryText: "machine learning", metric: "EUCLIDEAN" })`
   - Verify EUCLIDEAN metric works.
79d. `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryVector: [0.9, 0.1, 0.1], queryText: "machine learning", select: ["id"] })`
   - Verify select column filtering works (returns only `id` and scoring columns, no `content`).
79e. `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryVector: [0.9, 0.1, 0.1], queryText: "machine learning", rrfK: 1 })`
   - Verify rrfK param works without error.
79f. `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryVector: [0.9, 0.1, 0.1], queryText: "machine learning", filter: "id = 1" })`
   - Verify filter works (should only return id 1).
79g. `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryVector: [0.9, 0.1, 0.1], queryText: "machine) +(learning" })`
   - Verify FTS query sanitization works (should not crash on invalid FTS syntax).
10. `mysql_vector_stats({ table: "temp_embeddings", column: "embedding" })`
    - Verify it shows 3 rows, dimensions consistent, min/max 3.
11. `mysql_vector_create_index({ table: "temp_embeddings", column: "embedding" })`
    - Verify index creation (Note: Requires MySQL 9.1+. If 9.0, it should gracefully return `EXTENSION_MISSING` and you can proceed).
12. `mysql_vector_optimize({ table: "temp_embeddings" })`
    - Verify ANALYZE TABLE executes.
13. `mysql_vector_delete({ table: "temp_embeddings", id: 1 })`
    - Verify deletion.
14. `mysql_vector_get({ table: "temp_embeddings", id: 1 })`
    - Verify it returns `{ exists: false }` (P154 pattern).
15. 🔴 `mysql_vector_store({ table: "nonexistent_table_xyz", column: "embedding", id: 1, vector: [0.1] })`
    - Must return structured error.
16. 🔴 `mysql_vector_search({ table: "nonexistent_table_xyz", column: "embedding", queryVector: [0.1] })`
    - Must return structured error.
17. 🔴 `mysql_vector_store({})`
    - Must return Zod validation error.
18. 🔴 `mysql_vector_search({})`
    - Must return Zod validation error.
19. 🔴 `mysql_vector_get({})`
    - Must return Zod validation error.
20. 🔴 `mysql_vector_delete({})`
    - Must return Zod validation error.
21. 🔴 `mysql_vector_search({ table: "temp_embeddings", column: "embedding", queryVector: [0.1, 0.2, 0.3], k: "abc" })`
    - Must NOT return a raw MCP error; should handle type coercion or validation gracefully.
106. 🔴 `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content" })`
    - Must return Zod validation error (requires either queryVector or queryText).
107. 🔴 `mysql_vector_hybrid_search({ table: "test_articles", vectorColumn: "nonexistent", textColumn: "title", queryVector: [0.1], queryText: "test" })`
    - Must return COLUMN_NOT_FOUND.
108. 🔴 `mysql_vector_hybrid_search({ table: "test_users", vectorColumn: "email", textColumn: "role", queryVector: [0.1], queryText: "test" })`
    - Must return FULLTEXT_INDEX_MISSING (test_users has no FTS index).
109. 🔴 `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryVector: [0.1], queryText: "test", metric: "INVALID" })`
    - Must return Zod validation error for invalid metric.
110. 🔴 `mysql_vector_hybrid_search({ table: "temp_embeddings", vectorColumn: "embedding", textColumn: "content", queryVector: [0.1], queryText: "test", rrfK: -1 })`
    - Must return Zod validation error for out-of-bounds rrfK.
111. Drop `temp_embeddings` table.

## Post-Test Workflow
If you found any issues or bugs:
1. Fix them directly in the codebase.
2. Ensure you have read `../code-map.md` before making any architectural changes.
3. Update `UNRELEASED.md` with your fixes.
4. Commit your changes (do NOT push).
