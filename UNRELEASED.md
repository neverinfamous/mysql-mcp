# Unreleased Changes

## Fixes

- Fixed `mysql_role_list` query to inline the validated limit parameter instead of parameterizing it, avoiding `Incorrect arguments to mysqld_stmt_execute` driver errors.
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
- Fixed factual errors in `test-codemode-migration.md` and `test-migration.md` by targeting an active migration instead of a rolled-back migration to properly assert `DUPLICATE_MIGRATION` and `CHECKSUM_MISMATCH` validation errors for `mysql_migration_apply`.
- Fixed `mysql_explain_analyze` to throw a structured `ValidationError` instead of returning a raw error object when `FORMAT=JSON` is requested.
- Fixed `safeRouterFetch` in the `router` tools to use the standard `ErrorCategory.RESOURCE` instead of casting an invalid `"domain"` category for 404 responses.
- Fixed Split Schema pattern for `mysql_list_schemas`, `mysql_create_schema`, and `mysql_drop_schema` to properly use `z.preprocess` and support schema/database aliases.
- Fixed Split Schema pattern for `mysql_list_events` by exposing the `status` enum in the base input schema.
- Fixed `MaskDataSchema` to use `z.enum` for `type` validation to properly leverage Zod validation instead of throwing manual `UNKNOWN_ERROR` exceptions.
- Fixed `createSecurityUserPrivilegesTool` and `createSecuritySensitiveTablesTool` to properly return structured `ValidationError` responses instead of throwing `UNKNOWN_ERROR` domain errors when users or schemas do not exist.
- Fixed missing aliases `name` and `tableName` for `tables` parameter in `mysqlsh_dump_tables` via split schema.
- Fixed `mysqlsh_check_upgrade` to properly capture and return the `util.checkForServerUpgrade()` JSON results from `stdout` instead of returning `undefined`.
- Fixed factual errors in `test-codemode-shell-utils.md` test script regarding invalid IO root paths that incorrectly assert dry-run success and domain errors instead of `SECURITY_ERROR`.
