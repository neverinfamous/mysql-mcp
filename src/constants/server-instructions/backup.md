# Backup Tools

Tools: `mysql_export_table`, `mysql_import_data`, `mysql_create_dump`, `mysql_restore_dump`, `mysql_audit_list_backups`, `mysql_audit_restore_backup`, `mysql_audit_diff_backup`

- **Export formats**: `mysql_export_table` supports SQL (INSERT statements) and CSV formats. CSV export escapes JSON columns with double-quote encoding. Consider SQL format for JSON-heavy tables.
- **Export pagination & batching**: Returns at most 5 rows by default. Use `limit` parameter to override. Use `batch` parameter (default: 1) to group rows into multi-row INSERT statements (e.g., `batch: 50`).
- **Export filtering**: Use `where` parameter to export subsets: `where: "category = 'electronics'"`.
- **Export error handling**: Returns a structured error with `code: "TABLE_NOT_FOUND"` for nonexistent tables and standard handler errors for query issues.
- **Import data**: `mysql_import_data` requires an array of row objects and the target table to exist. Validates column identifiers upfront. Automatically formats ISO 8601 date strings by stripping `T` and `Z` characters.
- **Import error handling**: Returns structured errors (e.g., `VALIDATION_ERROR`, `TABLE_NOT_FOUND`) reporting `details.rowsInserted`.
- **Dump commands**: `mysql_create_dump` and `mysql_restore_dump` generate `mysqldump` or `mysql <` command strings—they do **NOT** execute directly. You must manually execute the returned command in the terminal.

## Audit Backups

- **Audit Backup availability**: These interact with the Audit Subsystem's pre-mutation snapshots. If disabled, they return a `CONFIGURATION_ERROR`.
- **List backups**: `mysql_audit_list_backups` has no required parameters, legitimately returns up to 10 latest backups. Use `table` parameter to filter.
- **Diff backup**: `mysql_audit_diff_backup` provides a row-level differential. If the table was dropped, it safely returns a placeholder string. Returns `{ success: false, error }` for invalid `backupId`. Note: Requires a `filename` parameter, not `table` or `target`. Aliases: `diff`, `auditDiff`, `diffBackup`.
- **Restore backup**: `mysql_audit_restore_backup` restores a specific table. Set `dryRun: true` (default) to safely view the DDL and DML of a snapshot before actually executing the restoration. Note: Requires a `filename` parameter, not `table` or `target`.
