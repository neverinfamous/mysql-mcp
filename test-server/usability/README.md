# Agent Usability & Hallucination Testing

> **This directory is optimized for AI agent consumption.**

This directory contains organic testing prompts designed to "fuzz" the `mysql-mcp` tools and explicitly trigger agent hallucinations. The goal is not just to test if the tools work, but to test if the tools are intuitive and bulletproof for AI agents.

## Testing Philosophy
Unlike the deterministic integration tests in `test-server/test-codemode/`, these prompts instruct agents to act intuitively, guess properties, and purposefully omit syntax like `await` or exact object structures. 

When an agent fails, they are instructed to permanently heal the codebase using the optimization layers described in `skills/mysql-mcp-heal/SKILL.md`.

## Execution Workflow (Divide & Conquer)

Because testing and healing all tools at once exhausts an agent's context window, we test them by group using separate threads/subagents via the `coordinator-workflow.md`.

1. **Pick a test file** (e.g., `test-usability-core.md`).
2. **Spawn a subagent** (or start a new thread) and feed them the file.
3. **Local Validation**: The subagent will run full local CI (`pnpm run check`, `pnpm run test`, etc.) whenever they apply a codebase fix.
4. **Commit**: The subagent commits the fix. Move on to the next test file.
5. **Final Sweep**: Once all tests complete, a live verification run is conducted against a fresh, restarted server.

## Test Modules

1. `test-usability-codemode.md` - Core sandbox and proxy mechanics.
2. `test-usability-core.md` - Core DML, DDL, and versioning tools.
3. `test-usability-schema.md` - Schemas, views, routines, triggers, constraints, events.
4. `test-usability-json.md` - Core JSON, helpers, enhanced JSON operations.
5. `test-usability-text-fulltext.md` - Text processing and fulltext search.
6. `test-usability-transactions.md` - Transaction management.
7. `test-usability-stats.md` - Descriptive, comparative, advanced, hypothesis, outlier, and window stats.
8. `test-usability-performance-optimization.md` - Performance analysis, anomaly detection, optimization.
9. `test-usability-admin-monitoring.md` - Admin maintenance, server config, and monitoring.
10. `test-usability-backup.md` - DDL/DML export/import and audit backups.
11. `test-usability-security-roles.md` - Security audit, data protection, encryption, and roles.
12. `test-usability-spatial.md` - Spatial setup, geometry, queries, and operations.
13. `test-usability-docstore.md` - Document store management.
14. `test-usability-introspection-migration.md` - Introspection, graph dependencies, and migration tools.
15. `test-usability-replication-partitioning-events.md` - Replication, partitioning, and events.
16. `test-usability-ecosystem.md` - Cluster, router, proxysql, shell, sysschema, vector.
