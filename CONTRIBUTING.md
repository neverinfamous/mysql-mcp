# Contributing to mysql-mcp

Thank you for your interest in contributing to mysql-mcp! This project is built by developers, for developers, and we welcome contributions that make the MySQL MCP experience better for everyone.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** from `main`
4. **Make your changes** and test thoroughly
5. **Submit a pull request** with a clear description

## 🛠️ Setup Your Environment

### Meet Prerequisites

- Node.js >= 26
- Bun >= 1.0 (for script execution)
- pnpm >= 9.x (see `engines` in `package.json`)
- **Git** (for version control)
- **MySQL 5.7, 8.0+, or 9.x** (local instance or Docker)
- **Docker** (optional, for container testing)

### Develop Locally

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/mysql-mcp.git
cd mysql-mcp

# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Run the test suite
pnpm test

# Run the full quality check
pnpm run check   # Runs ESLint + TypeScript strict-mode, plus unit and E2E tests
```

### Run the Server Locally

```bash
# Connect to a local MySQL instance via stdio
node dist/cli.js --transport stdio --mysql "mysql://user:pass@localhost:3306/mydb"

# HTTP transport (for testing with an MCP client)
node dist/cli.js --transport http --port 3000 --mysql "mysql://user:pass@localhost:3306/mydb"
```

> **Connection string required.** The server requires a valid MySQL connection string. For local testing, you can use a `.env` file or pass the string directly. Never commit credentials to version control.

### Develop with Docker

```bash
# Build the Docker image locally
docker build -f Dockerfile -t mysql-mcp-dev .

# Run with a connection string
docker run --rm -i mysql-mcp-dev --transport stdio --mysql "mysql://user:pass@host:3306/mydb"
```

## 📋 Discover Contribution Goals

We especially welcome contributions in these areas:

### Tackle High Priority Goals

- **Bug fixes** and stability improvements
- **Performance improvements** (faster tool dispatch, reduced overhead, connection pool tuning)
- **New tools** that extend MySQL capabilities within existing groups
- **Better error messages** with actionable remediation hints

### Address Medium Priority Goals

- **Enhanced Code Mode** `isolated-vm` operations and sandbox capabilities
- **Additional MySQL 8.0+ feature coverage** (CTEs, window functions, JSON improvements)
- **New MySQL extension integrations** (e.g., ProxySQL, MySQL Router)
- **Documentation improvements** and Playwright end-to-end examples

### Build Future Features

- **New tool groups** for specialized MySQL workflows
- **Additional MySQL ecosystem integrations**
- **Performance benchmarks** for new hot paths
- **IDE-specific integrations** beyond MCP

## 🧪 Test Your Changes

### Run Automated Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Run a specific test file
npx vitest run src/__tests__/your-test-file.test.ts

# Run benchmarks
pnpm run bench
```

### Run Quality Checks

```bash
# Lint + type check (required before submitting)
pnpm run check   # ESLint + TypeScript strict-mode, plus unit and E2E tests

# Or individually
pnpm run lint        # ESLint only
pnpm run typecheck   # TypeScript strict-mode type checking
```

### Run End-to-End Tests

The Playwright E2E suite validates Streamable HTTP and SSE transport parity:

```bash
pnpm run test:e2e
```

### Test Manually with MCP

