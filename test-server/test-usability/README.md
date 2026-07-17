# MySQL MCP Usability Testing Suite

**AGENT INSTRUCTIONS**

This directory contains organic prompts to fuzz tools and trigger hallucinations. The goal is to verify tools are intuitive and robust for AI agents.

## Understand Testing Philosophy
These prompts instruct agents to act intuitively and purposefully omit syntax.
When an agent fails, they must heal the codebase.
Use the optimization layers described in `../../skills/mysql-mcp-heal/SKILL.md`.

## Execute Fuzzing Workflow

Please defer entirely to `coordinator-workflow.md` for orchestration steps and rules.

> **Validation Strictness Note**: If you or a subagent modifies the codebase, run ONLY `pnpm run lint` and `pnpm run typecheck`. Do NOT run `pnpm run test` or `pnpm run check`. Do NOT run validation for documentation-only changes. The coordinator will handle fixing broken tests at the end of the test suite.

## Access Available Test Files

> **Note**: Please refer to [`test-manifest.ts`](../scripts/test-manifest.ts) and the [`test-server/scripts/generate-tests.ts`](../scripts/generate-tests.ts) engine for the definitive test list and generation logic. Refer to [`coordinator-workflow.md`](coordinator-workflow.md) for the orchestration sequence.
