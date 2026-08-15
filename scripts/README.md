# mysql-mcp Scripts

[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/mysql-mcp)](https://github.com/neverinfamous/mysql-mcp) [![npm](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp) [![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/mysql-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **Value Proposition**
> Accelerate your database orchestration with enterprise-grade reliability. This suite of scripts empowers administrators and AI agents. Manage, validate, and recover the mysql-mcp ecosystem. Deploy InnoDB test clusters easily. Dynamically compile server instructions.

## 🚀 Cluster Management

These scripts manage the InnoDB Cluster topology.

### `test-server/infrastructure/scripts/reboot-cluster.mjs`

Reboots the InnoDB Cluster after a **complete outage**. This means all nodes stopped simultaneously. It typically happens after a machine reboot.

**When to use:** Tools return `"super-read-only"` errors. Cluster topology shows all nodes OFFLINE. E2E tests skip write-dependent tests.

**When NOT needed:** Partial outages (single node restart, Docker upgrade) auto-recover via `group_replication_start_on_boot=ON`.

```bash
# Default: root:root@localhost:3307, cluster name testCluster
node test-server/infrastructure/scripts/reboot-cluster.mjs

# Custom credentials
node test-server/infrastructure/scripts/reboot-cluster.mjs --User cluster_admin --Password cluster_admin
```

**What it does:**

1. Verifies containers `mysql-node1/2/3` are running (starts them if not)
2. Waits for MySQL readiness on the primary
3. Cleans up any test tables lacking a Primary Key (Group Replication requirement)
4. Runs `dba.rebootClusterFromCompleteOutage()` via MySQL Shell
5. Rejoins secondaries from inside Docker network (MySQL Shell on Windows can't resolve Docker container hostnames)
6. Verifies cluster status

**Prerequisites:**

- MySQL Shell 8.4+ or 9.x
- Docker containers created from `innodb-cluster.yml`

### Diagnosing Cluster Issues

| Symptom                            | Cause                            | Fix                                           |
| ---------------------------------- | -------------------------------- | --------------------------------------------- |
| `super_read_only` errors           | GR offline, no primary elected   | `node test-server/infrastructure/scripts/reboot-cluster.mjs`             |
| E2E tests skip write tests       | Same as above                    | Same as above                                 |
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
- Data volumes: `mysql-node1-data-v4`, `mysql-node2-data-v4`, `mysql-node3-data-v4`

## 🛠️ MCP Server Validation

These scripts are used to validate MCP server behavior dynamically:

### `test-server/infrastructure/scripts/reset-database.mjs`

Resets the `testdb` database with fresh seed data. This cleans up test tables before running new tests.
By default, it verifies all tables were created and populated correctly.

```bash
# Reset default test database
node test-server/infrastructure/scripts/reset-database.mjs

# Skip table verification step
node test-server/infrastructure/scripts/reset-database.mjs --SkipVerify

# Target the InnoDB Cluster instead of standalone MySQL
node test-server/infrastructure/scripts/reset-database.mjs --Cluster
```


### `test-zod-errors.mjs`

Starts the server with `--tool-filter +all`. Retrieves schemas for every registered tool. Tests tools with malformed inputs. Ensures `McpServer` interceptor catches Zod parsing exceptions. Formats errors into `VALIDATION_ERROR` payloads. Prevents raw `-32602` SDK errors from leaking to clients.

```bash
node scripts/test-zod-errors.mjs
```

### `test-server/scripts/test-filter-instructions.mjs`

Starts the server with various `--tool-filter` configurations. Verifies instruction sections are slim. Ensures correct `mysql://help/{group}` resources are registered.

```bash
node test-server/scripts/test-filter-instructions.mjs
```

### `test-prompts.mjs`

Tests the prompt generation engine (`prompts/get`). Requests every configured prompt with varying parameters. Validates output messages are populated correctly.

```bash
node scripts/test-prompts.mjs
```

### `test-tool-annotations.mjs`

Validates tools have correct `openWorldHint` annotations in the `tools/list` response. For example, `true` for web tools, `false` for local database tools.

```bash
node scripts/test-tool-annotations.mjs
```

### `test-progress.mjs`

Validates long-running tools correctly emit `notifications/progress` events. This includes `mysql_read_query`, Code Mode (`mysql_execute_code`), maintenance, and backups.

```bash
node scripts/test-progress.mjs
```

### `test-sessions.mjs`

Starts server with HTTP transport and establishes a Streamable HTTP session via the MCP v2 stateless architecture. Validates session lifecycle and explicit teardown. Ensures `activeSessions` metric accuracy on `/health`.

```bash
node scripts/test-sessions.mjs
```

### `test-cli-sessions.mjs`

Tests compiled CLI entrypoint (`dist/cli.js`). Ensures it establishes HTTP sessions and handles calls. Validates it terminates sessions and updates metrics.

```bash
node scripts/test-cli-sessions.mjs
```



### `test-subscriptions-sdk.mjs`

Tests the `resources/subscribe` feature using the official `@modelcontextprotocol/sdk` client.

```bash
node scripts/test-subscriptions-sdk.mjs
```

### `verify-schemas.mjs`

Validates standard database tools properly expose `outputSchema` at protocol level. Allows clients to introspect structured responses.

```bash
node scripts/verify-schemas.mjs
```

### `test-server/infrastructure/scripts/teardown.ts`

Global teardown script for E2E testing. Cleans up test artifacts like SQLite database files. Removes WAL/SHM files generated during test execution.

```bash
npx tsx test-server/infrastructure/scripts/teardown.ts
```

### `test-server/infrastructure/scripts/redis-setup.ts`

Global setup script for E2E testing. Initializes the Redis test container needed for distributed rate limiting tests. Runs automatically via Vitest's `globalSetup`.

```bash
npx tsx test-server/infrastructure/scripts/redis-setup.ts
```

## ⚙️ Maintenance & Architecture



### `generate-server-instructions.ts`

Compiles markdown files from `src/constants/instructions/markdown/*.md` into multiple distinct `src/constants/instructions/*.ts` constants, rather than a single module. Provides MCP server with `mysql://help` resource content.

```bash
pnpm run generate:instructions
```

### `test-server/infrastructure/scripts/update-badges.ts`

Updates test coverage badges in `README.md` and `DOCKER_README.md`. Uses Vitest's JSON coverage summary output. Runs automatically during `npm run test:coverage`.

```bash
npx tsx test-server/infrastructure/scripts/update-badges.ts
```

### `generate-social.mjs`

Generates `social-preview.png` branding asset using Playwright. Ensures a pixel-perfect 1280x640 preview image for GitHub. Incorporates logo and 3-2 badge layout.

```bash
node scripts/generate-social.mjs
```
