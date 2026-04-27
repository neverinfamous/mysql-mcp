# mysql-mcp Advanced Stress Tests: [sys]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-sys.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Payload Efficiency Audit

1. `mysql_sys_user_summary()` → log token estimate
2. `mysql_sys_io_summary()` → log token estimate
3. `mysql_sys_statement_summary()` → log token estimate
4. `mysql_sys_wait_summary()` → log token estimate
5. `mysql_sys_innodb_lock_waits()` → log token estimate
6. `mysql_sys_schema_stats()` → log token estimate
7. `mysql_sys_host_summary()` → log token estimate
8. `mysql_sys_memory_summary()` → log token estimate
9. Flag any response > 500 tokens as 📦

## Category 2: Empty State Handling

10. `mysql_sys_innodb_lock_waits()` → verify clean empty response when no locks exist (should be `{success: true}` with empty or zero-length data, not an error)
11. Verify response shape is consistent with other sys tools (same top-level keys)

## Category 3: Sequential Stability

12. Call all 8 sys tools in rapid sequence within a single Code Mode script → verify all return `{success: true}`
13. Repeat the full sequence a second time → verify identical success pattern (no resource leaks or connection exhaustion)
