# MySQL MCP Advanced Code Mode Testing Suite

**AGENT INSTRUCTIONS**

This directory contains advanced stress tests for the tool groups. These tests simulate complex edge cases using exclusively Code Mode.

## Meet Fast Prerequisites

1. Basic deterministic tool group checklists in `../test-usability/*.md` MUST pass first.
2. The testing database MUST be freshly seeded or reset. Run `node ../infrastructure/scripts/reset-database.mjs` to ensure deterministic results.

## Understand Execution Parts

The original monolithic advanced stress testing suite was split into granular parts. This preserves agent attention spans and prevents LLM context window exhaustion. Each file strictly tests one major domain or cross-domain group.

See `coordinator-workflow.md` for execution rules and rely on `../scripts/test-manifest.ts` and the `../scripts/generate-tests.ts` engine for the definitive test list and generation logic.

## Follow Execution Protocol

When testing the contents of this directory, you MUST adhere to the following rules:

0. **Anti-Hallucination Guardrails:** Read exact filenames from `../scripts/test-manifest.ts` or run a live `list_dir` on `test-server/test-advanced/`. Subagents MUST output `STATUS: SUCCESS` or `STATUS: FAILED_FILE_NOT_FOUND`. Halt immediately if a file is missing.
0.5. **Validation Strictness:** If you modify the codebase, you MUST validate changes locally by running `pnpm run lint` and `pnpm run typecheck` along with targeted tests for the changes made. Do NOT run the entire test suites. Do NOT run any validation if you only modified documentation.
1. **Strict Code Mode Only:** All advanced stress tests must be executed entirely within the `node:worker_threads` sandbox via `mysql_execute_code`. Direct component tool calls are explicitly forbidden here unless specifically instructed for baseline comparison.
2. **Help Resources (Adaptive Architecture):** Tool and method signatures are NO LONGER automatically injected into your system prompt. You MUST read the corresponding `mysql://help/{group}` resource (e.g., `mysql://help/json`) to understand the `mysql.*` API before writing code.
3. **Sequential Grouping & Reporting:** Execute only **one markdown file at a time**. Create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if you made code changes. Fix errors and commit changes before advancing to the next file.
3.5. **Graceful Fails:** "Graceful Fails" refers to tests that could NOT be completed due to a temporary system problem or tool limitation. It does NOT refer to successful negative tests (e.g., intentionally triggering a validation error). Successful negative tests should NOT be counted as Graceful Fails.
4. **Payload Optimization (Token Monitoring):**
   - These tests deliberately trigger large responses and deep architectural nesting.
   - You MUST closely monitor the `metrics.tokenEstimate` value returned from the `mysql_execute_code` payloads.
   - If extremely large unbounded responses are produced, this is flagged as a **Payload Issue**. You must halt and patch the source handler boundary constraints (e.g., restricting integer `limit` inputs or dynamically dropping table dimensions).
5. **Structured Error Adherence (P154):** When intentionally attempting boundary failure parameters (missing columns, invalid dimension types), assert that the adapter outputs a proper structured error (`{success: false, error: "..."}`) rather than leaking raw MySQL native errors.
6. **Security Sandbox Boundaries:** Ensure the server uses `ALLOWED_IO_ROOTS`. For filesystem-interacting tools, actively test directory traversal edge cases (e.g., `../../etc/passwd`). Test paths explicitly outside the allowed boundary. Confirm `SECURITY_ERROR` is correctly thrown and caught.
7. **No Persistent Pollution:** After finishing execution within a document, verify that all `stress_*` schema tables and functions generated within Code Mode have been safely `DROP`ped. No test state should bleed over into the next run.
