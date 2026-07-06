# 🤖 Agent README: mysql-mcp (`io.github.neverinfamous/mysql-mcp`)

> **[System Instruction]** You are reading the `AGENT_README.md` for the `mysql-mcp` repository. This file serves as the master index for autonomous AI agents navigating, auditing, or developing this codebase. 

`mysql-mcp` is an advanced Model Context Protocol (MCP) server providing AI agents with deeply integrated, highly token-optimized access to MySQL. The server implements a dual-transport model (stdio + HTTP), full OAuth 2.1 authentication, and a C++ V8 isolate engine for sandboxed JavaScript execution (Code Mode).

---

## 🗺️ Master Navigation (The Map of Maps)

Do NOT randomly `grep` or guess the repository structure. Use the following references:

| File / Location | Purpose |
|-----------------|---------|
| [test-server/code-map.md](test-server/code-map.md) | **[CRITICAL]** The definitive architectural map. Details directory layout, tool-to-handler mappings, and the typed error class hierarchy. Read this before modifying tools. |
| [test-server/tool-reference.md](test-server/tool-reference.md) | Categorized tool inventory (200+ tools, 28 groups). |
| [src/constants/server-instructions.ts](src/constants/server-instructions.ts) | The compiled instructions sent to connecting clients. Handled dynamically via `mysql://help` resources. |
| [SECURITY.md](SECURITY.md) | Security policy, vulnerability management, and authentication rules. |

---

## 🛠️ Development & Quality Gates

When committing changes to `mysql-mcp`, you **MUST** adhere to the following rules:

1. **Strict Validation**: Always run `pnpm run check` before finalizing tasks. This handles linting, typechecking, Vitest unit tests, and Playwright E2E validations. 
2. **Never Bypass Checks**: Do not use `@ts-ignore`, `eslint-disable`, or `test.skip()`. Hard-fail on security gates. Fix the root cause.
3. **Structured Errors Only**: Handlers must **never** throw raw exceptions (or leak MCP protocol errors). Always wrap failures in the `ErrorResponse` interface using `formatHandlerError()` (e.g., returning `{ success: false, error: "...", code: "NOT_FOUND", category: "query" }`).
4. **Decentralized Zod Schemas**: Input schemas live in `src/adapters/mysql/schemas/`. Do not clutter handler logic with inline schemas. Use the dual-schema pattern (`Base` vs `Preprocess`) to handle parameter aliasing cleanly.

---

## ⚡ Code Mode (`isolated-vm`) Boundary

`mysql_execute_code` operates inside a physically separate C++ V8 isolate. 
- **NO Host Access**: The sandbox blocks `require`, `import`, `process`, and `eval`. 
- **Bridging**: MySQL API calls are injected via native C++ references (`ivm.Reference`). All tool calls from Code Mode flow through the `AuditInterceptor`.
- **Modifications**: When modifying Code Mode (`src/codemode/*`), tread carefully with memory allocation and synchronous timeouts. 

---

## 🧪 Testing Matrices

The repository contains an exhaustive suite of testing environments:

- **E2E & Unit**: `src/__tests__/`, `src/audit/*.test.ts`, and `tests/e2e/`. Run via `pnpm check`.
- **Advanced Agent Testing**:
  - `test-server/test-codemode/`: Code Mode functionality for all tool groups.
  - `test-server/test-advanced/`: Stress testing, sandbox boundary fuzzing, connection saturation.
  - `test-server/test-tool-groups/`: Direct JSON-RPC tool group functionality.
  - `test-server/test-usability/`: Prompt tuning, hallucination reduction.

---

## 🧠 Master Orchestration Context & Customizations

This repository is governed by the broader `neverinfamous` ecosystem orchestrated via the **adamic** repository. If you require environmental context regarding commit strategies, CLI execution, or history retrieval, consult the ecosystem tools:

- **Master Orchestration**: `C:\Users\chris\Desktop\adamic\.agents\AGENT_README.md`
- **CLI Execution Wrapper**: `C:\Users\chris\Desktop\adamic\.agents\scripts\lib-agent-exec\AGENT_README.md` (Explains PowerShell execution boundaries, WSL crossing, and frictionless recovery).
- **Git History**: `C:\Users\chris\Desktop\adamic\.agents\scripts\lib-git-history\AGENT_README.md`

### 💡 Relevant Agent Skills

If available in your workspace customization roots, load these skills (via slash commands or triggers) when performing related work:

- **`/mysql`**: Master schema and configuration guidelines for strict MySQL querying.
- **`/mysql-mcp`**: Architectural guidelines for interacting with this specific server and its Code Mode API.
- **`/mcp-builder`**: Best practices for writing Model Context Protocol servers, transport implementations, and resources.
