# Backup Tools (`mysql_export_table`, `mysql_import_data`, etc.)

- **Export formats**: `mysql_export_table` supports SQL (INSERT statements) and CSV formats.
- **Default limit**: `mysql_export_table` returns at most 5 rows by default. Use `limit` parameter to override.
- **Batched INSERT**: Use `batch` parameter (default: 1) to group rows into multi-row INSERT statements for smaller payloads. Example: `batch: 50` produces `INSERT INTO ... VALUES (...), (...), ...` with up to 50 rows per statement.
- **WHERE filtering**: Use `where` parameter to export subsets: `where: "category = 'electronics'"`.
- **CSV and JSON columns**: CSV export escapes JSON columns with double-quote encoding—valid but complex. Consider SQL format for JSON-heavy tables.
- **Export error handling**: `mysql_export_table` returns a structured error with `code: "TABLE_NOT_FOUND"` for nonexistent tables and standard handler errors for other query issues (e.g., invalid WHERE clause, unknown column). No raw exceptions are thrown.
- **Import prerequisite**: `mysql_import_data` requires the target table to already exist. Returns a structured error with `code: "TABLE_NOT_FOUND"` gracefully if the table does not exist.
- **Import error handling**: `mysql_import_data` returns structured errors (e.g., `VALIDATION_ERROR`, `TABLE_NOT_FOUND`) for all insertion failures instead of throwing, reporting how many rows were successfully inserted before the error via `details.rowsInserted`.
- **Dump commands**: `mysql_create_dump` and `mysql_restore_dump` generate CLI commands—they do not execute directly.

## Audit Backups (`mysql_audit_list_backups`, `mysql_audit_restore_backup`, `mysql_audit_diff_backup`)

- **Audit Backup availability**: These tools interact with the Audit Backup Manager, which creates data snapshots before destructive operations when `--audit-backup` is enabled. If disabled, these tools return a structured `CONFIGURATION_ERROR` error indicating the feature is not enabled.
- **List backups**: `mysql_audit_list_backups` lists available backups. Use `limit` parameter to restrict the output (default: 10). Use `table` parameter to filter snapshots by table name.
- **Diff backup**: `mysql_audit_diff_backup` provides a row-level differential between the current table state and the snapshot state. Requires a valid `backupId`. Returns `{ success: false, error }` if the backup ID does not exist.
- **Restore backup**: `mysql_audit_restore_backup` restores a specific table to its snapshot state. Requires `backupId`. Set `dryRun: true` (default) to preview the restore actions (INSERTs, UPDATEs, DELETEs) without executing them. Set `dryRun: false` to actually apply the changes. Returns `{ success: false, error }` if the backup ID does not exist.
