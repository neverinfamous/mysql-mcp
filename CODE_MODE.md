# Code Mode

**Execute multi-step MySQL workflows in a single tool call.**

Code Mode (`mysql_execute_code`) runs JavaScript/TypeScript code in a sandboxed VM with full access to all 192 MySQL tools via the `mysql.*` API namespace. Instead of chaining dozens of sequential tool calls, write a single script that queries, transforms, and acts on your data.

---

## When to Use Code Mode

| Scenario                     | Without Code Mode                          | With Code Mode                         |
| ---------------------------- | ------------------------------------------ | -------------------------------------- |
| Multi-step data pipeline     | 5-10 sequential tool calls                 | 1 `mysql_execute_code` call            |
| Conditional branching        | Agent decides after each tool result       | `if/else` logic in one script          |
| Cross-table aggregation      | Multiple reads + manual aggregation        | Loop and aggregate in JS               |
| Schema migration with checks | Describe → check → alter → verify sequence | Single script with error handling      |
| Batch operations             | Repeated tool calls per item               | `for` loop over items in one execution |

**Rule of thumb**: If a task requires **3+ sequential tool calls** or **conditional logic based on query results**, use Code Mode.

---

## Tool Reference

### `mysql_execute_code`

| Parameter | Type   | Required | Description                              |
| --------- | ------ | -------- | ---------------------------------------- |
| `code`    | string | ✅       | JavaScript/TypeScript code to execute    |
| `timeout` | number | ❌       | Execution timeout in ms (default: 30000) |

**Scope**: Requires `admin` scope.

**Returns**: The value of the last expression in the code block, wrapped in an execution result with timing and memory metrics.

---

## API Namespace

The `mysql` global object exposes **24 tool groups** as sub-objects:

| Group                | Tools | Description                              |
| -------------------- | ----- | ---------------------------------------- |
| `mysql.core`         | 8     | Read/write queries, tables, indexes      |
| `mysql.transactions` | 7     | BEGIN, COMMIT, ROLLBACK, savepoints      |
| `mysql.json`         | 17    | JSON functions, merge, diff, stats       |
| `mysql.text`         | 6     | REGEXP, LIKE, SOUNDEX                    |
| `mysql.fulltext`     | 5     | Natural language & boolean search        |
| `mysql.performance`  | 8     | EXPLAIN, query analysis, slow queries    |
| `mysql.optimization` | 4     | Index hints, recommendations             |
| `mysql.admin`        | 6     | OPTIMIZE, ANALYZE, CHECK                 |
| `mysql.monitoring`   | 7     | PROCESSLIST, status variables            |
| `mysql.backup`       | 4     | Export, import, mysqldump                |
| `mysql.replication`  | 5     | Master/slave, binlog                     |
| `mysql.partitioning` | 4     | Partition management                     |
| `mysql.schema`       | 10    | Views, procedures, triggers, constraints |
| `mysql.shell`        | 10    | MySQL Shell utilities                    |
| `mysql.events`       | 6     | Event Scheduler management               |
| `mysql.sysschema`    | 8     | sys schema diagnostics                   |
| `mysql.stats`        | 8     | Statistical analysis tools               |
| `mysql.spatial`      | 12    | Spatial/GIS operations                   |
| `mysql.security`     | 9     | Audit, SSL, encryption, masking          |
| `mysql.roles`        | 8     | MySQL 8.0 role management                |
| `mysql.docstore`     | 9     | Document Store collections               |
| `mysql.cluster`      | 10    | Group Replication, InnoDB Cluster        |
| `mysql.proxysql`     | 12    | ProxySQL management                      |
| `mysql.router`       | 9     | MySQL Router REST API                    |

### Method Naming Convention

Tool names map to methods by stripping the group prefix and converting to camelCase:

```
mysql_read_query      → mysql.core.readQuery()
mysql_json_extract    → mysql.json.extract()
mysql_describe_table  → mysql.core.describeTable()
mysql_spatial_point   → mysql.spatial.point()
mysql_show_processlist → mysql.monitoring.showProcesslist()
```

### Positional Shorthand

Common tools accept positional arguments for convenience:

```javascript
// Object form
mysql.core.readQuery({
  query: "SELECT * FROM users WHERE id = ?",
  params: [1],
});

// Positional shorthand
mysql.core.readQuery("SELECT * FROM users WHERE id = ?", [1]);
```

