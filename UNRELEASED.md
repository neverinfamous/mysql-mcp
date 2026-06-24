# Unreleased Changes

## Fixes

- Fixed `mysql_doc_modify` and `mysql_doc_remove` to properly parse `$.field = 'value'` syntax for filters, and to allow `$.` prefix in `set` and `unset` keys.
- Fixed factual errors in `test-codemode-backup.md` test script (e.g. `mysql_import_data` expects an array of objects, not a filepath; `restoreDump` expects `filename` instead of `inputPath`; `auditRestoreBackup` expects `filename` instead of `backupId`).
- Fixed missing aliases `roleName` and `userName` in `mysql_role_create`, `mysql_role_drop`, `mysql_role_assign`, `mysql_role_revoke`, `mysql_role_grant`, `mysql_role_grants`, and `mysql_user_roles`.
- Fixed missing `limit` parameter handling in `mysql_role_list` via split schema.
- Added missing `limit` parameter handling in `mysql_security_firewall_rules` via split schema.
- Added `help()` method to codemode API groups so `mysql.<group>.help()` works as documented.
- Added `scriptPath` and `dryRun` parameters to `mysqlsh_run_script` with strict IO root path validation.
- Added parameter aliases `vector` (for `queryVector`), `distance` (for `maxDistance`), and `query` (for `queryText`) to vector search tools via `preprocessVectorParams` split schema wrapper.
- Fixed factual errors in `test-codemode-json-core-read.md` test script regarding expected JSON path keys and values.
- Fixed `mysql_json_merge` to properly parse and return array values when the database adapter returns stringified JSON.
- Fixed `JsonGetOutputSchema` to match `mysql_json_get` output structure (`value` and `rowFound` instead of `rows` and `count`).
- Fixed factual errors in `test-codemode-json-helpers.md` by removing a domain error test for `mysql_json_validate`, since `JSON_VALID` correctly evaluates strings instead of throwing.
