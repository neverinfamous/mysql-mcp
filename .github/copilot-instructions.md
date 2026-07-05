# mysql-mcp — Copilot Code Review Context

[![npm version](https://img.shields.io/npm/v/mysql-mcp.svg)](https://npmjs.org/package/mysql-mcp) [![License](https://img.shields.io/npm/l/mysql-mcp.svg)](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Protocol-purple.svg)](https://modelcontextprotocol.io/) [![Docker Support](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

## Value Proposition
Build AI integrations instantly.
Empower agents with secure database access.
Execute complex logic via Code Mode.
Scale operations with robust connection pooling.
Leverage OAuth 2.1 for enterprise security.

## Project Overview

mysql-mcp is the premier TypeScript MCP server for MySQL. It empowers LLMs with 241 tools, 22 resources, and 19 prompts.
> **Architectural Rule:** Tool filtering allows skipping the MySQL connection if only ecosystem tools (`router`, `proxysql`, `shell`) are used.

**Architecture & Capabilities**:
- **Execution**: Code Mode (`mysql_execute_code`) dramatically reduces token usage (70–90%).
- **Cache**: `METADATA_CACHE_TTL_MS` is the cache TTL (default 30000).
- **Payload**: `CODE_MODE_MAX_RESULT_SIZE` sets max result payload (default 102400).
- **Transports**: It supports `stdio`, streamable `http`, and legacy `sse`.
- **Authentication**: Secure connections with Bearer Tokens or OAuth 2.1.
- **Audit Logging**: Maintain strict security with comprehensive audit trails.
- **Recent Architecture**:
  - Added conditional update aliases for data and conditions.
  - Fix alias resolution in stats hypothesis tool.
  - Added streamable and HTTP transport tests.
  - Mask data alias validation at MCP boundary.
  - Require at least one filter for audit tool to prevent payload bloat.
- **Features**: Tool Filtering, Audit/Token Logging, and ecosystem integrations for MySQL Router, ProxySQL, and MySQL Shell.

## Session Context

Before starting work on this project, read `memory://briefing/mysql-mcp` from the `memory-journal-mcp` server for real-time context:

- **Recent journal entries** — what was just worked on by the development agent
- **GitHub status** — open issues, PRs, CI status, milestones
- **Workflow runs** — recent CI/CD results
- **Copilot review summaries** — your own recent review findings

For detailed session handoff context, search for entries tagged `session-summary` — these contain end-of-session notes from the development agent.

If you find issues during code review, use `create_entry` with tag `copilot-finding` to record them for the development agent to see in their next session briefing.

## Coding Standards

### Naming

- **Files and folders**: Always kebab-case (`schema-manager.ts`, `tool-filter.ts`)
- **Never** PascalCase or camelCase for filenames

### Modularity

- **File size limit**: Source files stay under ~500 lines
- **Split pattern**: `foo.ts` → `foo/` directory with sub-modules + `foo/index.ts` barrel re-export
- **Logical grouping**: Split by functional cohesion, not arbitrary line counts

### Type Safety

- **Strict TypeScript** — `tsconfig.json` enforces strict mode
- **Never use `eslint-disable`** to evade standards
- **Never use `any`** — use `unknown` and narrow with type guards
- **Never use `as` type assertions** — use `satisfies` operator or strict type guards
- **Never use `@ts-ignore` or `@ts-expect-error`** — fix the underlying type issue
- **Zod schemas** for all tool input validation at system boundaries
- **Union types over enums** — use `type Status = "active" | "inactive"` instead of `enum`

### Error Handling

All tool handlers return structured error responses — never raw exceptions:

```typescript
{
  success: false,
  error: string,        // Human-readable message
  code: string,         // Module-prefixed code (e.g., "QUERY_ERROR")
  category: string,     // Error category (validation, connection, query, etc.)
  suggestion: string,   // Actionable fix for the agent
  recoverable: boolean  // true = user can fix, false = server error
}
```

> **Note**: Table-querying tools must return `{exists: false, table}` for nonexistent tables. All schema examples must reflect 241 tools and current config flags.
> **Anti-Hallucination**: Do not assume existence of tools, resources, or prompts not explicitly listed in the tool-reference or registered in `server/`.

## Architecture Rules (Recent Changes)

Ensure PRs adhere to these recent SSoT architectural rules:
- **Code Mode** (`mysql_execute_code`) dramatically reduces token usage (70–90%).
- `METADATA_CACHE_TTL_MS` controls the cache TTL (default 30000).
- `CODE_MODE_MAX_RESULT_SIZE` strictly caps payload at 100KB (default 102400).
- Supports dual streamable HTTP + SSE transports.
- Ensure mask data alias validation at the MCP boundary.
- Audit tool requires at least one filter to prevent bloat.

## Architecture

```
src/
├── cli.ts                      # CLI entry point (Commander)
├── index.ts                    # Library entry point
├── version.ts                  # Version export
├── adapters/                   # MySQL database adapters
├── audit/                      # Audit and token logging
├── auth/                       # OAuth 2.1 authentication
├── cli/                        # CLI argument parsing modules
├── codemode/                   # Sandboxed JS execution engine
├── constants/                  # Server instructions, config
├── filtering/                  # Tool filtering (groups, meta-groups)
├── logging/                    # Structured logging
├── observability/              # Observability and metrics
├── pool/                       # Connection pool management
├── progress/                   # Progress notification helpers
├── server/                     # MCP server setup and registration
├── transports/                 # HTTP/SSE transport layer
├── types/                      # Type definitions + barrel exports
└── utils/                      # Logger, error helpers, utilities
```

## Key Reference Files

| File                            | Purpose                             |
| ------------------------------- | ----------------------------------- |
| `test-server/code-map.md`       | File → tool/handler mapping         |
| `test-server/tool-reference.md` | Categorized tool inventory          |
| `CONTRIBUTING.md`               | Development setup and PR guidelines |
| `DOCKER_README.md`              | Docker Hub documentation            |
| `CHANGELOG.md`                  | Version history                     |

## Review Checklist

When reviewing PRs, check for:

- [ ] Hardcoded tool/group counts — should be dynamic
- [ ] Missing barrel exports in `src/types/index.ts` when new types are added
- [ ] `eslint-disable` usage — always forbidden
- [ ] `@ts-ignore` or `as any` — always forbidden
- [ ] Raw exceptions from tool handlers — must use structured error responses
- [ ] Must reference `gh copilot` not the deprecated `github-copilot-cli`
- [ ] Files approaching 500 lines — flag for splitting
- [ ] New tools missing from tool filtering configuration
- [ ] Missing Zod schemas on new tools
- [ ] Kebab-case violations in new filenames
- [ ] `continue-on-error: true` in workflow files — forbidden per project standards
- [ ] Dual-Schema Pattern enforcement
- [ ] Ensure Docker instructions use `:latest` tag in `DOCKER_README.md`
- [ ] Market value proposition blocks prominent in README
- [ ] Docker readme <= 25,000 chars
- [ ] Table-querying tools return `{exists: false, table}` for nonexistent tables
- [ ] File system sandbox configuration correctly enforces `ALLOWED_IO_ROOTS`
- [ ] Schema examples accurately reflect the 241 tool count and current configuration flags
