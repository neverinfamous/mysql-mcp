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
    // Expected DB error
  }
} catch (e) {
  failures.push(`Hybrid edge case error: ${e.message}`);
} finally {
  await mysql.core.writeQuery({ query: "DROP TABLE IF EXISTS stress_vec_hybrid" });
}
return { failures, success: failures.length === 0 };
```
