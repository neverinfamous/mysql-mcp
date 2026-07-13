# MySQL MCP Advanced Code Mode Testing - Master Index

Due to the extreme length of the Advanced Code Mode test suite (111 tests), the coordinator workflow has been sharded into 4 domain-specific phases. This prevents context-window exhaustion and ensures subagents complete their queues reliably.

## Execution Rules

**CRITICAL**: You MUST start a **new conversation thread** for each phase and provide the agent with the specific phase file (e.g., `test-server/test-advanced/coordinator-workflow-phase1-foundation.md`). 

**DO NOT** instruct a single agent to run all four phases in one thread, as this will lead to the same context exhaustion the sharding is designed to prevent.

## Workflow Rules

1. **Sequential Execution**: Execute tests sequentially per the Dependency DAG below to prevent server conflicts.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt, along with these execution requirements.
3. **Validation and Immediate Continuation**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint` and `pnpm run typecheck`. The subagent MUST NOT run `pnpm run test`, `pnpm run build`, or `pnpm run check` or any other tests, as this takes too long (15-20 minutes). The main coordinator agent will run the full test suite at the end of the phase. Ensure the local checks pass cleanly and any resulting errors are fixed. If the subagent ONLY modified documentation or prompts, they should NOT run any validation.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation.
4. **Finalization and Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - **CRITICAL PRIORITY**: NEVER delete a testing prompt or workflow file after success.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `pnpm run generate:instructions`.
   - The subagent MUST commit all changes locally (`bun .\.agents\scripts\commit.ts --msg "test(codemode): ..." --impact 0.1 --confidence 1.0 --validation passed --journal --add .`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, kill the subagent using the `manage_subagents` tool (action: `kill`), and immediately move to the next test in the queue.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you, and explicitly report if any tests triggered graceful degradation. Instruct the subagent to ALWAYS format this string exactly as **`Y Prompt Fixes / Z Code Fixes / W Graceful Degradations`** (e.g., **`0 Prompt Fixes / 0 Code Fixes / 0 Graceful Degradations`**) in bold at the very top of their final result summary, so you can track that a final live verification sweep will be needed at the very end of the suite, and whether the fix was to the testing prompt itself or code.
   - **CRITICAL FORMATTING NOTE**: You MUST instruct the subagent to explicitly report the number of **fixes** they made to the prompt or the code. Do NOT instruct them to report "successes", as they will incorrectly report how many tests passed rather than how many bugs were fixed.
   - **CRITICAL**: Our setup provides everything for all testing to be successful. There should never be any graceful degradations. If the subagent thinks it is only testing graceful degradation due to a temporary problem in a tool, group of tools, or the entire ecosystem setup, it MUST explicitly inform the user and log it as a graceful degradation. **NOTE: "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. It does NOT refer to successful negative tests (e.g., intentionally triggering a validation error to ensure it is handled gracefully). SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.**
   - **CRITICAL**: The subagent MUST include an explicit status line in their final message: `STATUS: SUCCESS` if the test ran and passed, or `STATUS: FAILED_FILE_NOT_FOUND` if the file does not exist.
   - Ensure subagents explicitly check that Code Mode scripts do NOT leak raw MCP exceptions, returning `{ success: false }` for domain errors.
   - **Tool Availability Warning**: If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user.
   - **CRITICAL ECOSYSTEM REQUIREMENT**: The ecosystem tools (cluster, proxysql, router) run on a different MCP config (`mysql-ecosystem`). When testing any ecosystem tools, the subagent MUST explicitly target the `mysql-ecosystem` server. (Note: MySQL Shell tools MUST target the standard `mysql` server due to X Protocol port mapping restrictions). If the subagent targets the standard `mysql` server, it will improperly test graceful degradation instead of actively testing the live cluster, which is a FAILURE of the test.
5. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "Test X (<test name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (e.g., "Test 32 (Spatial queries part 1) out of 77: 1 Prompt Fixes / 0 Code Fixes / 0 Graceful Degradations")
   - The Coordinator MUST explicitly tell the user after each test exactly how many prompt fixes were made, code fixes were made, and graceful degradations were experienced (there should not be any).
   - Do NOT output any other text to the user during the test sequence. Do not wrap the message in quotes or add preamble.
6. **Strict Verification and Anti-Hallucination**:
   - The Coordinator MUST use the `list_dir` tool on `test-server/test-advanced/` BEFORE starting, and cross-reference the actual directory contents against the list below.
   - The Coordinator MUST explicitly create a checklist in `<appDataDir>\brain\<conversation-id>\task.md` copying the exact Test Sequence Queue to track progress.
   - NEVER rely on memory for filenames or current test counts. ALWAYS read your exact position from the checklist artifact or this file.
   - If a subagent reports `STATUS: FAILED_FILE_NOT_FOUND`, the Coordinator MUST halt the test sequence immediately and report the error to the user. Do NOT blindly increment the counter or count it as a successful test.


## The Phases

### 1. Phase 1: Foundation & Docstore (Tests 1-28)
**File**: `test-server/test-advanced/coordinator-workflow-phase1-foundation.md`
Covers: Admin, Backup, Cluster, Concurrency, Core, Docstore, Events, Fulltext, Introspection.

### 2. Phase 2: JSON, Performance & Infrastructure (Tests 29-55)
**File**: `test-server/test-advanced/coordinator-workflow-phase2-performance.md`
Covers: JSON, Migration, Monitoring, Optimization, Partitioning, Performance, ProxySQL, Replication.

### 3. Phase 3: Security, Routing & Spatial (Tests 56-85)
**File**: `test-server/test-advanced/coordinator-workflow-phase3-security.md`
Covers: Roles, Router, Sandbox, Schema, Security, Sessions, Shell, Spatial.

### 4. Phase 4: Analytics, Types & Vector (Tests 86-111)
**File**: `test-server/test-advanced/coordinator-workflow-phase4-analytics.md`
Covers: Stats, Sys, Text, Transactions, Types, Vector.

## Compatibility with Dynamic Context Audit
This sharded structure is fully compatible with the `/dynamic-context-audit` skill. Audit subagents will enumerate all `.md` files in `test-server/test-advanced/` and automatically verify the sequential test queues within each `coordinator-workflow-phaseX.md` file against the prompt files on disk.
