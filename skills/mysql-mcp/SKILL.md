---
name: mysql-mcp
version: 1.0.0
tags:
  - "agent-skill"
triggers:
  - mysql-mcp
  - code mode
  - mysql tools
  - tool filter
description: |
  Core guidelines and instruction pointers for the mysql-mcp server. Use when interacting with the mysql-mcp server, configuring tool filtering, using Code Mode (mysql_execute_code), or when you need to review its tools and architecture.
---

# MySQL MCP Server Guidelines

The `mysql-mcp` server is a Model Context Protocol server for MySQL that offers a suite of tools, a C++ V8 sandboxed Code Mode, and telemetry. When operating this server, you MUST rely on its internal documentation to understand its architecture and optimize token usage.

## 1. Context & Architecture Recovery

**\[WHEN\]** you need to understand the server architecture, available tool categories, configuration, or Code Mode mechanics -> **\[ALWAYS\]** read the Code Map:
- `test-server/code-map.md`

**\[WHEN\]** you need specific tool schemas, argument requirements, or usage examples -> **\[ALWAYS\]** read the Tool Reference:
- `test-server/tool-reference.md`

**\[WHEN\]** you need to update or modify the core instructions -> **\[ALWAYS\]** edit the source markdown files and run the generation script:
- `scripts/generate-server-instructions.ts`

## 2. Operational Directives

- **Code Mode Priority**: **\[ALWAYS\]** prefer using `mysql_execute_code` (Code Mode) for multi-step database operations to dramatically reduce token overhead.
- **Code Mode Safety**: Code Mode does **NOT** bypass destructive-operation safety gates. `DROP`, `TRUNCATE`, `DELETE` without `WHERE`, `DROP DATABASE`, `ALTER TABLE ... DROP COLUMN`, and `ALTER TABLE ... RENAME COLUMN` executed inside Code Mode scripts MUST still require explicit user confirmation before the script is submitted.
- **Tool Filtering**: Due to IDE limits, you cannot load all tools at once. **\[ALWAYS\]** use tool filtering (e.g., `--tool-filter starter` or `--tool-filter codemode`) when deploying or instructing the user on setup.
- **Connection Safety**: **\[ALWAYS\]** respect strict schema configurations (like `STRICT_TRANS_TABLES`) and use parameterized queries, even when executing scripts within Code Mode.

## 3. Telemetry & Debugging

- **Datadog Integration**: **\[WHEN\]** debugging MySQL performance, pipeline telemetry, or confirming connection activity -> **\[ALWAYS\]** use the Datadog MCP server (via tools like `query-metrics` or `list-active-metrics`) to inspect `mysql.*` metrics (e.g., `mysql.net.connections`, `mysql.innodb.buffer_pool_utilization`). This is critical for verifying that the database is actively pushing telemetry and not just idling silently.
- **Local Observability (Prometheus/Grafana)**: **\[WHEN\]** debugging local `mysql-mcp` E2E telemetry or the Docker Compose stack -> **\[ALWAYS\]** query the local Prometheus instance (via HTTP at `http://localhost:9090/api/v1/query`) or direct users to the local Grafana dashboard at `http://localhost:3001`. The `mysql-mcp` server natively exposes metrics on its `/metrics` endpoint.

## 4. Performance & Throughput Baselines

When analyzing performance or modifying hot paths, use these baseline benchmark targets:
- `parseToolFilter`: tens of thousands of ops/sec
- `CodeModeSandbox` cold start: millions of ops/sec
- Sandbox dispose: millions of ops/sec
