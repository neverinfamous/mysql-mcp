# MySQL-MCP Testing Guide

[![Tools](https://img.shields.io/badge/Tools-200%2B-blue?style=for-the-badge)](#)
[![Resources](https://img.shields.io/badge/Resources-23-green?style=for-the-badge)](#)
[![Prompts](https://img.shields.io/badge/Prompts-19-purple?style=for-the-badge)](#)
<br>
[![OAuth 2.1](https://img.shields.io/badge/OAuth-2.1-red?style=for-the-badge)](#)
[![Code Mode](https://img.shields.io/badge/Code-Mode-orange?style=for-the-badge)](#)

## Value Proposition
- Build AI integrations instantly.
- Empower agents with secure database access.
- Execute complex logic via Code Mode.
- Scale operations with robust connection pooling.
- Leverage OAuth 2.1 for enterprise security.

The testing infrastructure for `mysql-mcp` is split into four directories, matching the `db-mcp` gold standard:

1. **`test-server/test-tool-groups/`**: Basic functionality tests for all tool groups.
2. **`test-server/test-codemode/`**: Code Mode (`mysql_execute_code`) functionality tests.
3. **`test-server/test-advanced/`**: Advanced stress tests using Code Mode (nesting, RFC compliance, security, etc.).
4. **`test-server/test-usability/`**: Usability, hallucination fuzzing, and prompt tuning via Code Mode.

## Standardization

All 263 test prompts are strictly standardized using a template-driven approach.

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
| Password  | `password`    |
| Database  | `testdb`      |
| Container | `mysql-final` |