### Discovery

```javascript
// List all groups and their methods
mysql.help();

// Group-specific help with examples
mysql.core.help();
mysql.json.help();
mysql.transactions.help();
```

---

## Usage Examples

### Basic: Multi-Step Data Pipeline

```javascript
// Get table stats, identify large tables, and analyze their indexes
const tables = await mysql.core.readQuery(
  "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_rows DESC LIMIT 5",
);

const results = [];
for (const table of tables.rows) {
  const indexes = await mysql.core.getIndexes({ table: table.table_name });
  const stats = await mysql.performance.tableStats({ table: table.table_name });
  results.push({
    table: table.table_name,
    rows: table.table_rows,
    indexCount: indexes.indexes?.length || 0,
    stats,
  });
}
results;
```

### Conditional Logic

```javascript
// Check if a column exists before adding it
const desc = await mysql.core.describeTable({ table: "users" });
const hasEmail = desc.columns.some((c) => c.Field === "email_verified");

if (!hasEmail) {
  await mysql.core.writeQuery({
    query: "ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0",
  });
  ("Column added");
} else {
  ("Column already exists");
}
```

### Transactions with Error Handling

```javascript
// Atomic transfer between accounts
const tx = await mysql.transactions.begin();
try {
  await mysql.core.writeQuery({
    query: "UPDATE accounts SET balance = balance - ? WHERE id = ?",
    params: [100, 1],
    transactionId: tx.transactionId,
  });
  await mysql.core.writeQuery({
    query: "UPDATE accounts SET balance = balance + ? WHERE id = ?",
    params: [100, 2],
    transactionId: tx.transactionId,
  });
  await mysql.transactions.commit({ transactionId: tx.transactionId });
  ("Transfer complete");
} catch (e) {
  await mysql.transactions.rollback({ transactionId: tx.transactionId });
  `Transfer failed: ${e.message}`;
}
```

### Cross-Group Aggregation

```javascript
// Comprehensive database health check
const [health, pool, processlist, variables] = await Promise.all([
  mysql.monitoring.serverHealth(),
  mysql.monitoring.poolStats(),
  mysql.monitoring.showProcesslist({ full: false }),
  mysql.monitoring.showStatus({ like: "%Threads%" }),
]);

({
  serverVersion: health.version,
  uptime: health.uptime,
  activeConnections: pool.active,
  idleConnections: pool.idle,
  runningQueries:
    processlist.processes?.filter((p) => p.Command === "Query").length || 0,
  threadMetrics: variables.variables,
});
```

---

## Security & Sandbox

### Isolation

Code runs in an **isolated VM sandbox** (Node.js `vm` module) with no access to:

- File system (`fs`, `path`, `os`)
- Network (`http`, `https`, `net`, `fetch`)
- Process control (`process`, `child_process`)
- Module system (`require`, `import`)

### Blocked Patterns

The following patterns are detected and rejected **before execution**:

| Pattern             | Reason                    |
| ------------------- | ------------------------- |
| `require(...)`      | Module loading            |
| `import ...`        | ES module imports         |
| `process.`          | Process access            |
| `eval(...)`         | Dynamic code execution    |
| `new Function(...)` | Dynamic function creation |
| `__dirname`         | File system path access   |
| `__filename`        | File system path access   |

### Rate Limiting

Code Mode is rate-limited to prevent abuse. Excessive calls within a short window will return an error with a retry-after suggestion.

### Transaction Cleanup

Any transactions opened during code execution but **not explicitly committed** are automatically rolled back when execution completes. This prevents orphaned locks.

### Timeout

Default execution timeout is **30 seconds**. Use the `timeout` parameter to adjust for long-running operations.

---

## Tips

1. **Use `await`** — All `mysql.*` methods return Promises.
2. **Return values** — The last expression in your code is returned as the result.
3. **Error handling** — Wrap operations in `try/catch` for graceful error handling.
4. **Parallel queries** — Use `Promise.all()` for independent queries to reduce execution time.
5. **Transaction safety** — Always use `try/catch/finally` with transactions to ensure cleanup.
6. **Help system** — Call `mysql.help()` or `mysql.<group>.help()` to discover available methods.
