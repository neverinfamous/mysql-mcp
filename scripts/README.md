# mysql-mcp Scripts

## Cluster Management

### `reboot-cluster.ps1`

Reboots the InnoDB Cluster after a **complete outage** (all 3 nodes stopped simultaneously, typically after a machine reboot).

**When to use:** The mysql-ecosystem MCP tools return errors like `"super-read-only"` or cluster topology shows all nodes OFFLINE. E2E tests skip write-dependent tests.

**When NOT needed:** Partial outages (single node restart, Docker upgrade) auto-recover via `group_replication_start_on_boot=ON`.

```powershell
# Default: root:root@localhost:3307, cluster name testCluster
.\scripts\reboot-cluster.ps1

# Custom credentials
.\scripts\reboot-cluster.ps1 -User cluster_admin -Password cluster_admin
```

**What it does (5 steps):**

1. Verifies containers `mysql-node1/2/3` are running (starts them if not)
2. Waits for MySQL readiness on the primary
3. Runs `dba.rebootClusterFromCompleteOutage()` via MySQL Shell
4. Rejoins secondaries from inside Docker network (MySQL Shell on Windows can't resolve Docker container hostnames)
5. Verifies cluster status

**Prerequisites:**

- MySQL Shell 9.5+ at `C:\Program Files\MySQL\MySQL Shell 9.5\bin\mysqlsh.exe`
- Docker containers created from `innodb-cluster.yml`

### Diagnosing Cluster Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `super_read_only` errors | GR offline, no primary elected | `.\scripts\reboot-cluster.ps1` |
| E2E tests skip 5 write tests | Same as above | Same as above |
| All topology members OFFLINE | Complete outage (machine reboot) | Same as above |
| Single node MISSING | Node fell out of group | Rejoin: `docker exec mysql-node1 mysqlsh ...` |
| `UNREACHABLE` members after reboot | Docker network not ready | Wait 30s, then reboot script |

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

## Testing & Validation Scripts

These scripts are used to validate MCP server behavior dynamically:

### `test-filter-instructions.mjs`

Starts the server with various `--tool-filter` and `--instruction-level` configurations and verifies that instruction sections (e.g., Code Mode, Help Groups, Active Tools) are properly included or excluded.

```bash
node scripts/test-filter-instructions.mjs
```

### `test-instruction-levels.mjs`

An integration test that compares the payload size of filtered vs. unfiltered instructions, proving token efficiency. Also verifies that excluded tool groups do not appear in the generated instructions.

```bash
node scripts/test-instruction-levels.mjs
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
