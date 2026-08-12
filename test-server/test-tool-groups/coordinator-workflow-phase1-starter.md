# MySQL MCP Tool Groups Testing - Phase 1: Starter

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules

Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

1. **State Management:** Before starting, create a `task.md` artifact with the 24 tests listed below as a checklist. Update it after each test.
2. **Execution:** Execute tests sequentially. Invoke a single `self` subagent for each test.
3. **Reporting:** When a subagent finishes, kill it to save context. You MUST report progress to me using this exact format: 
   `Test X (<name>) out of 24: A Prompt Fixes / B Code Fixes / C Infrastructure Absent`

## Subagent Instructions

When calling `invoke_subagent`, you MUST use the following exact prompt (replacing `{test_file}`):

<subagent_prompt>

<task>

Read and execute the usability test: {test_file} (located in `test-server/test-tool-groups/`).

</task>

<instructions>

Follow the rules in `coordinator-workflow-phase1-starter.md`, subject to these strict overrides:

1. **Native MCP Testing:** Test tools organically using `call_mcp_tool`. DO NOT use `run_command` to execute bash scripts as a substitute for MCP tools.

2. **Environment Immutability:** DO NOT modify `mcp_config.json` manually to change ports or environment variables (e.g., bypassing the router). You must test against the default environment provided.

3. **No Full Validation:** DO NOT run `pnpm run check` or `pnpm run test` manually. The restart script handles all necessary compilation.

4. **Code Fixes & TDD Verification:** If you make a code fix to resolve a hallucination, you MUST verify it. First, run `pnpm run lint` and `pnpm run typecheck` to ensure your code is clean and will not crash the server. If you edit any `server-instructions/*.md` files, you MUST run `pnpm run generate:instructions` before proceeding. Then, PAUSE and ask the user to manually click the "Refresh" button in the IDE UI to restart the affected MCP server before you continue testing. DO NOT attempt to run any scripts like `restart-mcp.ts` as they will not work.

5. **Infrastructure Absent:** If a tool's primary execution (the "happy path") cannot be completed due to missing infrastructure, credentials, or binaries, you MUST count it as "Infrastructure Absent" (e.g., +1 Infrastructure Absent). You may fix the code to handle the missing infrastructure gracefully, but you MUST still report it as Infrastructure Absent. *(Note: As stated in the test files, replication tests returning `null` on the primary node is a VALID success state, not an infrastructure absence).*

6. **Handoff:** When complete, stop calling tools to await further instructions. DO NOT loop.

7. **Database Locks:** If a test requires DDL operations and fails due to `super_read_only`, you MUST toggle the lock using `run_command` to execute `node test-server/infrastructure/scripts/toggle-super-read.mjs OFF` before the test, and `ON` after. Do not attempt to use `docker exec` or `mysql-node1`.

8. **DO NOT Edit the Test Markdown File:** The `{test_file}` is strictly read-only. DO NOT check the `[ ]` task boxes or fill out the markdown tables inside it, as your manual edits will be wiped out by the generator script. Track all your findings, fuzzed payloads, and results strictly via `mj_execute_code` in your `memory-journal-mcp` entry and your final summary.

* Note: mysql-mcp is project #9 in the memory-journal-mcp system/database.

When creating memory journal entries via `mj_execute_code`, use this exact format to ensure success:
```javascript
mj.core.createEntry({
  content: "Your concise summary of findings/bug fixes here...",
  entry_type: "bug_fix", // or "decision", "architecture" (do NOT use "retrospective")
  tags: ["testing", "mysql-mcp"],
  project_number: 9
});
```

</instructions>
</subagent_prompt>
## Test Sequence Queue

1. `test-core-read-part1.md` (**MUST PASS FIRST**)
2. `test-core-read-part2.md`
3. `test-core-write-part1.md`
4. `test-core-write-part2.md`
5. `test-json-core-read-part1.md`
6. `test-json-core-read-part2.md`
7. `test-json-core-write-part1.md`
8. `test-json-core-write-part3.md`
9. `test-json-core-write-part2.md`
10. `test-json-enhanced-part1.md`
11. `test-json-enhanced-part2-part1.md`
12. `test-json-enhanced-part2-part2.md`
13. `test-json-helpers-part1.md`
14. `test-json-helpers-part2.md`
15. `test-text-part1a.md`
16. `test-text-part1c.md`
17. `test-text-part1b.md`
18. `test-text-part1d.md`
19. `test-transactions-part1a.md`
20. `test-transactions-part1b.md`
21. `test-transactions-part2a.md`
22. `test-transactions-part2b.md`
23. `test-versioning-part1.md`
24. `test-versioning-part2.md`

## Completion

Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed:

1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.
