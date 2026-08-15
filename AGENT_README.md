# 🤖 Agent README: mysql-mcp (`io.github.neverinfamous/mysql-mcp`)

> **[System Instruction]** You are reading the `AGENT_README.md` for the `mysql-mcp` repository. This file serves as the master index for autonomous AI agents navigating, auditing, or developing this codebase. 

`mysql-mcp` is a Model Context Protocol (MCP) server providing AI agents with access to MySQL. The server implements stdio and HTTP transports (supporting MCP v2 stateless architecture via NodeStreamableHTTPServerTransport), full OAuth 2.1 authentication, and a C++ V8 isolate engine for sandboxed JavaScript execution (Code Mode).

---

## 🗺️ Master Navigation

Do NOT randomly `grep` or guess the repository structure. Use the following references:

| File / Location | Purpose |
|-----------------|---------|
| [test-server/code-map.md](test-server/code-map.md) | **[CRITICAL]** Architectural map. Details directory layout, tool-to-handler mappings, and the typed error class hierarchy. Read this before modifying tools. |
| [test-server/tool-reference.md](test-server/tool-reference.md) | Categorized tool inventory mapping functional groups. |
| [src/constants/instructions/markdown/](src/constants/instructions/markdown/) | The source markdown files for the compiled instructions sent to connecting clients. Handled dynamically via `mysql://help` resources. |
| [SECURITY.md](SECURITY.md) | Security policy, vulnerability management, and authentication rules. |
| [skills/AGENT_README.md](skills/AGENT_README.md) | The modular skill suite instructions for AI assistants. |

---

## 🛠️ Development & Quality Gates

When committing changes to `mysql-mcp`, you **MUST** adhere to the following rules:

1. **Strict Validation**: Always run `pnpm run lint`, `pnpm run typecheck`, and targeted tests before finalizing tasks. This handles linting, typechecking, building, Vitest unit tests, and Playwright E2E validations. 
2. **Never Bypass Checks**: Do not use `@ts-ignore`, `eslint-disable`, or `test.skip()`. Hard-fail on security gates. Fix the root cause.
3. **Structured Errors Only**: Handlers must **never** throw raw exceptions (or leak MCP protocol errors). Always wrap failures in the `ErrorResponse` interface using `formatHandlerErrorResponse()` (e.g., returning `{ success: false, error: "...", code: "NOT_FOUND", category: "query", suggestion: "...", recoverable: true }`).
4. **Decentralized Zod Schemas**: Input schemas live in `src/adapters/mysql/schemas/`. Do not clutter handler logic with inline schemas. Use the dual-schema pattern (`Base` vs `Preprocess`) to handle parameter aliasing cleanly.
5. **Exporter Audit Log Configuration**: Primary MCP server writes to mcp-audit.jsonl. Grafana Alloy ingests mcp-audit.jsonl and routes to Loki. Exporter reads from mcp-audit.jsonl via AUDIT_LOG_PATH to compute metrics. Exporter isolates its own writes by setting `--audit-log` to exporter-audit.jsonl.

## 🐚 MySQL Shell Integration (mysqlsh)

The `mysql-mcp` server natively exposes MySQL Shell functionality to agents.
- **Environment Variable**: Configure the shell port using `MYSQL_XPORT: "33060"` (or your custom port).
- **Available Tools**: `mysqlsh_version`, `mysqlsh_check_upgrade`, `mysqlsh_export_table`, `mysqlsh_dump_instance`, `mysqlsh_dump_schemas`, `mysqlsh_dump_tables`, `mysqlsh_import_table`, `mysqlsh_import_json`, `mysqlsh_load_dump`, `mysqlsh_run_script`.

---

## ⚡ Code Mode (`isolated-vm`) Boundary

`mysql_execute_code` operates inside a physically separate C++ V8 isolate. 
- **NO Host Access**: The sandbox blocks `require`, `import`, `process`, and `eval`. 
- **Bridging**: MySQL API calls are injected via native C++ references (`ivm.Reference`). All tool calls from Code Mode flow through the `AuditInterceptor`.
- **Modifications**: When modifying Code Mode (`src/codemode/*`), tread carefully with memory allocation and synchronous timeouts. 

---

## 🧪 Testing Matrices

The repository contains these testing environments:

- **E2E & Unit**: `src/__tests__/`, `src/audit/*.test.ts`, and `tests/e2e/`. Run via `pnpm run check`.
- **Advanced Agent Testing**:
  - `test-server/test-advanced/`: Stress testing, sandbox boundary fuzzing, connection saturation.
  - `test-server/test-tool-groups/`: Direct JSON-RPC tool group functionality.
  - `test-server/test-usability/`: Prompt tuning, hallucination reduction.
  - `test-server/test-usability-direct/`: Direct tool invocation usability and schema fuzzing.
  > 🛑 **CRITICAL RULE:** `test-server/scripts/test-manifest.ts` is the single source of truth generating all markdown tests in the folders above via the `generate-tests.ts` engine. Manual editing of the generated test files is **STRICTLY FORBIDDEN**.

---

## 💡 Relevant Agent Skills

If available in your workspace customization roots, load these skills (via slash commands or triggers) when performing related work:

- **`/mysql`**: Master schema and configuration guidelines for strict MySQL querying.
- **`/mysql-mcp`**: Architectural guidelines for interacting with this specific server and its Code Mode API.
- **`/mysql-router`**: Guidelines for MySQL Router.
- **`/mysqlsh`**: Guidelines for MySQL Shell.
- **`/proxysql`**: Guidelines for ProxySQL.
- **`/mysql-mcp-infrastructure`**: Guidelines for infrastructure.
- **`/datadog`**: Guidelines for Datadog observability.
- **`/opentelemetry`**: Guidelines for OpenTelemetry.
