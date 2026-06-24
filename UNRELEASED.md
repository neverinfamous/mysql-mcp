# Unreleased Changes

## Fixes

- Fixed `mysql_doc_modify` and `mysql_doc_remove` to properly parse `$.field = 'value'` syntax for filters, and to allow `$.` prefix in `set` and `unset` keys.
- Fixed factual errors in `test-codemode-backup.md` test script (e.g. `mysql_import_data` expects an array of objects, not a filepath; `restoreDump` expects `filename` instead of `inputPath`; `auditRestoreBackup` expects `filename` instead of `backupId`).
