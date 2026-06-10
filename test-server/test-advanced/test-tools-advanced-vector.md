# mysql-mcp Advanced Stress Tests: [vector]

## Essential Instructions
1. Prerequisite: The standard Code Mode tests (`test-tool-group-codemode-vector.md`) MUST pass before running these.
2. Run these tests EXCLUSIVELY using the `mysql_execute_code` tool.
3. You must use `--tool-filter codemode` when starting the server.
4. Ensure the database is freshly seeded using `../reset-database.ps1`.
5. Tables created here must be prefixed with `stress_*`.
6. Drop all `stress_*` tables at the end.

## Reporting Format
- `❌ Fail` - System failure or incorrect result
- `⚠️ Issue` - Poor error message or performance concern
- `📦 Payload` - Output too large

---

## Category 1: Boundary Values

```javascript
const failures = [];
await mysql.core.writeQuery({ query: "CREATE TABLE stress_vec_bounds (id INT PRIMARY KEY, vec VECTOR(1000));" });

try {
  // Test: Maximum dimensions (MySQL allows up to 16383, we test 1000)
  const maxDimVec = Array(1000).fill(0.5);
  await mysql.vector.store({ table: "stress_vec_bounds", column: "vec", id: 1, vector: maxDimVec });
  
  // Test: Empty items array in batchStore
  try {
    await mysql.vector.batchStore({ table: "stress_vec_bounds", column: "vec", items: [] });
    failures.push("Batch store didn't reject empty array");
  } catch (e) {
    // Expected Zod error
  }
} catch (e) {
  failures.push(`Bounds error: ${e.message}`);
} finally {
  await mysql.core.writeQuery({ query: "DROP TABLE IF EXISTS stress_vec_bounds" });
}
return { failures, success: failures.length === 0 };
```

## Category 2: Metric Consistency

```javascript
const failures = [];
await mysql.core.writeQuery({ query: "CREATE TABLE stress_vec_metrics (id INT PRIMARY KEY, vec VECTOR(3));" });

try {
  await mysql.vector.batchStore({
    table: "stress_vec_metrics",
    column: "vec",
    items: [
      { id: 1, vector: [1, 0, 0] },
      { id: 2, vector: [0, 1, 0] },
      { id: 3, vector: [0.9, 0.1, 0] }
    ]
  });

  const queryVector = [1, 0, 0];
  
  const cos = await mysql.vector.search({ table: "stress_vec_metrics", column: "vec", queryVector, metric: "COSINE" });
  const euc = await mysql.vector.search({ table: "stress_vec_metrics", column: "vec", queryVector, metric: "EUCLIDEAN" });
  
  // ID 1 should always be distance 0
  if (cos.data.results[0].id !== 1 || euc.data.results[0].id !== 1) {
    failures.push("Metric consistency failed: Identity not closest");
  }
  
  // ID 3 should be closer than ID 2 for [1,0,0]
  if (cos.data.results[1].id !== 3 || euc.data.results[1].id !== 3) {
    failures.push("Metric consistency failed: Relative ordering incorrect");
  }

} catch (e) {
  failures.push(`Metrics error: ${e.message}`);
} finally {
  await mysql.core.writeQuery({ query: "DROP TABLE IF EXISTS stress_vec_metrics" });
}
return { failures, success: failures.length === 0 };
```

## Category 3: Idempotency & Concurrency

```javascript
const failures = [];
await mysql.core.writeQuery({ query: "CREATE TABLE stress_vec_idem (id INT PRIMARY KEY, vec VECTOR(2));" });

try {
  // Test: Repeated store with same ID (upsert behavior)
  await mysql.vector.store({ table: "stress_vec_idem", column: "vec", id: 1, vector: [1, 1] });
  await mysql.vector.store({ table: "stress_vec_idem", column: "vec", id: 1, vector: [2, 2] });
  
  const get = await mysql.vector.get({ table: "stress_vec_idem", id: 1 });
  if (get.data.vector[0] !== 2) failures.push("Upsert failed idempotency check");

  // Test: Repeated delete
  await mysql.vector.delete({ table: "stress_vec_idem", id: 1 });
  const del2 = await mysql.vector.delete({ table: "stress_vec_idem", id: 1 });
  if (del2.success) failures.push("Second delete should fail gracefully with NOT_FOUND");

} catch (e) {
  failures.push(`Idempotency error: ${e.message}`);
} finally {
  await mysql.core.writeQuery({ query: "DROP TABLE IF EXISTS stress_vec_idem" });
}
return { failures, success: failures.length === 0 };
```

## Category 4: Hybrid Search Edge Cases

```javascript
const failures = [];
await mysql.core.writeQuery({ query: "CREATE TABLE stress_vec_hybrid (id INT PRIMARY KEY, txt TEXT, vec VECTOR(2));" });

try {
  // Test: Hybrid search on table WITHOUT fulltext index
  try {
    await mysql.vector.hybridSearch({ 
      table: "stress_vec_hybrid", 
      vectorColumn: "vec", 
      textColumn: "txt", 
      queryText: "test" 
    });
    failures.push("Hybrid search should fail cleanly when no fulltext index exists");
  } catch (e) {
    if (e.code !== "FULLTEXT_INDEX_MISSING") failures.push("Expected FULLTEXT_INDEX_MISSING code");
  }
} catch (e) {
  failures.push(`Hybrid edge case error: ${e.message}`);
} finally {
  await mysql.core.writeQuery({ query: "DROP TABLE IF EXISTS stress_vec_hybrid" });
}
return { failures, success: failures.length === 0 };
```

