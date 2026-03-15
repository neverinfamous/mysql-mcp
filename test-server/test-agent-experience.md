# Agent Experience Test — mysql-mcp

> **Purpose:** Validate that the slim `instructions` field + `mysql://help` resources are sufficient for an agent to operate the server cold — with **zero** schema info, tool hints, or checklists in the prompt.

## How to Run

Run **each pass** as a separate conversation with the corresponding `--tool-filter`. Each pass tests whether the agent can complete realistic tasks using only the tools + help resources available under that filter.

| Pass | `--tool-filter` | Tools | Scenarios |
|------|-----------------|-------|-----------|
| Pass 1 | `starter` | Core, JSON, Trans, Text (~39) | 1–10 |
| Pass 2 | `dev-power` | Core, Schema, Perf, Stats, Fulltext, Trans (~47) | 11–15 |
| Pass 3 | `ai-data` | Core, JSON, Docstore, Text, Fulltext (~46) | 16–19 |
| Pass 4 | `ai-spatial` | Core, Spatial, Stats, Perf, Trans (~44) | 20–22 |
| Pass 5 | `dba-monitor` | Core, Monitoring, Perf, Sysschema, Optimization (~36) | 23–25 |
| Pass 6 | `dba-manage` | Core, Admin, Backup, Replication, Part, Events (~34) | 26–29 |
| Pass 7 | `dba-secure` | Core, Security, Roles, Trans (~33) | 30–32 |
| Pass 8 | `codemode` | Code Mode only (1+3) | 33–35 |
| Pass 9 | `ecosystem` | Cluster, ProxySQL, Router, Shell (~41) | 36–39 |

> **Important:** Do NOT combine passes. Each pass is a fresh conversation with a clean context. The agent has never seen this database before.

## Rules

1. **Do NOT read** `test-tools.md`, `test-group-tools-*.md`, or any other test documentation before running these scenarios
2. **Do NOT read** source code files (`src/`) — you are a user, not a developer
3. **DO** use the MCP instructions you received during initialization + `mysql://help` resources
4. **DO** discover the database schema via `mysql://schema` or `mysql://tables` resources
5. **DO** read group-specific help (`mysql://help/{group}`) when you need reference for unfamiliar tools
6. The test database is already connected (Docker container `mysql-final`, database `testdb`)

## Success Criteria

| Symbol | Meaning |
|--------|---------|
| ✅ | Agent completed the task correctly without external help |
| ⚠️ | Agent completed but needed multiple retries or used wrong tools first |
| ❌ | Agent failed or produced incorrect results |
| 📖 | Agent had to read help resources — note which ones |

Track **every** help resource read and whether it provided what was needed. Gaps are the actionable finding.

## Reporting Format

For each scenario, report:

```
### Scenario N: [title]
**Result:** ✅/⚠️/❌
**Resources read:** mysql://help, mysql://help/json (or "none beyond instructions")
**Tools used:** mysql_read_query, mysql_json_extract, ...
**Issues:** (any gaps in help content, confusing tool names, missing examples)
```

---

## Pass 1: `starter`

**Tool groups under test:** `core` (8), `json` (17), `transactions` (7), `text` (6), `codemode` (1)

### Phase 1 — Discovery

#### Scenario 1 — What's in this database?
List all tables and briefly describe what each one contains, including any JSON columns or special types.

#### Scenario 2 — Table deep dive
Pick the most interesting table and fully characterize it: row count, column types, indexes, constraints, and any JSON column structure.

#### Scenario 3 — Health check
Is the database healthy? What MySQL version is running? Check server health and connection pool status.

### Phase 2 — Core Operations

#### Scenario 4 — Filtered read
Find all products in the "electronics" category priced above $50, sorted by price descending.

#### Scenario 5 — Aggregation
What is the total revenue per order status? Which status has the highest revenue?

#### Scenario 6 — Write and verify
Create a new product called "Test Widget" in the "gadgets" category priced at $29.99, then verify it was inserted. Clean up after.

### Phase 3 — JSON Operations

#### Scenario 7 — JSON extraction
Extract the `name` field from the JSON `doc` column in `test_json_docs`. What keys exist at the top level?

#### Scenario 8 — JSON modification
Set a new field `$.reviewed` to `true` on one JSON document. Verify the change. Clean up after.

#### Scenario 9 — JSON analysis
Analyze the JSON schema of the `metadata` column in `test_json_docs`. What field types and nesting patterns exist?

### Phase 4 — Text Operations

#### Scenario 10 — Text search
Find users whose email addresses match the pattern `%@example.com%` using LIKE search. How many are there?

---

## Pass 2: `dev-power`

**Tool groups under test:** `core` (8), `schema` (10), `performance` (8), `stats` (8), `fulltext` (5), `transactions` (7), `codemode` (1)

### Phase 5 — Statistics & Performance

#### Scenario 11 — Descriptive stats
Compute descriptive statistics (mean, median, std dev, min, max) for the `temperature` column in `test_measurements`. Break it down by `sensor_id`.

#### Scenario 12 — Correlation
Is there a correlation between temperature and humidity in `test_measurements`? How strong?

#### Scenario 13 — Full-text search
Search `test_articles` for articles about "database" using natural language full-text search. Rank by relevance.

#### Scenario 14 — EXPLAIN analysis
Run EXPLAIN on a query joining products and orders. What does the execution plan reveal?

