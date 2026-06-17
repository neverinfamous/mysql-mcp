# Backup Tools Gotchas

This document outlines important operational characteristics and rules for using the backup-related tools (`mysql_export_table`, `mysql_import_data`, `mysql_create_dump`, `mysql_restore_dump`, and audit backups).

## 1. Dump Tools Only Generate Commands
- **`mysql_create_dump`** and **`mysql_restore_dump`** do **NOT** execute the backup or restore directly against the database via the MCP adapter.
- Instead, they return a formatted `mysqldump` or `mysql <` command string.
- You must manually execute the returned command in the terminal to actually perform the backup or restore.

## 2. Parameter Idiosyncrasies
- **`mysql_import_data`**: Requires an array of row objects. It validates column identifiers upfront to prevent SQL injection and processes rows in batches. It also automatically formats ISO 8601 date strings by stripping the `T` and `Z` characters to maintain compatibility with standard MySQL datetime columns.
- **`mysql_export_table`**: When returning SQL format, it structures the output as bulk `INSERT INTO` statements. When using CSV format, it strips nulls and escapes double quotes appropriately.
- **`mysql_audit_list_backups`**: Has no required parameters. Calling it with `{}` or no arguments legitimately returns up to 10 of the latest backups.

## 3. Audit Backups
- The `audit-backup` tools interact with the Audit Subsystem's pre-mutation snapshots.
- **`mysql_audit_restore_backup`**: Supports a `dryRun: true` parameter. This is extremely useful for safely viewing the DDL and DML of a snapshot before actually executing the restoration.
- **`mysql_audit_diff_backup`**: Compares the snapshot's DDL against the live schema. If the table has been dropped, it safely returns a placeholder string indicating the object does not exist in the current schema rather than throwing an unhandled exception.
