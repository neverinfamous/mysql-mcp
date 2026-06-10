# Vector Tools (`mysql_vector_*`)

- **Version gate**: ALL vector tools require MySQL 9.0+. Returns `{ success: false, code: "EXTENSION_MISSING" }` on older versions. `mysql_vector_create_index` requires MySQL 9.1+ specifically.
- **Store**: `mysql_vector_store({ table, column, id, vector: number[] })` → upserts a single vector. Uses `STRING_TO_VECTOR()` internally. Dimensions must match the column's `VECTOR(N)` definition.
- **Batch store**: `mysql_vector_batch_store({ table, column, items: [{ id, vector }] })` → bulk insert. Significantly faster than individual stores. All vectors must have matching dimensions.
- **Delete**: `mysql_vector_delete({ table, id })` → deletes by primary key. Returns `{ success: false, error }` if row doesn't exist (P154).
- **Get**: `mysql_vector_get({ table, id })` → retrieves vector as `number[]` via `VECTOR_TO_STRING()`. Returns `{ exists: false }` if row doesn't exist.
- **KNN search**: `mysql_vector_search({ table, column, queryVector, k?, metric? })` → top-k nearest neighbors. Metrics: `COSINE` (default), `EUCLIDEAN`, `DOT`. Use `filter` for WHERE clause conditions.
- **Range search**: `mysql_vector_range_search({ table, column, queryVector, maxDistance })` → all vectors within distance threshold. Default limit: 50.
- **Hybrid search**: `mysql_vector_hybrid_search({ table, vectorColumn, textColumn, queryVector?, queryText? })` → combines DISTANCE() + MATCH...AGAINST via RRF. Requires FULLTEXT index on `textColumn`. At least one of `queryVector` or `queryText` required.
- **Info**: `mysql_vector_info({ table })` → lists all VECTOR columns with dimensions, row counts, index status. Use this first to check compatibility.
- **Create index**: `mysql_vector_create_index({ table, column })` → creates HNSW vector index (MySQL 9.1+ only). Speeds up KNN search significantly on large tables.
- **Optimize**: `mysql_vector_optimize({ table })` → runs `ANALYZE TABLE` to update vector index statistics.
- **Stats**: `mysql_vector_stats({ table, column })` → dimension count, vector count, null count, sample distance distribution.
- ❌ Don't store raw text in VECTOR columns — convert embeddings to `number[]` first.
- ❌ Don't mix dimensions within the same column — all vectors must have the same dimensionality.
- ✅ Always use `mysql_vector_info` to verify a table has VECTOR columns before attempting operations.
- ✅ Use `COSINE` metric for normalized embeddings (most common for OpenAI, Cohere, etc.).
