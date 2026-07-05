# MySQL-MCP Testing Guide

The testing infrastructure for `mysql-mcp` is split into three directories, matching the `db-mcp` gold standard:

1. **`test-server/test-tool-groups/`**: Basic functionality tests for all tool groups.
2. **`test-server/test-codemode/`**: Code Mode (`mysql_execute_code`) functionality tests.
3. **`test-server/test-advanced/`**: Advanced stress tests using Code Mode (nesting, RFC compliance, security, etc.).

## Standardization

All 174 test prompts are strictly standardized using a template-driven approach.

To update or expand tests:
1. Do not edit boilerplate manually.
2. Edit `test-server/scripts/prompt-template.md` to change global rules, or edit the test content sections of the specific test files.
3. Run `node test-server/scripts/standardize-prompts.js` to rebuild all prompts.

## Core Testing Rules

The core testing rules (Error Quality Rating, Zod validation handling, Split Schema verification, and P154 tests) are injected directly into every test prompt. See `prompt-template.md` for the full rule set.

## Reset mysql-mcp Test Database

If you need to reset the test database to its initial seeded state:

```powershell
node scripts/reset-database.mjs
```

## Connection Details

| Property  | Value         |
| --------- | ------------- |
| Host      | `localhost`   |
| Port      | `3306`        |
| User      | `root`        |
| Password  | `root`        |
| Database  | `testdb`      |
| Container | `mysql-final` |
