# mysql-mcp Advanced Stress Tests: [monitoring]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-monitoring.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Payload Efficiency

1. `mysql_show_processlist()` → log token estimate
2. `mysql_show_status()` with no filter → log token estimate
3. `mysql_show_status({like: "Uptime"})` → log token estimate, verify drastic reduction vs. unfiltered
4. `mysql_show_variables()` with no filter → log token estimate
5. `mysql_show_variables({like: "max_connections"})` → log token estimate, verify reduction
6. Flag any unfiltered response > 500 tokens as 📦

## Category 2: Summary Mode Parity

7. `mysql_innodb_status()` full → log token estimate
8. `mysql_innodb_status({summary: true})` → log token estimate
9. Verify summary token estimate is ≥ 50% smaller than full output

## Category 3: Filter Edge Cases

10. `mysql_show_status({like: ""})` → verify behavior (empty filter)
11. `mysql_show_status({like: "%"})` → verify returns same as no filter
12. `mysql_show_variables({like: "nonexistent_var_xyz_12345"})` → verify empty result set (not error)
13. `mysql_show_status({like: "Com_%"})` → verify wildcard filter returns subset

## Category 4: Sequential Stability

14. Call `mysql_server_health()` 5 times in rapid succession → verify all return `{success: true}` with no error accumulation
15. Call `mysql_pool_stats()` between health checks → verify pool metrics remain stable