## Category 5: Hybrid Search Parity

```javascript
const failures = [];
await mysql.core.writeQuery({ query: "CREATE TABLE stress_hybrid_parity (id INT PRIMARY KEY, category VARCHAR(50), txt TEXT, vec VECTOR(2));" });
await mysql.core.writeQuery({ query: "ALTER TABLE stress_hybrid_parity ADD FULLTEXT(txt);" });

try {
  await mysql.vector.batchStore({
    table: "stress_hybrid_parity",
    column: "vec",
    items: [
      { id: 1, vector: [1, 0] },
      { id: 2, vector: [0, 1] },
      { id: 3, vector: [0.7, 0.7] }
    ]
  });
  await mysql.core.writeQuery({ query: "UPDATE stress_hybrid_parity SET txt = 'exact match', category = 'A' WHERE id = 1" });
  await mysql.core.writeQuery({ query: "UPDATE stress_hybrid_parity SET txt = 'partial match', category = 'B' WHERE id = 2" });
  await mysql.core.writeQuery({ query: "UPDATE stress_hybrid_parity SET txt = 'exact match', category = 'B' WHERE id = 3" });

  const queryVector = [0, 1]; // favors id 2
  const queryText = "exact match"; // favors id 1 and 3

  // 1. Weight Dominance
  const textDominant = await mysql.vector.hybridSearch({ table: "stress_hybrid_parity", vectorColumn: "vec", textColumn: "txt", queryVector, queryText, textWeight: 1.0, vectorWeight: 0.0 });
  const vecDominant = await mysql.vector.hybridSearch({ table: "stress_hybrid_parity", vectorColumn: "vec", textColumn: "txt", queryVector, queryText, textWeight: 0.0, vectorWeight: 1.0 });
  if (textDominant.data.results[0].id === 2) failures.push("Text dominance failed (ID 2 should not win text search)");
  if (vecDominant.data.results[0].id !== 2) failures.push("Vector dominance failed (ID 2 should win vector search)");

  // 2. rrfK Sensitivity
  const rrfSmall = await mysql.vector.hybridSearch({ table: "stress_hybrid_parity", vectorColumn: "vec", textColumn: "txt", queryVector, queryText, rrfK: 1 });
  const rrfLarge = await mysql.vector.hybridSearch({ table: "stress_hybrid_parity", vectorColumn: "vec", textColumn: "txt", queryVector, queryText, rrfK: 1000 });
  if (!rrfSmall.success || !rrfLarge.success) failures.push("rrfK bounds handling failed");
  if (rrfSmall.data.results[0].combined_score === rrfLarge.data.results[0].combined_score) failures.push("rrfK did not affect score spread");

  // 3. All 3 metrics
  for (const metric of ["COSINE", "EUCLIDEAN", "DOT"]) {
    const mTest = await mysql.vector.hybridSearch({ table: "stress_hybrid_parity", vectorColumn: "vec", textColumn: "txt", queryVector, queryText, metric });
    if (!mTest.success) failures.push(`Metric ${metric} failed in hybrid search`);
  }

  // 4. Empty filter handling
  const emptyFilter = await mysql.vector.hybridSearch({ table: "stress_hybrid_parity", vectorColumn: "vec", textColumn: "txt", queryVector, queryText, filter: "" });
  if (!emptyFilter.success) failures.push("Empty filter string failed");

  // 5. Pre-filter leak detection
  const filterLeak = await mysql.vector.hybridSearch({ table: "stress_hybrid_parity", vectorColumn: "vec", textColumn: "txt", queryVector, queryText, filter: "category = 'B'" });
  if (filterLeak.data.results.some(r => r.category !== 'B')) failures.push("Filter leak: Returned row not matching WHERE clause");
  if (filterLeak.data.count !== 2) failures.push("Filter count incorrect");

  // 6. Select column leak detection
  const selectLeak = await mysql.vector.hybridSearch({ table: "stress_hybrid_parity", vectorColumn: "vec", textColumn: "txt", queryVector, queryText, select: ["id"] });
  if (selectLeak.data.results[0].category !== undefined || selectLeak.data.results[0].txt !== undefined) failures.push("Select leak: Returned unrequested columns");

  // 7. Sanitization Stress
  const giantInput = "word ".repeat(200) + ") OR 1=1; DROP TABLE stress_hybrid_parity; --";
  const sanitizeStress = await mysql.vector.hybridSearch({ table: "stress_hybrid_parity", vectorColumn: "vec", textColumn: "txt", queryVector, queryText: giantInput });
  if (!sanitizeStress.success) failures.push("Sanitization stress failed (crashed on 1000+ char malicious FTS input)");

} catch (e) {
  failures.push(`Hybrid parity error: ${e.message}`);
} finally {
  await mysql.core.writeQuery({ query: "DROP TABLE IF EXISTS stress_hybrid_parity" });
}
return { failures, success: failures.length === 0 };
```
