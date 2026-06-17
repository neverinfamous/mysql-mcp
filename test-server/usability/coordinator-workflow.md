# mysql-mcp Usability Testing Coordinator Workflow

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` usability test suite using subagents.

## Goal

Execute all usability tests in `test-server/usability/` to fuzz the `mysql-mcp` tools and explicitly trigger agent hallucinations. Harden the codebase against these hallucinations via the `mysql-mcp-heal` skill.

## Workflow Rules

1. **Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time). The server schemas, proxy logic, and `server-instructions` are central files, and parallel mutation will cause git conflicts and require overlapping local CI runs.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt.
3. **Local Verification (NO PAUSING)**:
   - If you or a subagent modifies the codebase, you MUST run the full validation pipeline (`pnpm run check`, `pnpm run build`, `pnpm run test`, and `pnpm run test:e2e`) locally, and ensure they all pass completely cleanly **BEFORE** committing.
   - **Quality Gates**: Pay strict attention to ESLint and TypeScript compiler outputs. You MUST fix all lint, typecheck, vitest, and playwright issues prior to committing. Do NOT ignore warnings or errors. Follow strict TypeScript guidelines: NEVER use `any` (use `unknown` with type guards), avoid unsafe typecasts, and ensure explicit return types.
   - **WARNING**: Do NOT commit your code and then attempt to use `git commit --amend` to fix a lingering lint or test issue later. Amending a commit rewrites the commit SHA, which will permanently break the changelog tracking workflow.
   - DO NOT perform live server verification. DO NOT wait for a server restart. DO NOT pause or send a message asking the user to refresh the server.
   - If a subagent edits any `server-instructions/*.md` files, they MUST run `npx tsx scripts/generate-server-instructions.ts` before building.
4. **Commit**:
   - Once all local tests pass, the subagent will commit the code (`git commit -m "Optimize [group] tool usage"`), summarize findings, and exit. If no modifications were needed, no commit is required.
   - Once the subagent completes, mark the task as done and move to the next test in the queue.
5. **Code Mode Error Testing Protocol**:
   - Subagents executing Code Mode test matrices must anticipate structured `VALIDATION_ERROR` or other domain error payloads with `{ success: false }` for type mismatches, rather than expecting sandbox crashes or thrown raw exceptions.

## Test Sequence Queue

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

## Finalization

Once all subagents have completed their tests:
1. Run `pnpm run check` to ensure no type errors or formatting issues were introduced by the optimization layers across subagent boundaries.
2. Message the user: "The usability test suite is complete. Fixes were applied during the run. Please manually restart the server ONCE so we can perform a final live validation sweep."
