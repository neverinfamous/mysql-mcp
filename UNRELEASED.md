# Unreleased Changes

## Fixes

- Fixed `mysql_doc_modify` and `mysql_doc_remove` to properly parse `$.field = 'value'` syntax for filters, and to allow `$.` prefix in `set` and `unset` keys.
- Fixed factual errors in `test-codemode-backup.md` test script (e.g. `mysql_import_data` expects an array of objects, not a filepath; `restoreDump` expects `filename` instead of `inputPath`; `auditRestoreBackup` expects `filename` instead of `backupId`).
- Fixed missing aliases `roleName` and `userName` in `mysql_role_create`, `mysql_role_drop`, `mysql_role_assign`, `mysql_role_revoke`, `mysql_role_grant`, `mysql_role_grants`, and `mysql_user_roles`.
- Fixed missing `limit` parameter handling in `mysql_role_list` via split schema.
- Added `help()` method to codemode API groups so `mysql.<group>.help()` works as documented.
