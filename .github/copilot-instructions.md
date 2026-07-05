# mysql-mcp — Copilot Code Review Context

## Project Overview

mysql-mcp is a TypeScript MCP (Model Context Protocol) server for MySQL database integration. It offers **241 tools** (241 specialized tools via config) across **28 groups**, **16 Shortcuts**, **49 resources**, and **28 prompts**.

**Architecture & Capabilities**:
- **Execution**: Code Mode execution via `isolated-vm` sandbox (massively reduces token overhead, strict 100KB payload cap, rate limiting).
- **Transports**: Supported Transports: `stdio`, `http` (Streamable HTTP `/mcp`), `sse` (Legacy `/sse`).
- **Authentication**: Simple Bearer Token or full OAuth 2.1 (RFC 9728/8414) with Keycloak.
- **Configuration**: Port, Server Host, Tool Filter, Log Level, Metrics Export, Name, Allowed IO Roots, Stateless, Enable HSTS, Trust Proxy, Auth Token.
- **Audit Logging**: Log Path, Redact, Reads, Max Size, Backup, Backup Data, Backup Max Size.
- **Recent Architecture**: Mask data alias validation, server config action required, strict validation for user and host summaries.
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

> **Note**: Table-querying tools must return `{exists: false, table}` for nonexistent tables. All schema examples must reflect 241 tools and current config flags.
```

## Architecture Rules (Recent Changes)

Ensure PRs adhere to these recent SSoT architectural rules:
- `fix(security)`: allow mask data alias validation at MCP boundary.
- `chore(tests)`: strengthen anti-hallucination guardrails across coordinator workflows.
- `fix(admin)`: make server config action required and fix audit default limit.
- `fix(sysschema)`: strict validation and aliases for user and host summaries.
- `fix(docstore)`: add alias handling for collectionName.
- `fix(core)`: add conditional update aliases for data and conditions.
- `fix(optimization)`: allow database-wide index audit in indexRecommendation by removing empty payload validation.

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
- [ ] `:latest` Docker tags used
- [ ] Market value proposition blocks prominent in README
- [ ] Docker readme <= 25,000 chars
- [ ] Table-querying tools return `{exists: false, table}` for nonexistent tables
- [ ] File system sandbox configuration correctly enforces `ALLOWED_IO_ROOTS`
- [ ] Schema examples accurately reflect the 241 tool count and current configuration flags