Add your local build to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mysql-mcp-dev": {
      "command": "node",
      "args": [
        "path/to/your/mysql-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--mysql",
        "mysql://user:pass@localhost:3306/mydb"
      ]
    }
  }
}
```

### Test with Docker

```bash
# Build and run locally
docker build -f Dockerfile -t mysql-mcp-dev .
docker run --rm -i mysql-mcp-dev --transport stdio --mysql "mysql://user:pass@host:3306/mydb"
```

## 📝 Follow Coding Standards

### Follow TypeScript Code Style

- **Strict mode** — `tsconfig.json` enforces strict TypeScript
- **ESLint** — Run `pnpm run lint` to check, `pnpm run lint:fix` to auto-fix (when available)
- **Prettier** — Formatting is handled automatically during the release workflow
- **Type safety** — Avoid `any`; use proper types and Zod schemas
- **Modularity** — Keep files under ~500 lines; split into sub-modules when approaching the limit
- **Error handling** — Use structured `{success, error, code, category, suggestion, recoverable}` responses in tool handlers

### Name Files Consistently

All files and directories use **kebab-case** (lowercase with dashes):

- ✅ `database-adapter.ts`, `tool-filter.ts`, `pool-manager/`
- ❌ `DatabaseAdapter.ts`, `toolFilter.ts`

### Handle Errors Structurally

Every tool must return structured error responses — never raw exceptions:

```json
{
  "success": false,
  "error": "Descriptive message with context",
  "code": "MODULE_ERROR_CODE",
  "category": "VALIDATION_ERROR",
  "suggestion": "Actionable remediation hint",
  "recoverable": true
}
```

Error logic should leverage the `MySQLMcpError` hierarchy. Our Auto-refinement system automatically maps generic codes to specific ones. It also populates suggestions. Catch at the handler boundary and return `formatHandlerError(error)` for JSON compliance. Always propagate stack traces — don't swallow errors.

### Validate Your Inputs

- **Dual-Schema Pattern** — Tools use a plain `z.object()` Base schema for visibility. A `z.preprocess()` wrapper supports aliases without breaking JSON Schema generation.
- **Zod schemas** validate parameters with explicit coercion controls. Do not use aggressive `z.coerce.number()`.
- Output schemas are strictly defined. This guarantees agents receive deterministic P154-compliant structures.
- Invalid inputs must return structured errors. The `formatHandlerError()` helper handles this without raw validation messages.
- SQL injection is prevented via **parameter binding**. Never interpolate user input into SQL strings.

### Log Structurally

Use the centralized logger with structured payloads. Include: `module`, `operation`, `entityId`, `context`, and `stack` (for errors). Severity levels: `error`, `warning`, `info`, `debug`.

### Consider Docker Optimization

- **Multi-stage builds** — Keep images lean
- **Security** — Run as non-root user, minimal privileges
- **Multi-platform** — Test on both amd64 and arm64 when possible
- **Documentation** — Update Docker guides if needed

## 🔧 Add or Modify Tools

mysql-mcp organizes tools into 28 groups covering: `core`, `schema`, `introspection`, `migration`, `monitoring`, `performance`, `stats`, `text`, `json`, `spatial`, `admin`, `transactions`, `partitioning`, `backup`, `security`, `roles`, `docstore`, `sysschema`, `cluster`, `proxysql`, `router`, `shell`, `events`, `fulltext`, `optimization`, `vector`, `replication`, and `codemode`. 

> **Note on Tool Counts:** The project maintains a hardcoded tool count of exactly **241 tools** for marketing visibility (documented across `README.md`, the Wiki, and `tool-constants.ts`). When adding or removing tools, you must update these hardcoded constants globally.

When adding a new tool:

1. **Define the tool input and output schemas** using Zod in the appropriate group under `src/adapters/mysql/schemas/`
2. **Implement the handler** in the corresponding adapter directory under `src/adapters/mysql/tools/`
3. **Add structured error handling** by letting the handler return `formatHandlerError()` when exceptions are caught
4. **Write meaningful Vitest tests** and update E2E spec files if making systemic changes
5. **Add the tool to the group's help resource** (the markdown file under `src/constants/server-instructions/`)
6. **Verify OAuth Scope** — ensure the new tool aligns with its group's defined OAuth 2.1 scope (`read`, `write`, or `admin`)

## 🐛 Report Bugs

When reporting bugs, please include:

1. **Environment details** (OS, Node.js version, pnpm version)
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **MySQL version** and relevant extensions enabled
5. **MCP client details** (Cursor version, Claude Desktop, configuration)
6. **Relevant logs** or error messages

Use our [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) for consistency.

## 💡 Request Features

For new features, please provide:

1. **Use case description** — What problem does this solve?
2. **Proposed solution** — How should it work?
3. **Tool group fit** — Which group does this belong to, or does it need a new one?
4. **Alternatives considered** — What other approaches did you think about?
5. **Implementation notes** — Any technical considerations

Use our [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

## 🔄 Submit Pull Requests

### Check Before Submitting

- [ ] **Fork** the repository and create a feature branch
- [ ] **Test** your changes (`pnpm run check && pnpm test`)
- [ ] **Update documentation** if you changed APIs or behavior
- [ ] **Add examples** for new features
- [ ] **Check** that existing functionality still works

### Write a Good PR Description

- **Summary** of changes made
- **Testing** performed (how did you verify it works?)
- **Breaking changes** (if any)
- **Related issues** (fixes #123)

### Follow the Review Process

1. **Automated checks** must pass (lint, typecheck, tests)
2. **Maintainer review** — we'll provide feedback
3. **Address feedback** — make requested changes
4. **Merge** — once approved, we'll merge your PR

### Pass CI Checks

| Workflow        | What It Does                                 |
| --------------- | -------------------------------------------- |
| **Lint & Test** | ESLint, TypeScript strict-mode, Vitest suite |
| **CodeQL**      | Static analysis for security vulnerabilities |
| **E2E**         | Playwright end-to-end transport parity tests |

All checks must pass before merge. Security steps **hard-fail on fixable issues** — this is intentional.

## 📄 Commit and Generate Changelogs

The project uses `bun ./.agents/scripts/commit.ts` for all commits with explicit file staging. **Do not use raw `git commit`.**

Log all changes directly via the wrapper using git trailers. We use an automated workflow that generates the changelog from commit history.

Example commit message:
```text
feat: add Code Mode limits

