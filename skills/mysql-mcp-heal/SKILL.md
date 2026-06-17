---
name: mysql-mcp-heal
description: Guide for modifying the `mysql-mcp` codebase (schemas, server instructions, proxy interceptors) to proactively prevent, mitigate, and heal LLM hallucinations for all future agents.
---

# Codebase Optimization & Anti-Hallucination Guardrails

The primary philosophy of this skill is: **When you (the agent) encounter a hallucination, confusion, or are forced to use introspection to figure out an API, DO NOT just work around it.** 

You must modify the server codebase to ensure future agents never face the same issue. This document details the 4 specific layers of the `mysql-mcp` architecture where you can implement these permanent fixes.

## Layer 1: Schema & Instruction Hardening (The First Line of Defense)

The most robust way to prevent a hallucination is to explicitly instruct the agent via the tools list or initialization payload.

* **Schema `.describe()` Tags:** When an agent hallucinates a property, update the Zod schema in `src/adapters/mysql/schemas/*.ts`. Add an explicit "Anti-Hallucination Hint" in the `.describe()` string. These surface directly in the JSON Schema that agents see on `tools/list`.
    * *Example:* `.describe('Note: Pass table, not tableName.')`
* **Tool Descriptions:** Update the `description` fields on tool definition files (e.g., `src/adapters/mysql/tools/*/index.ts`). This is the agent's first impression of each tool.
* **Server Instructions:** If a structural hallucination persists, update `src/constants/server-instructions/*.md`. Then run `npx tsx scripts/generate-server-instructions.ts`. These alter the context payload for all agents upon connection.

## Layer 2: Parameter Normalization Healing (Frictionless Recovery)

If agents consistently hallucinate inputs that can be logically inferred or normalized, heal them silently via `z.preprocess()` wrappers or positional params.

* **Parameter Aliases:** If agents pass `tableName` instead of `table`, use the `preprocess-utils.ts` alias resolver to automatically map the keys.
* **Type Coercion:** If agents pass strings (e.g., `limit: "50"`) instead of numbers, use `coerceNumber` or similar in Zod to heal it before validation throws.
* **Positional Params:** If agents intuitively pass positional arguments (e.g., `mysql.core.readQuery("SELECT 1")` instead of `mysql.core.readQuery({ sql: "SELECT 1" })`), add or update bindings in `src/codemode/api/constants/positional.ts`.

## Layer 3: Sandbox Proxy Interceptors (Actionable Errors)

When agents execute code in Code Mode (`mysql_execute_code`), they often make standard Javascript mistakes. Instead of cryptic V8 runtime failures, `mysql-mcp` uses Proxy interceptors in `src/codemode/sandbox.ts` to throw explicit guidance.

* **Missing `await` Catching:** Agents frequently forget the `await` keyword. All RPC Promise returns are wrapped. If the agent attempts to synchronously access a property (e.g. `result.success`), the `wrapPromise` interceptor throws: `"Attempted to access property 'success' on a Promise object. Did you forget to 'await' the tool call?"`
* **Array Method Healing:** Agents often assume tools return Arrays instead of Objects (e.g., `{ success: true, rows: [...] }`). The `wrapResult` proxy intercepts Array methods (like `.map`, `.filter`) called directly on the returned Object and binds them dynamically to the inner array (e.g. `.rows`, `.tables`, `.results`).
* **Failed Operation Masking:** The `wrapResult` proxy prevents agents from destructuring `data` or `rows` out of a failed response object, throwing an explicit error referencing the tool failure instead.

## Layer 4: Alias Management (Intuitive Method Names)

Agents commonly extrapolate method names based on patterns (e.g., trying to call `mysql.json.jsonExtract()` instead of `mysql.json.extract()`). You can add aliases to gracefully handle these hallucinations.

* **Adding Aliases:** Add entries to the `METHOD_ALIASES` constant in `src/codemode/api/constants/aliases.ts` (e.g. `jsonExtract: 'extract'`). 
* **Safe Resolution:** Because alias resolution happens at API construction time in `src/codemode/api/generator.ts` rather than runtime, you do not face the same "shadowing bug" risks as other implementations. Aliases simply copy the reference of the correctly bound function.

