# Code Mode Test: Versioning (OCC)

## Scenario
You are managing an optimistic concurrency control system for the `testdb` database via Code Mode scripts.

## Tasks

### 1. Enable Versioning
- Use `mysql_execute_code` to write a script that calls `mysql.core.mysql_enable_versioning({ table: 'inventory' })`.
- Verify success.

### 2. Check Version
- Use `mysql_execute_code` to retrieve the current version of the item with `id = 1` in the `inventory` table via `mysql.core.mysql_check_version({ table: 'inventory', rowId: 1 })`.

### 3. Conditional Update (Success & Conflict)
- Write a Code Mode script that:
  1. Uses `mysql_conditional_update` to update `inventory` for `id = 1`, passing the version retrieved above.
  2. Attempts a second `mysql_conditional_update` on the same row, reusing the old version.
  3. Catches the error from the second update and returns it cleanly.
- Verify the script succeeds overall, but correctly traps and exposes the `Version conflict` error in the output.

### 4. Disable Versioning
- Use `mysql_execute_code` to call `mysql.core.mysql_disable_versioning({ table: 'inventory' })`.
- Verify success.
