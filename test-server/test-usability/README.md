# Agent Usability & Hallucination Testing

> **Note**: The default test database is `testdb`. If you need to specify a database explicitly in your API calls, use `testdb`.

> **This directory is optimized for AI agent consumption.**

This directory contains organic testing prompts designed to "fuzz" the `mysql-mcp` tools and explicitly trigger agent hallucinations. The goal is not just to test if the tools work, but to test if the tools are intuitive and bulletproof for AI agents.

## Testing Philosophy
Unlike the deterministic integration tests in `test-server/test-codemode/`, these prompts instruct agents to act intuitively, guess properties, and purposefully omit syntax like `await` or exact object structures. 

When an agent fails, they are instructed to permanently heal the codebase using the optimization layers described in `skills/mysql-mcp-heal/SKILL.md`.

## Execution Workflow (Divide & Conquer)

Because testing and healing all tools at once exhausts an agent's context window, we test them by group using separate threads/subagents via the `coordinator-workflow.md`.

1. **Pick a test file** (e.g., `test-usability-core.md`).
2. **Spawn a subagent** (or start a new thread) and feed them the file.
3. **Local Validation**: The subagent will run full local CI (`pnpm run check`) whenever they apply a codebase fix.
4. **Commit**: The subagent commits the fix. Move on to the next test file.
5. **Final Sweep**: Once all tests complete, a live verification run is conducted against a fresh, restarted server.

## Test Modules

1. `test-usability-codemode.md`
2. `test-usability-core.md`
3. `test-usability-transactions.md`
4. `test-usability-json.md`
5. `test-usability-text.md`
6. `test-usability-fulltext.md`
7. `test-usability-performance.md`
8. `test-usability-optimization.md`
9. `test-usability-admin.md`
10. `test-usability-monitoring.md`
11. `test-usability-backup.md`
12. `test-usability-replication.md`
13. `test-usability-partitioning.md`
14. `test-usability-router.md`
15. `test-usability-proxysql.md`
16. `test-usability-schema.md`
17. `test-usability-events.md`
18. `test-usability-sysschema.md`
19. `test-usability-stats.md`
20. `test-usability-spatial.md`
21. `test-usability-security.md`
22. `test-usability-cluster.md`
23. `test-usability-roles.md`
24. `test-usability-docstore.md`
25. `test-usability-introspection.md`
26. `test-usability-migration.md`
27. `test-usability-vector.md`
28. `test-usability-shell.md`
