# Agent Usability & Hallucination Testing

**🤖 AGENT INSTRUCTIONS**

This directory contains organic prompts to fuzz tools and trigger hallucinations. The goal is to verify tools are intuitive and bulletproof for AI agents.

## Understand Testing Philosophy
These prompts instruct agents to act intuitively and purposefully omit syntax.
When an agent fails, they must heal the codebase.
Use the optimization layers described in `skills/mysql-mcp-heal/SKILL.md`.

## Execute Fuzzing Workflow

Please defer entirely to `coordinator-workflow.md` for orchestration steps and rules.

> **Validation Strictness Note**: If you or a subagent modifies the codebase, run ONLY `pnpm run lint` and `pnpm run typecheck`. Do NOT run `pnpm run test` or `pnpm run check`. Do NOT run validation for documentation-only changes. The coordinator will handle fixing broken tests at the end of the test suite.

## Access Available Test Files

- `test-usability-admin-part1.md`
- `test-usability-admin-part2.md`
- `test-usability-admin-part3.md`
- `test-usability-backup-part1.md`
- `test-usability-backup-part2.md`
- `test-usability-backup-part3.md`
- `test-usability-cluster-part1.md`
- `test-usability-cluster-part2.md`
- `test-usability-cluster-part3.md`
- `test-usability-cluster-part4.md`
- `test-usability-codemode.md`
- `test-usability-core-part1.md`
- `test-usability-core-part2.md`
- `test-usability-core-part3.md`
- `test-usability-core-part4.md`
- `test-usability-docstore-part1.md`
- `test-usability-docstore-part2.md`
- `test-usability-docstore-part3.md`
- `test-usability-events-part1.md`
- `test-usability-events-part2.md`
- `test-usability-fulltext-part1.md`
- `test-usability-fulltext-part2.md`
- `test-usability-introspection-part1.md`
- `test-usability-introspection-part2.md`
- `test-usability-json-part1.md`
- `test-usability-json-part2.md`
- `test-usability-json-part3.md`
- `test-usability-json-part4.md`
- `test-usability-json-part5.md`
- `test-usability-json-part6.md`
- `test-usability-migration-part1.md`
- `test-usability-migration-part2.md`
- `test-usability-monitoring-part1.md`
- `test-usability-monitoring-part2.md`
- `test-usability-monitoring-part3.md`
- `test-usability-optimization-part1.md`
- `test-usability-optimization-part2.md`
- `test-usability-partitioning-part1.md`
- `test-usability-partitioning-part2.md`
- `test-usability-performance-part1.md`
- `test-usability-performance-part2.md`
- `test-usability-performance-part3.md`
- `test-usability-performance-part4.md`
- `test-usability-proxysql-part1.md`
- `test-usability-proxysql-part2.md`
- `test-usability-proxysql-part3.md`
- `test-usability-proxysql-part4.md`
- `test-usability-replication-part1.md`
- `test-usability-replication-part2.md`
- `test-usability-roles-part1.md`
- `test-usability-roles-part2.md`
- `test-usability-roles-part3.md`
- `test-usability-router-part1.md`
- `test-usability-router-part2.md`
- `test-usability-router-part3.md`
- `test-usability-schema-part1.md`
- `test-usability-schema-part2.md`
- `test-usability-schema-part3.md`
- `test-usability-schema-part4.md`
- `test-usability-security-part1.md`
- `test-usability-security-part2.md`
- `test-usability-security-part3.md`
- `test-usability-shell-part1.md`
- `test-usability-shell-part2.md`
- `test-usability-shell-part3.md`
- `test-usability-shell-part4.md`
- `test-usability-spatial-part1.md`
- `test-usability-spatial-part2.md`
- `test-usability-spatial-part3.md`
- `test-usability-spatial-part4.md`
- `test-usability-stats-part1.md`
- `test-usability-stats-part2.md`
- `test-usability-stats-part3.md`
- `test-usability-stats-part4.md`
- `test-usability-stats-part5.md`
- `test-usability-stats-part6.md`
- `test-usability-stats-part7.md`
- `test-usability-sysschema-part1.md`
- `test-usability-sysschema-part2.md`
- `test-usability-sysschema-part3.md`
- `test-usability-text-part1.md`
- `test-usability-text-part2.md`
- `test-usability-transactions-part1.md`
- `test-usability-transactions-part2.md`
- `test-usability-transactions-part3.md`
- `test-usability-vector-part1.md`
- `test-usability-vector-part2.md`
- `test-usability-vector-part3.md`
- `test-usability-vector-part4.md`
