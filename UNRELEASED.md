# Unreleased

## Changed
- **Help Resource Architecture**: Replaced 53KB monolithic `ServerInstructions.ts` with slim `INSTRUCTIONS` constant (~634 chars) + on-demand `mysql://help` resources. Agent instructions are now ~95% smaller; detailed tool reference is available via `mysql://help` (always) and `mysql://help/{group}` (filtered by `--tool-filter`).

## Added
- **Help Resources**: 24 group-specific help resources (`mysql://help/{group}`) registered dynamically based on tool filter configuration, plus `mysql://help` (gotchas, aliases, Code Mode API) always available.
- **Generator Script**: `scripts/generate-server-instructions.ts` reads per-group `.md` files and produces `server-instructions.ts` with `INSTRUCTIONS` + `HELP_CONTENT` exports.
- **Agent Experience Test**: `test-server/test-agent-experience.md` — 35 open-ended scenarios across 8 passes validating help resource sufficiency for cold-start agent operation.
- **Test Files Tracked**: `.gitignore` updated to track test documentation (`.md`, `.mjs`, `.ps1`, `.sql`) while ignoring only runtime files.

## Fixed
- **Admin DDL Result Parsing**: Switched `mysql_optimize_table`, `mysql_analyze_table`, `mysql_repair_table` from `executeQuery` to `rawQuery` — prevents mysql2 prepared-statement fallback from corrupting multi-result-set admin DDL responses. Matches `mysql_check_table`'s existing pattern.
- **Multi-Result-Set Handling**: Hardened `processExecutionResult` to detect mysql2 nested arrays (multi-result-set) and ResultSetHeader-in-array edge cases from `query()` fallback.

## Removed
- **Instruction Levels**: Removed `ServerInstructions.ts` monolith, `generateInstructions()`, `filterInstructionsByGroup()`, and `SECTION_GROUP_MAP`.

