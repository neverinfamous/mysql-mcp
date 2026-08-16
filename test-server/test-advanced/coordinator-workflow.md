# MySQL MCP Advanced Code Mode Testing - Master Index

This directory contains the advanced Code Mode testing suite, focusing on complex scenarios and edge cases.

## Execution Rules

1. **State Management:** Before starting, create a `task.md` artifact with the 4 tests listed below as a checklist. Update it after each test.
2. **Execution:** Execute tests sequentially. Invoke a single `self` subagent for each test.
3. **Reporting:** When a subagent finishes, kill it to save context. You MUST report progress to me using this exact format: 
   `Test X (<name>) out of 4: A Prompt Fixes / B Code Fixes / C Infrastructure Absent`

## Subagent Instructions

When calling `invoke_subagent`, you MUST use the following exact prompt (replacing `{test_file}`):

<subagent_prompt>

<task>

Read and execute the usability test: {test_file} (located in `test-server/test-advanced/`).

</task>

<instructions>

Follow the rules in `coordinator-workflow.md`, subject to these strict overrides:

1. **Code Mode Testing:** Test tools using Code Mode (`mysql_execute_code`). DO NOT use `call_mcp_tool` directly or `run_command` to execute bash scripts as a substitute for MCP tools.

2. **Environment Immutability:** DO NOT modify `mcp_config.json` manually to change ports or environment variables (e.g., bypassing the router). You must test against the default environment provided.

3. **No Full Validation:** DO NOT run `pnpm run check` or `pnpm run test` manually. The restart script handles all necessary compilation.

4. **Code Fixes & TDD Verification:** If you make a code fix to resolve a hallucination, you MUST verify it. First, run `pnpm run lint` and `pnpm run typecheck` to ensure your code is clean and will not crash the server. Then, PAUSE and ask the user to manually click the "Refresh" button in the IDE UI to restart the server before you continue testing. DO NOT attempt to run any scripts like `restart-mcp.ts` as they will not work.

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

## Compatibility with Dynamic Context Audit

This structure is fully compatible with the `/dynamic-context-audit` skill. Audit subagents will enumerate all `.md` files in `test-server/test-advanced/` and automatically verify the sequential test queues.

## Test Sequence Queue

- [test-codemode-advanced-concurrency.md](test-codemode-advanced-concurrency.md)
- [test-codemode-advanced-types-binary.md](test-codemode-advanced-types-binary.md)
- [test-codemode-advanced-types-date.md](test-codemode-advanced-types-date.md)
- [test-codemode-advanced-types-json.md](test-codemode-advanced-types-json.md)
