# MySQL MCP Tool Groups Testing - Phase 11: Ecosystem

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules

Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

1. **State Management:** Before starting, create a `task.md` artifact with the 22 tests listed below as a checklist. Update it after each test.
2. **Execution:** Execute tests sequentially. Invoke a single `self` subagent for each test.
3. **Reporting:** When a subagent finishes, kill it to save context. You MUST report progress to me using this exact format:
   `Test X (<name>) out of 22: A Prompt Fixes / B Code Fixes / C Infrastructure Absent`

## Subagent Instructions

When calling `invoke_subagent`, you MUST use the following exact prompt (replacing `{test_file}`):

<subagent_prompt>

<task>

Read and execute the usability test: {test_file} (located in `test-server/test-tool-groups/`).

</task>

<instructions>

Follow the rules in `coordinator-workflow-phase11-ecosystem.md`, subject to these strict overrides:

1. **Native MCP Testing:** Test tools organically using `call_mcp_tool`. DO NOT use `run_command` to execute bash scripts as a substitute for MCP tools.

2. **Environment Immutability:** DO NOT modify `mcp_config.json` manually to change ports or environment variables (e.g., bypassing the router). You must test against the default environment provided.

3. **No Full Validation:** DO NOT run `bun run check` or `bun run test` manually. The user will run the tests.

4. **Code Fixes & TDD Verification:** If you make a code fix to resolve a hallucination, you MUST verify it. First, run `bun run lint` and `bun run typecheck` and `bun run build` to ensure your code is clean and will not crash the server. If you edit any `server-instructions/*.md` files, you MUST run `pnpm run generate:instructions` before proceeding. Then, PAUSE and ask the user to manually click the "Refresh" button in the IDE UI to restart the affected MCP server before you continue testing. DO NOT attempt to restart the server as it will not work in AntiGravity.

5. **Infrastructure Absent:** If a tool's primary execution (the "happy path") cannot be completed due to missing infrastructure, credentials, or binaries, you MUST count it as "Infrastructure Absent" (e.g., +1 Infrastructure Absent). You may fix the code to handle the missing infrastructure gracefully, but you MUST still report it as Infrastructure Absent. _(Note: As stated in the test files, replication tests returning `null` on the primary node is a VALID success state, not an infrastructure absence)._

6. **Handoff:** When complete, stop calling tools to await further instructions. DO NOT loop.

7. **Database Locks:** If a test requires DDL operations and fails due to `super_read_only`, you MUST toggle the lock using `run_command` to execute `node test-server/infrastructure/scripts/toggle-super-read.mjs OFF` before the test, and `ON` after. Do not attempt to use `docker exec` or `mysql-node1`.

8. **DO NOT Edit the Test Markdown File:** The `{test_file}` is strictly read-only. DO NOT check the `[ ]` task boxes or fill out the markdown tables inside it, as your manual edits will be wiped out by the generator script. Track all your findings, fuzzed payloads, and results strictly via `mj_execute_code` in your `memory-journal-mcp` entry and your final summary.

- Note: mysql-mcp is project #9 in the memory-journal-mcp system/database.

When creating memory journal entries via `mj_execute_code`, use this exact format to ensure success:

```javascript
mj.core.createEntry({
  content: "Your concise summary of findings/bug fixes here...",
  entry_type: "bug_fix", // or "decision", "architecture" (do NOT use "retrospective")
  tags: ["testing", "mysql-mcp"],
  project_number: 9,
});
```

</instructions>
</subagent_prompt>
## Test Sequence Queue

1. `test-cluster-group-replication-part1.md` (**MUST PASS FIRST**)
2. `test-cluster-group-replication-part3.md`
3. `test-cluster-group-replication-part2.md`
4. `test-cluster-innodb-part1.md`
5. `test-cluster-innodb-part3.md`
6. `test-cluster-innodb-part2.md`
7. `test-proxysql-config-part1.md`
8. `test-proxysql-config-part2.md`
9. `test-proxysql-status-part1a.md`
10. `test-proxysql-status-part1b.md`
11. `test-proxysql-status-part2a.md`
12. `test-proxysql-status-part2b.md`
13. `test-router-core-part1.md`
14. `test-router-core-part2.md`
15. `test-router-routes-part1.md`
16. `test-router-routes-part2.md`
17. `test-router-routes-part3.md`
18. `test-shell-data-part1a.md`
19. `test-shell-data-part1b.md`
20. `test-shell-data-part2a.md`
21. `test-shell-data-part2b.md`
22. `test-shell-utils.md`

## Completion

Once this phase is complete, provide the user a summary.