#### Scenario 15 — Schema management
Create a view called `test_view_order_summary` that joins products and orders showing product name, order count, and total revenue. Query it. Clean up after.

---

## Pass 3: `ai-data`

**Tool groups under test:** `core` (8), `json` (17), `docstore` (9), `text` (6), `fulltext` (5), `codemode` (1)

### Phase 6 — Document Store

#### Scenario 16 — Collection discovery
List all document store collections. What structure does `test_documents` have?

#### Scenario 17 — Document operations
Add a new document to a temporary collection, find it, modify it, then clean up.

#### Scenario 18 — SOUNDEX matching
Find users whose names sound like "Jon" using SOUNDEX. What did you find?

#### Scenario 19 — JSON + Fulltext combo
Search articles for "performance" using full-text search, then extract JSON metadata from matching rows in `test_json_docs`. Can the agent combine both approaches?

---

## Pass 4: `ai-spatial`

**Tool groups under test:** `core` (8), `spatial` (12), `stats` (8), `performance` (8), `transactions` (7), `codemode` (1)

### Phase 7 — Spatial Operations

#### Scenario 20 — Distance calculation
What is the distance between New York and Tokyo based on the coordinates in `test_locations`?

#### Scenario 21 — Nearby locations
Find all locations within 5000 km of London. How many are there?

#### Scenario 22 — Spatial stats combo
Compute statistics on the distances between all pairs of locations. What's the average, min, and max distance?

---

## Pass 5: `dba-monitor`

**Tool groups under test:** `core` (8), `monitoring` (7), `performance` (8), `sysschema` (8), `optimization` (4), `codemode` (1)

### Phase 8 — Monitoring & Diagnostics

#### Scenario 23 — Server overview
What are the current active connections, uptime, and InnoDB buffer pool hit rate?

#### Scenario 24 — Sys schema analysis
Analyze the top queries by latency using sys schema. What are the most expensive operations?

#### Scenario 25 — Index recommendations
Pick a table and get index recommendations. Are there any missing indexes that could improve query performance?

---

## Pass 6: `dba-manage`

**Tool groups under test:** `core` (8), `admin` (6), `backup` (4), `replication` (5), `partitioning` (4), `events` (6), `codemode` (1)

### Phase 9 — Admin & Infrastructure

#### Scenario 26 — Table maintenance
Run ANALYZE and OPTIMIZE on `test_products`. What did the operations report?

#### Scenario 27 — Table export
Export the `test_products` table in SQL format with batched INSERT statements. Verify the output.

#### Scenario 28 — Partition inspection
How is `test_partitioned` partitioned? List the partitions and their row counts.

#### Scenario 29 — Event management
Create a one-time event (disabled) called `test_event_cleanup` that runs a simple SELECT. Verify it was created. Clean up after.

---

## Pass 7: `dba-secure`

**Tool groups under test:** `core` (8), `security` (9), `roles` (8), `transactions` (7), `codemode` (1)

### Phase 10 — Security & Roles

#### Scenario 30 — Security audit
Check the SSL status, password validation policy, and identify any columns with potentially sensitive data.

#### Scenario 31 — Role management
Create a role called `test_role_readonly`, grant SELECT privileges on `testdb.*`, then verify the role's grants. Clean up after.

#### Scenario 32 — User privileges
What privileges does the current user have? Can the agent discover this using the security tools?

---

## Pass 8: `codemode`

**Tool groups under test:** `codemode` (1) + built-in resources (3)

### Phase 11 — Code Mode Discovery & Efficiency

#### Scenario 33 — Cold-start Code Mode
Using only `mysql_execute_code`, list all tables, pick one, and run a query against it. Can the agent discover the `mysql.*` API without external help?

#### Scenario 34 — Multi-step workflow
Using only `mysql_execute_code`, find the top 5 products by order count with total revenue — in a single code execution.

#### Scenario 35 — Cross-group orchestration
Using only `mysql_execute_code`, do a full data quality audit: check for NULLs, duplicate entries, orphaned FKs, and table stats — all in one execution. Compare the token efficiency vs individual tool calls.

---

## Pass 9: `ecosystem`

**Tool groups under test:** `cluster` (10), `proxysql` (11), `router` (9), `shell` (10), `codemode` (1)

### Phase 12 — Cluster & Replication Infrastructure

#### Scenario 36 — Group Replication status
Check the Group Replication status. How many members are in the group? What roles do they have (PRIMARY/SECONDARY)?

#### Scenario 37 — InnoDB Cluster inspection
Get the InnoDB Cluster status, list instances, and visualize the topology. Is there a viable switchover candidate? What does the switchover analysis recommend?

### Phase 13 — ProxySQL & Router

#### Scenario 38 — ProxySQL overview
Check ProxySQL status, list backend servers and their hostgroups, and show the top queries by execution count. What query routing rules are configured?

#### Scenario 39 — MySQL Router inspection
List the available Router routes, check metadata cache status, and get route connection stats. Is the Router healthy?

---

## Post-Test Summary

Compile findings across all passes into:

1. **Help resource gaps** — scenarios where help content was missing, incomplete, or misleading
2. **Discovery friction** — cases where the agent struggled to find the right tool or resource
3. **Suggested improvements** — specific additions to `src/constants/server-instructions/*.md`

> **Key metric:** How many of the 39 scenarios did the agent complete on the first try with ≤1 help resource read? This measures whether the instructions + tool descriptions are self-sufficient.
