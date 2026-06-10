# mysql-mcp Code Mode Re-Testing: [vector]

## Essential Instructions
1. Run these tests EXCLUSIVELY using the `mysql_execute_code` tool (Code Mode).
2. Do not use direct tool calls for these operations.
3. You must use `--tool-filter codemode` when starting the server.
4. **Do not modify or skip tests** - report failures exactly as they occur.
5. Any temp files should be created in `C:\Users\chris\Desktop\mysql-mcp\tmp`.
6. Ensure your findings are consistent with the overall architecture in `../code-map.md`.

## Reporting Format
When reporting results, use these status markers:
- `❌ Fail` - Code errors, missing APIs, or incorrect results
- `⚠️ Issue` - Unexpected behavior, missing autocomplete/types, or confusing error messages
- `📦 Payload` - Unnecessarily large response

*Note: Every Code Mode response includes `metrics.tokenEstimate`. Keep an eye on these values.*

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
4. **Error Propagation**: Ensure errors thrown inside the sandbox correctly propagate out to the MCP result

---

## Group Focus: vector (Code Mode API)

Run a single `mysql_execute_code` operation to verify the API shape first:

```javascript
const help = await mysql.vector.help();
const info = await mysql.vector.info({ table: "test_articles" }); // Just to check version support
return { help, info };
```
Verify all 11 vector methods are listed in the help response.

Next, execute a full lifecycle test in a single script:

```javascript
const failures = [];

try {
  // 1. Setup
  await mysql.core.writeQuery({ query: "CREATE TABLE temp_code_embeddings (id INT PRIMARY KEY, content TEXT, embedding VECTOR(3));" });
  await mysql.core.writeQuery({ query: "ALTER TABLE temp_code_embeddings ADD FULLTEXT(content);" });

  // 2. Info
  const info = await mysql.vector.info({ table: "temp_code_embeddings" });
  if (!info.success || info.data.columns.length !== 1) failures.push("Info failed");

  // 3. Batch Store
  const batch = await mysql.vector.batchStore({ 
    table: "temp_code_embeddings", 
    column: "embedding", 
    items: [
      { id: 1, vector: [0.1, 0.2, 0.3] },
      { id: 2, vector: [0.9, 0.1, 0.1] }
    ] 
  });
  if (!batch.success || batch.data.count !== 2) failures.push("Batch store failed");

  // Update text
  await mysql.core.writeQuery({ query: "UPDATE temp_code_embeddings SET content = 'machine learning' WHERE id = 1" });
  await mysql.core.writeQuery({ query: "UPDATE temp_code_embeddings SET content = 'deep learning' WHERE id = 2" });

  // 4. Get
  const get = await mysql.vector.get({ table: "temp_code_embeddings", id: 1 });
  if (!get.success || !get.data.vector) failures.push("Get failed");

  // 5. Search
  const search = await mysql.vector.search({ 
    table: "temp_code_embeddings", 
    column: "embedding", 
    queryVector: [0.1, 0.9, 0.1] 
  });
  if (!search.success || search.data.count !== 2) failures.push("Search failed");

  // 6. Hybrid Search
  const hybrid = await mysql.vector.hybridSearch({
    table: "temp_code_embeddings",
    vectorColumn: "embedding",
    textColumn: "content",
    queryText: "learning",
    queryVector: [0.1, 0.2, 0.3]
  });
  if (!hybrid.success || hybrid.data.count === 0) failures.push("Hybrid search failed");

  // 7. Stats
  const stats = await mysql.vector.stats({ table: "temp_code_embeddings", column: "embedding" });
  if (!stats.success || stats.data.totalRows !== 2) failures.push("Stats failed");

  // 8. Delete
  const del = await mysql.vector.delete({ table: "temp_code_embeddings", id: 1 });
  if (!del.success) failures.push("Delete failed");

  // 9. Error handling propagation
  try {
    await mysql.vector.store({ table: "nonexistent", column: "v", id: 1, vector: [1] });
    failures.push("Error didn't propagate for store");
  } catch (e) {
    // Expected
  }
} catch (e) {
  failures.push(`Unhandled error: ${e.message}`);
} finally {
  await mysql.core.writeQuery({ query: "DROP TABLE IF EXISTS temp_code_embeddings" });
}

return { failures, success: failures.length === 0 };
```

Verify it returns `{ success: true, failures: [] }`.

## Post-Test Workflow
If you found any issues or bugs:
1. Fix them directly in the codebase.
2. Ensure you have read `../code-map.md` before making any architectural changes.
3. Update `UNRELEASED.md` with your fixes.
4. Commit your changes (do NOT push).
