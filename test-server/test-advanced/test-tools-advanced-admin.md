# mysql-mcp Advanced Stress Tests: [admin]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups/test-tool-group-admin.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Error Message Quality

1. For each tool group, pass intentionally invalid parameters and capture the error message
2. Verify error messages are human-readable (not raw MySQL error codes)
3. Verify error messages include the relevant entity name (table, column, etc.)

## Category 2: Type Mismatches

4. Pass string where number expected for all tools with numeric params
5. Pass number where string expected (e.g., `table: 123`)
6. Pass array where string expected
7. All must return structured errors, NOT raw MCP `-32602`

## Category 3: Payload Monitoring

8. Call `mysql_innodb_status()` without summary — log token estimate
9. Call `mysql_innodb_status({summary: true})` — log token estimate, verify reduction
10. Call `mysql_show_status()` without filter — log token estimate
11. Call `mysql_show_variables()` without filter — log token estimate
12. Flag any response > 500 tokens as 📦

## Category 4: Health Check Workflow

13. Execute full health check: `serverHealth()` → `analyzeTable()` → `checkTable()` → `tableStats()`
14. Verify no error accumulation across sequential admin operations
