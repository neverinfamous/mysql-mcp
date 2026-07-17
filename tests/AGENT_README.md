# 🤖 Agent Testing Guidelines

This repository uses **Playwright** as its test runner for end-to-end payload contract testing. 

If you are an autonomous agent asked to add, fix, or debug a test in this directory, **you MUST follow these domain-specific conventions** to avoid polluting the database or writing redundant boilerplate.

---

## 1. Execution

To run a specific test file, do **NOT** run the entire suite. Target the exact file using `pnpm`:

```bash
# Correct way to run a single test file
pnpm exec playwright test tests/e2e/auth.spec.ts
```

*Note: Never run tests with `continue-on-error: true` or bypass failures. Always fix the root cause of failing tests.*

---

## 2. Server Lifecycle & Helpers

Do not hallucinate your own server spawning or client connection logic. All tests must reuse the official utilities found in `tests/e2e/helpers.ts`.

### Starting and Stopping the Server
Tests usually spin up their own isolated instance of the MCP server using `startServer` (which spawns `node dist/cli.js`) to test specific CLI flags. 

```typescript
import { startServer, stopServer, createClient } from "./helpers.js";

const PORT = 3005;

test.beforeAll(async () => {
  // Spawns the server on PORT 3005 with specific filters
  await startServer(PORT, ["--tool-filter", "core"]);
});

test.afterAll(() => {
  stopServer(PORT);
});
```

### Calling Tools and Asserting
Use `callToolAndParse` to automatically extract the structured JSON payload, and `expectSuccess` or `expectHandlerError` to assert standard MCP responses.

```typescript
import { callToolAndParse, expectSuccess, expectHandlerError } from "./helpers.js";

test("validates success", async () => {
  const client = await createClient(`http://localhost:${PORT}`);
  const payload = await callToolAndParse(client, "mysql_list_tables");
  
  // Standard assertion for { success: true }
  expectSuccess(payload);
});
```

---

## 3. State Management & Side Effects

The tests run against a live local database. Depending on your environment, this defaults to `mysql://root:root@localhost:3306/testdb` for Standalone setups, or `mysql://root:root@localhost:3307/testdb` for Cluster (`mysql-node1`) setups. Use the appropriate `MYSQL_TEST_URL`.

- **Do NOT pollute `testdb`**: If your test creates tables, inserts rows, or modifies schema, you must isolate it within a transaction or explicitly drop the tables in a `test.afterAll` block.
- **Audit File Cleanup**: If you test the `--audit-log` functionality, you MUST call `cleanupAuditFiles(logPath)` in your teardown block to prevent leftover SQLite WAL/SHM files from causing locking errors in subsequent test runs.
- **Global Reset**: If a test irrecoverably corrupts the test database, you can instruct the user to run `node test-server/infrastructure/scripts/reset-database.mjs` to rebuild the schema from scratch.
- **Server Instructions**: If you modify any markdown files in `src/constants/instructions/markdown/`, you MUST compile them by running `pnpm run generate:instructions` before testing, or the MCP server will run with stale `mysql://help` resources.

---

## 4. TypeScript Strictness

When writing tests, remember the global project rules:
- **No `any`**: Use `unknown` and type guards (or `Record<string, unknown>`).
- **No structural type assertions**: Never use `(obj as Record<string, unknown>)[key]`. Instead, use the `in` operator or `keyof typeof`.
- **Zod Boundaries**: Rely on Zod for payload shaping, do not write secondary manual validation loops.
