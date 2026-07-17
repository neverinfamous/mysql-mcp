# mysql-mcp — Copilot Code Review Context

[![npm version](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp) [![License](https://img.shields.io/npm/l/@neverinfamous/mysql-mcp.svg)](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Protocol-purple.svg)](https://modelcontextprotocol.io/) [![Docker Support](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://hub.docker.com/r/writenotenow/mysql-mcp)

## 💎 Deliver the Value Proposition

> MySQL MCP is a production-ready integration engineered for AI agents. It reduces LLM token consumption by consolidating operations via sandboxed Code Mode. It scales reliably through built-in connection pooling. It secures database access using strict OAuth 2.1 validation.

## Understand the Project Overview

mysql-mcp is a production-grade TypeScript MCP server for MySQL. It empowers LLMs with an extensive suite of specialized tools and resources.

## Build Securely with Architecture Rules
Ensure PRs adhere to these SSoT architectural rules:
- **Tool filtering** skips MySQL connections when using exclusively router, proxysql, or shell tools.
- **Code Mode** (`mysql_execute_code`) significantly reduces token usage (70–90%).
- **Cache**: `METADATA_CACHE_TTL_MS` controls the cache TTL (default 30000).
- **Transports**: Supports `stdio`, streamable `http`, and standard `sse` transports.
- **Validation**: Ensure parameter alias validation at the MCP boundary (via the Dual-Schema Pattern).
- **Audit Tool**: Requires at least one filter to prevent payload bloat.
- **Authentication**: Secure connections with Bearer Tokens or OAuth 2.1.
- **Features**: Tool filtering, token logging, and ecosystem integrations for MySQL Router, ProxySQL, and Shell.

## Utilize Session Context

Before starting work, read `memory://briefing/mysql-mcp` from the `memory-journal-mcp` server. It provides real-time context:

- **Recent journal entries** — what was just worked on by the development agent
- **GitHub status** — open issues, PRs, CI status, milestones
- **Workflow runs** — recent CI/CD results
- **Copilot review summaries** — your own recent review findings

For detailed session handoff context, search for entries tagged `session-summary`. These contain end-of-session notes from the development agent.

Log review issues using `create_entry` with the `copilot-finding` tag. Agents review these findings during their next session briefings.

## Ensure Excellence with Coding Standards

### Format Names Correctly

- **Files and folders**: Always kebab-case (`schema-manager.ts`, `tool-filter.ts`)
- **Never** PascalCase or camelCase for filenames

### Maintain Modularity

- **File size limit**: Source files stay under ~500 lines
- **Split pattern**: `foo.ts` → `foo/` directory with sub-modules + `foo/index.ts` barrel re-export
- **Logical grouping**: Split by functional cohesion, not arbitrary line counts

### Ensure Type Safety

- **Strict TypeScript** — `tsconfig.json` enforces strict mode
- **Never use `eslint-disable`** to evade standards
- **Never use `any`** — use `unknown` and narrow with type guards
- **Never use `as` type assertions** — use `satisfies` operator or strict type guards
- **Never use `@ts-ignore` or `@ts-expect-error`** — fix the underlying type issue
- **Zod schemas** for all tool input validation at system boundaries
- **Union types over enums** — use `type Status = "active" | "inactive"` instead of `enum`

### Implement Error Handling

All tool handlers return structured error responses — never raw exceptions:

```typescript
{
  success: false,
  error: string,          // Human-readable message
  code: string,           // Module-prefixed code (e.g., "QUERY_ERROR")
  category: ErrorCategory,// Error category (validation, connection, query, etc.)
  suggestion?: string,    // Optional actionable fix for the agent
  recoverable: boolean,   // true = user can fix, false = server error
  details?: unknown,      // Optional error details
  metrics?: unknown       // Optional error metrics
}
```

> **Note**: Table-querying tools must return `{exists: false, table}` for nonexistent tables. All schema examples must reflect the comprehensive toolset and current config flags.
> **Anti-Hallucination**: Do not assume existence of tools, resources, or prompts. They must be explicitly listed in the tool-reference or registered in `server/`.

## Navigate the Architecture

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

## Consult Key Reference Files

| File                            | Purpose                             |
| ------------------------------- | ----------------------------------- |
| `README.md`                     | Primary project documentation       |
| `AGENT_README.md`               | AI agent specific instructions      |
| `test-server/code-map.md`       | File → tool/handler mapping         |
| `test-server/tool-reference.md` | Categorized tool inventory          |
| `test-server/test-preflight.md` | Test validation reference           |
| `CONTRIBUTING.md`               | Development setup and PR guidelines |
| `DOCKER_README.md`              | Docker Hub documentation            |


## Complete the Review Checklist

When reviewing PRs, check for:

- [ ] Missing barrel exports in `src/types/index.ts` when new types are added
- [ ] `eslint-disable` usage — always forbidden
- [ ] `@ts-ignore`, `@ts-expect-error` or `as any` — always forbidden
- [ ] Raw exceptions from tool handlers — must use structured error responses
- [ ] Must reference `gh copilot` not the deprecated `github-copilot-cli`
- [ ] Files approaching 500 lines — flag for splitting
- [ ] New tools missing from tool filtering configuration
- [ ] Missing Zod schemas on new tools
- [ ] Kebab-case violations in new filenames
- [ ] `continue-on-error: true` in workflow files — forbidden per project standards (except Agentic Workflow `.lock.yml` files)
- [ ] Verify the author has run tests locally (e.g., via pnpm run check)
- [ ] Dual-Schema Pattern enforcement
- [ ] Ensure Docker instructions use `:latest` tag in `DOCKER_README.md`
- [ ] Add prominent Value Proposition to standard README.md and Wikis.
- [ ] CRITICAL: Never add marketing tone to AGENT_README.md.
- [ ] Docker readme <= 25,000 chars
- [ ] Table-querying tools return `{exists: false, table}` for nonexistent tables
- [ ] File system sandbox configuration correctly enforces `ALLOWED_IO_ROOTS`
- [ ] Schema examples accurately reflect the comprehensive toolset and current configuration flags
