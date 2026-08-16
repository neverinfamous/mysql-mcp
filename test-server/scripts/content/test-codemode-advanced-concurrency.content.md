## Group Focus: concurrency

This document provides testing instructions to validate the server's connection pool and query queuing behavior under high concurrency using Code Mode.

## Tasks

### 1. Promise.all() Connection Saturation
- Use `mysql_execute_code` to execute 50 concurrent `SELECT SLEEP(1)` or similar lightweight queries via `Promise.all()`.
- Verify the server handles the queue gracefully (e.g., executing them in batches according to the connection pool limit, typically 10 or 20) without throwing `ECONNREFUSED` or `Too many connections` errors.
- Ensure the total execution time reflects the connection pool limit (e.g., 50 queries with a pool of 10 should take ~5 seconds).

### 2. Mixed Workload Concurrency
- Use `Promise.all()` to execute a mix of reads (`SELECT`) and writes (`INSERT`, `UPDATE`) on a test table concurrently (e.g., 20 reads, 20 writes).
- **CRITICAL:** Ensure `UPDATE` queries are strictly targeted to individual specific rows (e.g. `UPDATE table SET val = val + 1 WHERE id = 1`) rather than blanket conditions (`WHERE id > 0`). Blanket updates executed concurrently will trigger InnoDB gap locks, causing deliberate lock wait timeouts and stalling the test.
- Verify all operations succeed and no deadlocks or connection drops occur.

### 3. Connection Leak Prevention
- Deliberately execute a code snippet that throws an error midway through a transaction or concurrent batch.
- **CRITICAL**: When the code throws an error, the `mysql_execute_code` tool will legitimately return an `ERROR` status (`EXECUTION_ERROR`). This is EXPECTED behavior. Acknowledge the error, ensure your agent loop doesn't get stuck, and proceed to run a subsequent query to ensure the pool hasn't been exhausted.
