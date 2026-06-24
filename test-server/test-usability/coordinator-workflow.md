# mysql-mcp Usability Testing Coordinator Workflow

> **Note**: The default test database is `testdb`. If you need to specify a database explicitly in your API calls, use `testdb`.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

We're working in the `mysql-mcp` project in this thread.

This guide instructs the Coordinator agent on how to run the `mysql-mcp` usability test suite using subagents.

## Goal

Execute all usability tests in `test-server/test-usability/` to fuzz the `mysql-mcp` tools and explicitly trigger agent hallucinations. Harden the codebase against these hallucinations via the `mysql-mcp-heal` skill.

## Workflow Rules

1. **Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time). The server schemas, proxy logic, and `server-instructions` are central files, and parallel mutation will cause git conflicts and require overlapping local CI runs.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt.
3. **Local Verification (NO PAUSING)**:
   - If you or a subagent modifies the codebase, you MUST run the full validation pipeline (`pnpm run check`) locally, and ensure they all pass completely cleanly **BEFORE** committing.
   - **Quality Gates**: Pay strict attention to ESLint and TypeScript compiler outputs. You MUST fix all `pnpm run check` validation issues prior to committing. Do NOT ignore warnings or errors. Follow strict TypeScript guidelines: NEVER use `any` (use `unknown` with type guards), avoid unsafe typecasts, and ensure explicit return types.
   - **WARNING**: Do NOT commit your code and then attempt to use `git commit --amend` to fix a lingering lint or test issue later. Amending a commit rewrites the commit SHA, which will permanently break the changelog tracking workflow.
   - DO NOT perform live server verification. DO NOT wait for a server restart. DO NOT pause or send a message asking the user to refresh the server.
   - If a subagent edits any `server-instructions/*.md` files, they MUST run `npx tsx scripts/generate-server-instructions.ts` before building.
4. **Commit**:
   - Once all local tests pass, the subagent will commit the code (`git commit -m "Optimize [group] tool usage"`), create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes, summarize findings, and exit. If no modifications were needed, no commit or journal entry is required.
   - Once the subagent completes, mark the task as done and move to the next test in the queue.
5. **Code Mode Error Testing Protocol**:
   - Subagents executing Code Mode test matrices must anticipate structured `VALIDATION_ERROR` or other domain error payloads with `{ success: false }` for type mismatches, rather than expecting sandbox crashes or thrown raw exceptions.
6. **Tool Availability Warning**:
   - If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user. NOTE: The ecosystem tools (cluster, proxysql, router, shell) are running on a different port/MCP config (`mysql-ecosystem`) than the standard tools/tool groups. Ecosystem should be enabled for them already, but if it isn't working, the subagent MUST let the user know immediately so they can enable it. We want to actively test ecosystem, not just test graceful degradation.
7. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "This is test X out of Y. Fixed Z issues."
   - Do NOT output any other text to the user during the test sequence.

## Test Sequence Queue

1. `test-usability-core-part1.md`
2. `test-usability-core-part2.md`
3. `test-usability-core-part3.md`
4. `test-usability-json-part1.md`
5. `test-usability-json-part2.md`
6. `test-usability-json-part3.md`
7. `test-usability-json-part4.md`
8. `test-usability-text.md`
9. `test-usability-fulltext.md`
10. `test-usability-performance-part1.md`
11. `test-usability-performance-part2.md`
12. `test-usability-performance-part3.md`
13. `test-usability-optimization.md`
14. `test-usability-admin-part1.md`
15. `test-usability-admin-part2.md`
16. `test-usability-monitoring-part1.md`
17. `test-usability-monitoring-part2.md`
18. `test-usability-backup-part1.md`
19. `test-usability-backup-part2.md`
20. `test-usability-replication.md`
21. `test-usability-partitioning.md`
22. `test-usability-transactions-part1.md`
23. `test-usability-transactions-part2.md`
24. `test-usability-router-part1.md`
25. `test-usability-router-part2.md`
26. `test-usability-proxysql-part1.md`
27. `test-usability-proxysql-part2.md`
28. `test-usability-proxysql-part3.md`
29. `test-usability-shell-part1.md`
30. `test-usability-shell-part2.md`
31. `test-usability-schema-part1.md`
32. `test-usability-schema-part2.md`
33. `test-usability-schema-part3.md`
34. `test-usability-events.md`
35. `test-usability-sysschema-part1.md`
36. `test-usability-sysschema-part2.md`
37. `test-usability-stats-part1.md`
38. `test-usability-stats-part2.md`
39. `test-usability-stats-part3.md`
40. `test-usability-stats-part4.md`
41. `test-usability-spatial-part1.md`
42. `test-usability-spatial-part2.md`
43. `test-usability-spatial-part3.md`
44. `test-usability-security-part1.md`
45. `test-usability-security-part2.md`
46. `test-usability-cluster-part1.md`
47. `test-usability-cluster-part2.md`
48. `test-usability-roles-part1.md`
49. `test-usability-roles-part2.md`
50. `test-usability-docstore-part1.md`
51. `test-usability-docstore-part2.md`
52. `test-usability-introspection.md`
53. `test-usability-migration.md`
54. `test-usability-vector-part1.md`
55. `test-usability-vector-part2.md`
56. `test-usability-vector-part3.md`
57. `test-usability-codemode.md`

## Finalization

Once all subagents have completed their tests:

1. Run `pnpm run check` to ensure no type errors or formatting issues were introduced by the optimization layers across subagent boundaries.
2. Message the user: "The usability test suite is complete. Fixes were applied during the run. Please manually restart the server ONCE so we can perform a final live validation sweep."
