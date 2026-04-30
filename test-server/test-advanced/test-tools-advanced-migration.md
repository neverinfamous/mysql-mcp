# mysql-mcp Advanced Stress Tests: [migration]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups/test-tool-group-migration.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Checksum & State Corruption Resilience

- [x] 1. Run `mysql_migration_init()` to prepare tracking tables.
- [x] 2. Record a migration `001_base` with `checksum: "ABC"`.
- [x] 3. Attempt to `mysql_migration_apply` a migration named `001_base` but with a conflicting query (which would produce a different checksum). Verify it fails with `{success: false, error: "..."}` citing checksum mismatch.
- [x] 4. Manually update the `_mcp_migrations` tracking table to set the status of `001_base` to a corrupted string (e.g., `PENDING_BROKEN`). Run `mysql_migration_status` and verify it degrades gracefully (reporting an unknown state rather than crashing).

## Category 2: Rollback Boundaries & Idempotency

- [x] 5. Run `mysql_migration_init()` again. Verify it is idempotent and does not wipe existing tracking data.
- [x] 6. Apply a valid migration `002_new_col` that adds a column.
- [x] 7. Run `mysql_migration_rollback` for `002_new_col`. Verify success.
- [x] 8. Attempt to run `mysql_migration_rollback` for `002_new_col` *again*. Verify it returns a structured `{success: false, error: "..."}` stating the migration is already rolled back.
- [x] 9. Attempt to run `mysql_migration_rollback` for a version that was never applied (`003_ghost`). Verify structured failure.

## Category 3: Out-of-Order Execution Tracking

- [x] 10. Apply migration `005_feature_z`.
- [x] 11. Apply migration `003_feature_x`.
- [x] 12. Run `mysql_migration_history`. Verify that the history correctly sorts/displays the applied order vs logical version order, and flags `003_feature_x` as an out-of-order application.
- [x] 13. Run `mysql_migration_status`. Verify it correctly aggregates the total applied count despite the out-of-order execution.

## Category 4: Cleanup Verification

- [x] 14. Drop all test columns generated and explicitly `DROP TABLE _mcp_migrations`. Verify clean removal.