Changelog-Added: Implement maximum result size for Code Mode executions.
```

Available trailers:
- `Changelog-Added` — new features or tools
- `Changelog-Changed` — changes to existing functionality
- `Changelog-Fixed` — bug fixes
- `Changelog-Removed` — removed features
- `Changelog-Security` — vulnerability fixes

> **Do not edit `CHANGELOG.md` directly** — it is assembled automatically during the release process.

## 🎯 Master Development Tips

### Work with MCP

- **Test with a real MySQL instance** — behavior varies across versions and configuration
- **Check tool responses** — Ensure JSON responses are well-formed
- **Output schemas** — All tools have Zod output schemas; error responses must pass validation
- **Dual-schema pattern** — Relaxed schemas for SDK validation, strict schemas inside handlers

### Understand the Architecture

```
src/
├── adapters/       # MySQL queries, handlers, Zod schemas, prompts, and resources
├── audit/          # JSONL audit trail with session token estimates, pre-mutation snapshots, interceptor
├── auth/           # Transport-agnostic OAuth 2.1, scopes, RFC 6750 enforcement
├── cli/            # CLI argument parsing and server bootstrap
├── cli.ts          # Entry point
├── codemode/       # Sandboxed JavaScript execution (Code Mode — VM & Worker Isolate)
├── constants/      # Help content generation and dynamic server instructions
├── logging/        # Structured logging
├── observability/  # Tracing and metrics
├── progress/       # Session progress tracking
├── filtering/      # Tool filter parsing, group resolution
├── pool/           # Connection pool management
├── server/         # MCP server setup, handler registration
├── transports/     # HTTP/SSE/stdio transport layer
├── types/          # Core TypeScript types (errors, schema, mcp, oauth)
├── utils/          # Logging, sanitization, validation, errors helpers
└── index.ts        # Public API exports
```

### Use Available Scripts

| Script                  | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `pnpm run build`         | Production build via tsup                            |
| `pnpm run dev`           | Watch mode (fast unbundled hot reloads via tsx)      |
| `pnpm run check`         | **Quality gate** — lint + typecheck + tests (run before PRs) |
| `pnpm run lint`          | ESLint only                                          |
| `pnpm run typecheck`     | TypeScript strict-mode type checking                 |
| `pnpm test`              | Run all unit tests (Vitest)                          |
| `pnpm run test:coverage` | Tests with V8 coverage report                        |
| `pnpm run test:e2e`      | Playwright end-to-end tests (HTTP/SSE transport)     |
| `pnpm run bench`         | Performance benchmarks (tinybench via Vitest)        |
| `bun ./.agents/scripts/preview-changelog.mjs` | Preview changelog generation from git history |

### Run Benchmarks

If your change touches a hot path (tool dispatch, schema parsing, auth, Code Mode, connection pool), run benchmarks to verify you haven't introduced a regression:

```bash
pnpm run bench
```

## 🔐 Report Security Issues

If you discover a security vulnerability, **do not** open a public issue. Please follow our [Security Policy](SECURITY.md) and report it to **admin@adamic.tech**.

When contributing code, follow these security practices:

- **Parameter binding** for all SQL — never string interpolation
- **Input validation** via Zod schemas at tool boundaries
- **No secrets in code** — use environment variables (`.env` files are gitignored)
- **Typed error classes** with descriptive messages — don't expose internal details to end users
- **Transport Security** — preserve DNS rebinding protection and Slowloris DoS timeouts in HTTP layers

## 🤝 Join the Community

- **Be respectful** — Follow our [Code of Conduct](CODE_OF_CONDUCT.md)
- **Ask questions** — Use GitHub Issues for discussion
- **Share ideas** — Feature requests and feedback welcome
- **Help others** — Answer questions and review PRs

## 📞 Get Help

- **GitHub Issues** — Bug reports and feature requests
- **Documentation** — Check [README.md](README.md), [Wiki](https://github.com/neverinfamous/mysql-mcp/wiki), and Docker guides first
- **Email** — **admin@adamic.tech**

## 🏆 Gain Recognition

Contributors are recognized in:

- **Release notes** — Major contributions highlighted
- **README** — Contributor acknowledgments
- **Git history** — Your commits are permanent record

Thank you for helping make mysql-mcp better for the developer community! 🚀
