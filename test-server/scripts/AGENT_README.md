# Test Generation Engine — Agent Instructions

> **This README is optimized for AI agent consumption.** It explains the data-driven templating engine used to generate all tests across the `mysql-mcp` testing suite.

## Architecture

The test generation engine follows a strict "Single Source of Truth" (SSoT) paradigm:

1. **`test-manifest.ts` (SSoT)**: This file contains the complete array of all tests, tracking which tools belong to which test file, what execution mode to use, and what the baseline group is.
2. **`lib/render-template.ts`**: Contains the core layout and boilerplate instructions that are shared universally across the test suite (such as DDL constraints, DML limits, and `mysql_execute_code` constraints).
3. **`content/*.content.md`**: Hand-written Markdown "partials". For tests that require bespoke, organic instructions (e.g., Usability or Advanced Stress tests), these partials contain the custom content and are safely injected into the rendered output.
4. **`generate-tests.ts`**: The main orchestrator. When run, it validates the `test-manifest.ts` against the live `TOOL_GROUPS` definitions, and fully writes all tests into their respective directories.

## Editing Tests

> [!WARNING]
> **NEVER manually edit the `.md` files in the test directories directly.**
> They will be overwritten the next time the generator runs.

Depending on your goal, follow these steps:

- **Adding a new tool to a test / Removing a tool**:
  Update the `tools` array inside the relevant object in `test-manifest.ts`.
- **Modifying universal test instructions**:
  Edit `lib/render-template.ts` or the logic inside `generate-tests.ts`.
- **Modifying custom steps for an existing test**:
  Edit the corresponding `.content.md` file located inside the `content/` directory.

## Execution

After making any changes to the manifest, templates, or partials, you MUST regenerate the tests:

```bash
pnpm run generate:tests
# or
bun test-server/scripts/generate-tests.ts
```

## Validation

The test suite includes `generate-tests.test.ts`, which statically verifies that the test manifest does not contain any hallucinated tools, guaranteeing it stays strictly synchronized with `src/filtering/tool-constants.ts`.
