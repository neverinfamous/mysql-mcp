# Tool Groups Testing Coordinator Workflow

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Tool Groups test suite using subagents.

## Goal
Systematically execute all standard tool group tests in `test-server/test-tool-groups/` to verify behavioral correctness, parameter validation, error handling, and output schemas. You will delegate testing to subagents, ensuring high-fidelity results and structured error handling, while compiling telemetry.

## Workflow Rules

1. **Batched Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time). Because the `mysql-mcp` server uses a Tool Filter (shortcuts) to prevent exceeding IDE limits, the tests are grouped into 11 **Phases** based on the required shortcut.
2. **Subagent Delegation**: 
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file within the current Phase.
   - Provide the exact path to the test file as the subagent's prompt, along with these execution requirements.
3. **Phase Transitions & Server Restarts**:
   - The Coordinator will run continuously *within* each Phase.
   - When a Phase is complete, the Coordinator MUST pause and message the user: *"Phase X complete. Please switch the main config shortcut to `[Next Shortcut]` and manually restart the `mysql-mcp` server. Reply 'ready' when done."*
   - Do NOT proceed to the next Phase until the user replies 'ready'.
4. **Validation and Immediate Continuation (Within a Phase)**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run check; pnpm run build; pnpm run test; pnpm run test:e2e`. They must ensure these pass completely cleanly.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation and immediately report back to the Coordinator.
5. **Finalization and Commit**:
   - Once local CI passes (or if no fixes were needed), the subagent MUST update `UNRELEASED.md` with all changes.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`git commit -m "..."`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, and immediately move to the next test in the current Phase.
   - If the subagent applied any fixes, they MUST explicitly note this in their final message to you so you can track that a final live verification sweep will be needed at the very end of the suite.
6. **Structured Error Handling**:
   - Ensure subagents explicitly check that tools return structured MCP errors, not raw exceptions. Error messages should follow the standard `[LEVEL] [module] [CODE] message (context)` format where applicable.
   - **Tool Availability Warning**: If any tools are unavailable during testing for any reason (e.g., the `ecosystem` group tools which use a different port and MCP configuration), the subagent MUST immediately warn the user. We want to actively test the tools, not just their graceful degradation.
7. **Coordinator Progress Reporting**:
   - The Coordinator MUST provide the user with clear, frequent progress reports. After each subagent finishes, emit a message like: "Test pass 4 out of X completed."
   - The Coordinator MUST keep a running tally of how many total issues were fixed by the subagents.

## Test Sequence Queue (Dependency DAG)

### Phase 1: `starter` shortcut
- `test-core.md` (**MUST PASS FIRST**)
- `test-json-core.md`
- `test-json-enhanced.md`
- `test-json-helpers.md`
- `test-transactions.md`
- `test-text.md`

*(Coordinator pauses: Asks user to switch filter to `dev-power` and restart)*

### Phase 2: `dev-power` shortcut
- `test-schema-management.md`
- `test-schema-routines.md`
- `test-performance-analysis.md`
- `test-performance-anomaly.md`
- `test-fulltext.md`

*(Coordinator pauses: Asks user to switch filter to `dev-analytics` and restart)*

### Phase 3: `dev-analytics` shortcut
- `test-stats-advanced.md`
- `test-stats-descriptive.md`
- `test-stats-window.md`

*(Coordinator pauses: Asks user to switch filter to `ai-data-nosql` and restart)*

### Phase 4: `ai-data-nosql` shortcut
- `test-docstore.md`

*(Coordinator pauses: Asks user to switch filter to `ai-search` and restart)*

### Phase 5: `ai-search` shortcut
- `test-vector-management.md`
- `test-vector-search.md`
- `test-vector-storage.md`

*(Coordinator pauses: Asks user to switch filter to `ai-spatial` and restart)*

### Phase 6: `ai-spatial` shortcut
- `test-spatial-geometry.md`
- `test-spatial-operations.md`
- `test-spatial-queries.md`
- `test-spatial-setup.md`

*(Coordinator pauses: Asks user to switch filter to `dba-monitor` and restart)*

### Phase 7: `dba-monitor` shortcut
- `test-monitoring.md`
- `test-sys.md`
- `test-optimization.md`

*(Coordinator pauses: Asks user to switch filter to `dba-manage` and restart)*

### Phase 8: `dba-manage` shortcut
- `test-admin.md`
- `test-backup.md`
- `test-replication.md`
- `test-partitioning.md`
- `test-events.md`

*(Coordinator pauses: Asks user to switch filter to `dba-secure` and restart)*

### Phase 9: `dba-secure` shortcut
- `test-security.md`
- `test-roles.md`

*(Coordinator pauses: Asks user to switch filter to `dba-schema` and restart)*

### Phase 10: `dba-schema` shortcut
- `test-introspection.md`
- `test-migration.md`
- `test-versioning.md`

*(Coordinator pauses: Asks user to switch filter to `ecosystem` and restart)*

### Phase 11: `ecosystem` shortcut
- `test-cluster-group-replication.md`
- `test-cluster-innodb.md`
- `test-proxysql-config.md`
- `test-proxysql-status.md`
- `test-router.md`
- `test-shell-data.md`
- `test-shell-utils.md`

## Telemetry Collection
When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `memory://metrics/summary`) from all subagents into a final report for the user. Also, report the **Total Number of Issues Fixed** during the entire suite.

## Post-Suite Validation
At the absolute end of the testing suite, check your records. If ANY subagent applied fixes during the run:
1. Message the main agent: "The test suite is complete. Fixes were applied during the run. Please ask the user to restart the server ONCE, and then we will run a final validation sweep."
