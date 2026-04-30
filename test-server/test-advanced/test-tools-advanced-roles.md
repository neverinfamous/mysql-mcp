# mysql-mcp Advanced Stress Tests: [roles]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-roles.md` MUST pass first.

## Post-Test: Drop all `stress_*` roles. Fix findings, update changelog, commit without pushing.

---

## Category 1: Role Lifecycle Collisions

1. `mysql_role_create({name: "stress_role_a"})` → success
2. `mysql_role_create({name: "stress_role_a"})` again → verify structured `{success: false}` (duplicate)
3. `mysql_role_drop({name: "stress_role_nonexist"})` → verify structured `{success: false}` (not found)

## Category 2: Privilege Grant/Revoke Sequences

4. `mysql_role_grant({role: "stress_role_a", privilege: "SELECT", on: "testdb.*"})` → success
5. `mysql_role_grants({role: "stress_role_a"})` → verify SELECT is listed
6. `mysql_role_grant({role: "stress_role_a", privilege: "INSERT", on: "testdb.*"})` → success
7. `mysql_role_grants({role: "stress_role_a"})` → verify both SELECT and INSERT are listed
8. `mysql_role_revoke({role: "stress_role_a", privilege: "SELECT", on: "testdb.*"})` → success
9. `mysql_role_grants({role: "stress_role_a"})` → verify SELECT is removed, INSERT remains

## Category 3: Cascading Assign/Revoke Verification

10. `mysql_role_grant({role: "stress_role_a", privilege: "SELECT", on: "testdb.*"})` → re-grant
11. Verify `mysql_role_grants` reflects the re-granted privilege
12. `mysql_role_drop({name: "stress_role_a"})` → drop role entirely

## Category 4: Parameter Alias Parity

13. `mysql_role_grants` with `name` param → verify identical response to `role` param
14. `mysql_role_grant` with `privilege` and `on` aliases → verify structured success

## Category 5: Error Quality

15. `mysql_role_grant({role: "stress_role_nonexist", privilege: "SELECT", on: "testdb.*"})` → verify structured `{success: false}` (role not found)
16. `mysql_role_revoke({role: "stress_role_nonexist", privilege: "SELECT", on: "testdb.*"})` → verify structured `{success: false}`

## Cleanup

17. Drop all `stress_*` roles
