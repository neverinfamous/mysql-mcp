---
name: mysql-mcp-heal
description: Guide for modifying the `mysql-mcp` codebase (schemas, server instructions, proxy interceptors) to proactively prevent, mitigate, and heal LLM hallucinations for all future agents.
---

# Codebase Optimization & Anti-Hallucination Guardrails

[![npm version](https://img.shields.io/npm/v/mysql-mcp.svg)](https://npmjs.org/package/mysql-mcp) [![License](https://img.shields.io/npm/l/mysql-mcp.svg)](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)  
[![Model Context Protocol](https://img.shields.io/badge/MCP-Protocol-purple.svg)](https://modelcontextprotocol.io/) [![Docker Support](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

## Value Proposition
**Build AI integrations instantly.**
**Empower agents with secure database access.**
**Execute complex logic via Code Mode.**
**Scale operations with robust connection pooling.**
**Leverage OAuth 2.1 for enterprise security.**

The primary philosophy of this skill is: **Automate away as many problems as possible.** When you (the agent) encounter a hallucination, confusion, or an artificial roadblock, DO NOT just work around it or settle for throwing a "good error message".

You MUST modify the underlying infrastructure (codebase, environment profiles, wrappers) to ensure execution succeeds seamlessly without the agent even noticing.

## 1. Phase 1: Determine the Layer of Healing

There is a strict hierarchy of how you should heal the codebase:
1. **Prevent (Highest Preference - Frictionless Recovery):** Automate the problem away. Modify the API schemas, normalizers, or aliases to silently catch, transform, or permit the hallucinatory payload so the execution succeeds automatically.
2. **Mitigate (Fallback Only):** ONLY if the input cannot be safely inferred, coerced, or permitted without causing data destruction, intercept it and throw a highly actionable custom error explicitly guiding the agent on how to fix it immediately.

Determine which of the 6 layers needs modification:

### Layer 1: Schema & Instruction Hardening (The First Line of Defense)

The most robust way to prevent a hallucination is to explicitly instruct the agent via the tools list or initialization payload.

* **Schema `.describe()` Tags:** When an agent hallucinates a property, update the Zod schema in `src/adapters/mysql/schemas/*.ts`. Add an explicit "Anti-Hallucination Hint" in the `.describe()` string. These surface directly in the JSON Schema that agents see on `tools/list`.
    * *Example:* `.describe('Note: Pass table, not tableName.')`
* **Tool Descriptions:** Update the `description` fields on tool definition files (e.g., `src/adapters/mysql/tools/*/index.ts`). This is the agent's first impression of each tool.
* **Server Instructions:** If a structural hallucination persists, update `src/constants/server-instructions/*.md`. Then run `pnpm run generate:instructions` (or `npx tsx scripts/generate-server-instructions.ts`). These alter the context payload for all agents upon connection.

### Layer 2: Parameter Normalization Healing (Dual-Schema Pattern / Frictionless Recovery)

If agents consistently hallucinate inputs that can be logically inferred or normalized, heal them silently via `z.preprocess()` wrappers or positional params (implementing the Dual-Schema Pattern).

* **Parameter Aliases:** If agents pass `tableName` instead of `table`, use the `preprocess-utils.ts` alias resolver to automatically map the keys.
* **Type Coercion:** If agents pass strings (e.g., `limit: "50"`) instead of numbers, use `coerceNumber` or similar in Zod to heal it before validation throws.
* **Positional Params:** If agents intuitively pass positional arguments (e.g., `mysql.core.readQuery("SELECT 1")` instead of `mysql.core.readQuery({ sql: "SELECT 1" })`), add or update bindings in `src/codemode/api/constants/positional.ts`.

### Layer 3: Sandbox Proxy Interceptors (Actionable Errors)

When agents execute code in Code Mode (which is now multiplexed to all tools), they often make standard Javascript mistakes. Instead of cryptic V8 runtime failures, `mysql-mcp` uses Proxy interceptors in `src/codemode/sandbox.ts` to throw explicit guidance.

* **Missing `await` Catching:** Agents frequently forget the `await` keyword. All RPC Promise returns are wrapped. If the agent attempts to synchronously access a property (e.g. `result.success`), the `wrapPromise` interceptor throws: `"Attempted to access property 'success' on a Promise object. Did you forget to 'await' the tool call?"`
* **Array Method Healing:** Agents often assume tools return Arrays instead of Objects (e.g., `{ success: true, rows: [...] }`). The `wrapResult` proxy intercepts Array methods (like `.map`, `.filter`) called directly on the returned Object and binds them dynamically to the inner array (e.g. `.rows`, `.tables`, `.results`).
* **Failed Operation Masking:** The `wrapResult` proxy prevents agents from destructuring `data` or `rows` out of a failed response object, throwing an explicit error referencing the tool failure instead.

### Layer 4: Alias Management (Intuitive Method Names)

Agents commonly extrapolate method names based on patterns (e.g., trying to call `mysql.json.jsonExtract()` instead of `mysql.json.extract()`). You can add aliases to gracefully handle these hallucinations.

* **Adding Aliases:** Add entries to the `METHOD_ALIASES` constant in `src/codemode/api/constants/aliases.ts` (e.g. `jsonExtract: 'extract'`). 
* **Safe Resolution:** Because alias resolution happens at API construction time in `src/codemode/api/generator.ts` rather than runtime, you do not face the same "shadowing bug" risks as other implementations. Aliases simply copy the reference of the correctly bound function.

### Layer 5: CLI Guardrails & Help Injection

When an agent hallucinates CLI flags or usage patterns for `mysql-mcp` standalone scripts or the `cli.ts` commander CLI:
* **Option Aliasing:** Add hardcoded aliases for commonly truncated flags in commander (e.g., `.option('--log, --audit-log')`) so execution naturally succeeds.
* **Dummy Command Interception:** When creating dummy commands to intercept agent hallucinations, ALWAYS use `[args...]` in the signature to prevent Commander from throwing a "too many arguments" error before the action can execute.
* **Help Meta-Prompting:** Use Commander's `addHelpText('after', ...)` to inject explicit `🤖 AI AGENT INSTRUCTIONS` directly into the `--help` output.
* **Actionable Errors:** Ensure that all CLI validation failures and process exits are prefixed with `🛠️ AUTONOMOUS HEALING: ` to prevent agent loop retries.

### Layer 6: Environment & Tooling Guardrails (The Meta-Trap)

Agents often run into environment-level interceptors or tooling issues that throw hallucinatory errors.

* **Fragile Native Tools:** When attempting to heal global environment files, **DO NOT** use the agent-native `replace_file_content` tool on large, ambiguous code blocks, as it uses loose heuristics that can permanently butcher files.
* **Safe Rewrites:** Instead, heal environment files by using precise `multi_replace_file_content` targeting single lines, or write a dedicated deterministic script to parse and rebuild the file safely.
* **Native Tool Priority:** If you trigger a system interceptor for using shell commands like `cat`, `grep`, or `ls`, you MUST autonomously switch to native tools (e.g., `view_file`, `grep_search`, `list_dir`). DO NOT ask the user for help or wait for permission.
* **Transient IDE Errors:** If shifting lines via code edits triggers IDE typing errors (e.g., "Unsafe argument of type error typed"), ALWAYS verify with `tsc --noEmit` before attempting complex type refactoring, as it may just be a stale ESLint cache.
* **Coordinator Guardrails:** To mitigate structural hallucinations, you MUST enforce a `task.md` checklist, run a `list_dir` requirement before accessing unknown paths, and halt execution immediately on `FAILED_FILE_NOT_FOUND` rather than autonomously retrying.
* **Audit Tool Payload Bloat:** To prevent payload bloat, the audit tool has a strict security requirement: it MUST receive at least one filter. If an agent hallucinates a blank audit call, the tool should reject it or the schema should enforce it.

## 2. Phase 2: Implementation

1. Update the necessary files (e.g. schemas, instructions, normalizers, aliases).
2. Validate the integrity of your code changes according to the verification steps required by your current test prompt or workflow. If unspecified, run `pnpm run check` to ensure full safety.
3. **Agent-First Validation (CRITICAL):** Programmatic tests cannot verify if an AI agent is actually healed. You MUST verify the fix against an actual agent by running the usability coordinator workflows (e.g., `test-server/test-usability/coordinator-workflow.md` or equivalent test protocols in `test-server/test-tools.md`).
4. Commit the changes locally.
