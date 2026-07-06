# mysql-mcp Scripts

[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/mysql-mcp)](https://github.com/neverinfamous/mysql-mcp) [![npm](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp) [![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/mysql-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

![Coverage](https://img.shields.io/badge/Coverage-90.06%25-green.svg) ![E2E](https://img.shields.io/badge/E2E-471%20passing%20%C2%B7%200%20skipped-blue.svg)

## 💎 Value Proposition

- **Execute complex logic via Code Mode**, reducing token usage by 70-90%.
- **Build AI integrations instantly**.
- **Empower agents with secure database access**.
- **Scale operations with robust connection pooling**.
- **Leverage OAuth 2.1** for enterprise security.

## 🚀 Orchestrate Your Ecosystem

### `reboot-cluster.mjs`

Reboots the InnoDB Cluster after a **complete outage** (all 3 nodes stopped simultaneously, typically after a machine reboot).

**When to use:** The mysql-ecosystem MCP tools return errors like `"super-read-only"` or cluster topology shows all nodes OFFLINE. E2E tests skip write-dependent tests.

**When NOT needed:** Partial outages (single node restart, Docker upgrade) auto-recover via `group_replication_start_on_boot=ON`.

```bash
# Default: root:root@localhost:3307, cluster name testCluster
node scripts/reboot-cluster.mjs

# Custom credentials
node scripts/reboot-cluster.mjs --User cluster_admin --Password cluster_admin
```

**What it does (6 steps):**

1. Verifies containers `mysql-node1/2/3` are running (starts them if not)
2. Waits for MySQL readiness on the primary
3. Cleans up any test tables lacking a Primary Key (Group Replication requirement)
4. Runs `dba.rebootClusterFromCompleteOutage()` via MySQL Shell
5. Rejoins secondaries from inside Docker network (MySQL Shell on Windows can't resolve Docker container hostnames)
6. Verifies cluster status

**Prerequisites:**

- MySQL Shell 9.5+ at `C:\Program Files\MySQL\MySQL Shell 9.5\bin\mysqlsh.exe`
- Docker containers created from `innodb-cluster.yml`

### Diagnosing Cluster Issues

| Symptom                            | Cause                            | Fix                                           |
| ---------------------------------- | -------------------------------- | --------------------------------------------- |
| `super_read_only` errors           | GR offline, no primary elected   | `node scripts/reboot-cluster.mjs`             |
| E2E tests skip 5 write tests       | Same as above                    | Same as above                                 |
| All topology members OFFLINE       | Complete outage (machine reboot) | Same as above                                 |
| Single node MISSING                | Node fell out of group           | Rejoin: `docker exec mysql-node1 mysqlsh ...` |
| `UNREACHABLE` members after reboot | Docker network not ready         | Wait 30s, then reboot script                  |

### Cluster Architecture

```
Ports:  3307 → node1 (PRIMARY)    3308 → node2 (SECONDARY)    3309 → node3 (SECONDARY)
Router: 6446 (RW) / 6447 (RO) / 8443 (REST API)
Config: innodb-cluster.yml (gitignored, local only)
```

### Key Settings

- `group_replication_start_on_boot=ON` — auto-rejoin on container restart
- `group_replication_bootstrap_group=OFF` — no auto-bootstrap (safety)
- Data volumes: `mysql-node1-data`, `mysql-node2-data`, `mysql-node3-data`

## 🛠️ Validate Your Capabilities

These scripts are used to validate MCP server behavior dynamically:

### `reset-database.mjs`

Resets the `testdb` database with fresh seed data. This is typically used to clean up test tables before running a new suite of tests.
By default, it verifies all tables were created and populated correctly.

```bash
# Reset default test database
node scripts/reset-database.mjs

# Skip table verification step
node scripts/reset-database.mjs --SkipVerify

# Target the InnoDB Cluster instead of standalone MySQL
node scripts/reset-database.mjs --Cluster
```

### `seed.ts`

Seeds the test database (`testdb`) with data from `test-server/test-seed.sql`. This is used to quickly inject seed data without running the full `reset-database.mjs` logic.

```bash
npx tsx scripts/seed.ts
```

### `test-zod-errors.mjs`

Starts the MCP server with `--tool-filter +all` and dynamically retrieves the schema for every registered tool. It then hammers each tool with intentionally malformed inputs (e.g., numbers instead of strings) to ensure that the global `McpServer` interceptor correctly catches SDK-level Zod parsing exceptions and formats them into standard `VALIDATION_ERROR` payloads, preventing raw `-32602` SDK errors from leaking to clients.

```bash
node scripts/test-zod-errors.mjs
```

### `test-filter-instructions.mjs`

Starts the server with various `--tool-filter` configurations and verifies that instruction sections are slim and that the correct `mysql://help/{group}` resources are registered based on enabled tool groups.

```bash
node scripts/test-filter-instructions.mjs
```

### `test-prompts.mjs`

Tests the prompt generation engine (`prompts/get`) by requesting every configured prompt (with varying parameters) and validating that the output messages are correctly populated.

```bash
node scripts/test-prompts.mjs
```

### `test-tool-annotations.mjs`

Validates that tools have correct `openWorldHint` annotations (e.g., `openWorldHint=true` for GitHub API tools, `false` for local/core DB tools) in the `tools/list` response.

```bash
node scripts/test-tool-annotations.mjs
```

### `test-progress.mjs`

Validates that tools with long-running operations or streaming capabilities correctly emit `notifications/progress` events back to the client. This includes `mysql_read_query` streaming, Code Mode (`mysql_execute_code`), table maintenance, and backups.

```bash
node scripts/test-progress.mjs
```

### `test-sessions.mjs`

Starts the MCP server with the HTTP transport and establishes an SSE session via the SDK to validate session lifecycle management, idle timeouts, and the `activeSessions` metric accuracy on the `/health` endpoint.

```bash
node scripts/test-sessions.mjs
```

### `test-cli-sessions.mjs`

Tests the compiled CLI entrypoint (`dist/cli.js`) to ensure it correctly establishes HTTP sessions, handles initialize and tool calls, terminates sessions, and updates the `activeSessions` metric properly.

```bash
node scripts/test-cli-sessions.mjs
```



### `test-subscriptions-sdk.mjs`

Tests the `resources/subscribe` feature using the official `@modelcontextprotocol/sdk` client.

```bash
node scripts/test-subscriptions-sdk.mjs
```

### `verify-schemas.mjs`

Validates that all standard database tools properly expose their `outputSchema` at the protocol level, allowing clients to introspect structured responses.

```bash
node scripts/verify-schemas.mjs
```

### `teardown.ts`

A global teardown script for the E2E testing suite. It cleans up test artifacts (such as SQLite database files and WAL/SHM files) generated by the `SystemDb` and Audit logging during test execution.

```bash
npx tsx scripts/teardown.ts
```

## ⚙️ Maintain and Evolve Your Architecture



### `generate-server-instructions.ts`

Automatically builds the `src/constants/server-instructions.ts` TypeScript module by reading and compiling the individual markdown files from `src/constants/server-instructions/*.md`. This provides the MCP server with the `mysql://help` resource content.

```bash
npm run generate:instructions
```


### `update-badges.ts`

Automatically updates test coverage badges in `README.md` and `DOCKER_README.md` based on Vitest's JSON coverage summary output. This script is run automatically as part of `npm run test:coverage`.

```bash
npx tsx scripts/update-badges.ts
```

### `generate-social.mjs`

Generates the `social-preview.png` branding asset using Playwright and standard web technologies (HTML/CSS) to ensure a consistent, pixel-perfect 1280x640 preview image for GitHub, incorporating the Adamic logo and 3-2 grid badge layout.

```bash
node scripts/generate-social.mjs
```
