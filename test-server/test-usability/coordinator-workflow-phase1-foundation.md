# MySQL MCP Usability Testing - Phase 1: Foundation (Core, JSON, Text)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 23).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 1: Foundation (Core, JSON, Text))

> [!WARNING]
> **ANTI-EXHAUSTION ARCHITECTURE**
> Do NOT execute these tests in a single thread. The 89 tests have been sharded into 4 phases to prevent LLM context window exhaustion.
> 
> **How to run:**
> 1. Start a NEW thread for Phase 1 and pass the agent the `coordinator-workflow-phase1-foundation.md` file.
> 2. When Phase 1 completes, start a NEW thread for Phase 2, etc.

### Execution Phases:
- [Phase 1: Foundation (Core, JSON, Text)](coordinator-workflow-phase1-foundation.md)
- [Phase 2: Admin & Performance](coordinator-workflow-phase2-admin.md)
- [Phase 3: Schema & Stats](coordinator-workflow-phase3-schema.md)
- [Phase 4: Analytics & Advanced](coordinator-workflow-phase4-analytics.md)

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.
