# Unreleased

## Added
- **Instruction Filter Alignment**: Server instructions now align with `--tool-filter` — only documentation for enabled tool groups is included in MCP instructions. Added `SECTION_GROUP_MAP` and runtime `filterInstructionsByGroup()` that splits `BASE_INSTRUCTIONS` at `## ` heading boundaries, including only sections for enabled groups. Unmapped sections (Server Identity, Parameter Aliases, Code Mode) are always included.
- **Integration Test**: Added `test-database/test-instruction-levels.mjs` to verify instruction filtering behavior.
