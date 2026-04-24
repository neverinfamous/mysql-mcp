# Code Mode Re-Testing: [core]

## Strict Coverage Matrix

| Tool | Code Mode (Happy Path) | Code Mode (Domain Error) |
| --- | --- | --- |
| mysql_read_query | ✅ | ✅ |
| mysql_write_query | ✅ | ✅ |
| mysql_list_tables | ✅ | ✅ |
| mysql_describe_table | ✅ | ✅ |
| mysql_create_table | ✅ | ✅ |
| mysql_drop_table | ✅ | ✅ |
| mysql_create_index | ✅ | ✅ |
| mysql_get_indexes | ✅ | ✅ |

## Issues Found & Remediated
- ❌ **Fail**: `describeTable` and `getIndexes` returned `exists: false` properties directly instead of standard `{ success: false, error: ... }` for non-existent tables.
  - **Fix**: Updated core handler logic to return standard structured errors. Updated `core.test.ts` to assert the correct error behavior. Updated `errors.spec.ts` to assert the correct structure for `describeTable`.
- ❌ **Fail**: `listTables` returned `exists: false` properties directly instead of `{ success: false, error: ... }` for a non-existent explicit database parameter.
  - **Fix**: Updated core handler logic to return standard structured errors and updated `core.test.ts` to assert the correct error behavior.
- ⚠️ **Issue**: The `limit` parameter in `mysql.core.listTables({database: "testdb", limit: 5})` is passed by Code Mode but silently ignored by the `listTables` handler/schema, returning all tables instead of limiting the payload size. This could lead to a `📦 Payload` issue in extremely large databases.

## Tests
- Tested 17 specific edge case scenarios in a single `mysql_execute_code` script payload.
- All code mode tests pass successfully! Token cost: ~73.
