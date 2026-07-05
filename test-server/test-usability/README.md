# Agent Usability & Hallucination Testing

> 🚀 **Core Features Tested:** Evaluate agent experience with our flagship features: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.


> **This directory is optimized for AI agent consumption.**

This directory contains organic testing prompts designed to "fuzz" the `mysql-mcp` tools and explicitly trigger agent hallucinations. The goal is not just to test if the tools work, but to test if the tools are intuitive and bulletproof for AI agents.

## Testing Philosophy
Unlike the deterministic integration tests in `test-server/test-codemode/`, these prompts instruct agents to act intuitively, guess properties, and purposefully omit syntax like `await` or exact object structures. 

When an agent fails, they are instructed to permanently heal the codebase using the optimization layers described in [`skills/mysql-mcp-heal/SKILL.md`](../../skills/mysql-mcp-heal/SKILL.md).

## Execution Workflow (Divide & Conquer)

Because testing and healing all tools at once exhausts an agent's context window, we test them by group using separate threads/subagents via the `coordinator-workflow.md`.

0. **Anti-Hallucination Guardrails:** The Coordinator MUST maintain a `task.md` checklist, read the exact filenames from `coordinator-workflow.md` and cross-reference them with a live `list_dir` of the directory before beginning. Subagents MUST output `STATUS: SUCCESS` or `STATUS: FAILED_FILE_NOT_FOUND`. The Coordinator MUST halt immediately if a file is not found.
1. **Pick a test file** (e.g., `test-usability-core.md`).
2. **Spawn a subagent** (or start a new thread) and feed them the file.
3. **Local Validation**: The subagent will ONLY run fast static checks (`pnpm run lint && pnpm run typecheck`) whenever they apply a codebase fix. They should explicitly skip `pnpm run test` and `pnpm run test:e2e` to save time.
4. **Commit**: The subagent commits the fix. Kill the subagent before moving on to the next test file.
5. **Final Testing & Sweep**: Once all tests complete, the Coordinator agent will run `pnpm run check` to validate the full test suite and fix any broken unit/E2E tests. Finally, a live verification run is conducted against a fresh, restarted server.

## Test Files Available

- `test-usability-admin-part1.md`
- `test-usability-admin-part2.md`
- `test-usability-admin-part3.md`
- `test-usability-backup-part1.md`
- `test-usability-backup-part2.md`
- `test-usability-backup-part3.md`
- `test-usability-cluster-part1.md`
- `test-usability-cluster-part2.md`
- `test-usability-cluster-part3.md`
- `test-usability-cluster-part4.md`
- `test-usability-codemode.md`
- `test-usability-core-part1.md`
- `test-usability-core-part2.md`
- `test-usability-core-part3.md`
- `test-usability-core-part4.md`
- `test-usability-docstore-part1.md`
- `test-usability-docstore-part2.md`
- `test-usability-docstore-part3.md`
- `test-usability-events-part1.md`
- `test-usability-events-part2.md`
- `test-usability-fulltext-part1.md`
- `test-usability-fulltext-part2.md`
- `test-usability-introspection-part1.md`
- `test-usability-introspection-part2.md`
- `test-usability-json-part1.md`
- `test-usability-json-part2.md`
- `test-usability-json-part3.md`
- `test-usability-json-part4.md`
- `test-usability-json-part5.md`
- `test-usability-json-part6.md`
- `test-usability-migration-part1.md`
- `test-usability-migration-part2.md`
- `test-usability-monitoring-part1.md`
- `test-usability-monitoring-part2.md`
- `test-usability-monitoring-part3.md`
- `test-usability-optimization-part1.md`
- `test-usability-optimization-part2.md`
- `test-usability-partitioning-part1.md`
- `test-usability-partitioning-part2.md`
- `test-usability-performance-part1.md`
- `test-usability-performance-part2.md`
- `test-usability-performance-part3.md`
- `test-usability-performance-part4.md`
- `test-usability-proxysql-part1.md`
- `test-usability-proxysql-part2.md`
- `test-usability-proxysql-part3.md`
- `test-usability-proxysql-part4.md`
- `test-usability-replication-part1.md`
- `test-usability-replication-part2.md`
- `test-usability-roles-part1.md`
- `test-usability-roles-part2.md`
- `test-usability-roles-part3.md`
- `test-usability-router-part1.md`
- `test-usability-router-part2.md`
- `test-usability-router-part3.md`
- `test-usability-schema-part1.md`
- `test-usability-schema-part2.md`
- `test-usability-schema-part3.md`
- `test-usability-schema-part4.md`
- `test-usability-security-part1.md`
- `test-usability-security-part2.md`
- `test-usability-security-part3.md`
- `test-usability-shell-part1.md`
- `test-usability-shell-part2.md`
- `test-usability-shell-part3.md`
- `test-usability-shell-part4.md`
- `test-usability-spatial-part1.md`
- `test-usability-spatial-part2.md`
- `test-usability-spatial-part3.md`
- `test-usability-spatial-part4.md`
- `test-usability-stats-part1.md`
- `test-usability-stats-part2.md`
- `test-usability-stats-part3.md`
- `test-usability-stats-part4.md`
- `test-usability-stats-part5.md`
- `test-usability-stats-part6.md`
- `test-usability-stats-part7.md`
- `test-usability-sysschema-part1.md`
- `test-usability-sysschema-part2.md`
- `test-usability-sysschema-part3.md`
- `test-usability-text-part1.md`
- `test-usability-text-part2.md`
- `test-usability-transactions-part1.md`
- `test-usability-transactions-part2.md`
- `test-usability-transactions-part3.md`
- `test-usability-vector-part1.md`
- `test-usability-vector-part2.md`
- `test-usability-vector-part3.md`
- `test-usability-vector-part4.md`
