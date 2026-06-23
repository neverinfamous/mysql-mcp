# JSON Tools (`mysql_json_*`)

- **Automatic String Handling**: JSON tools automatically convert bare strings to valid JSON.
  - ✅ `value: "green"` → stored as JSON string `"green"`
  - ✅ `value: 42` → stored as number `42`
  - ✅ `value: {"key": "val"}` → stored as object
  - ✅ `value: "[1,2,3]"` → stored as array (already valid JSON)
- **Validation**: Creating or updating JSON values enforces JSON validity after auto-conversion.
- **Error Handling**: All JSON tools return standard structured errors (`{ success: false, error, code }`) for domain errors like nonexistent tables and validation failures, instead of throwing raw exceptions.
- **`json_get` nonexistent row**: When the target row ID does not exist, returns `{ value: null, rowFound: false }`. When the row exists but the JSON path yields null, returns `{ value: null }` (no `rowFound` field). This distinguishes missing rows from null paths.
- **Write operations require WHERE**: `json_set`, `json_insert`, `json_replace`, `json_remove`, and `json_array_append` all require a mandatory `where` parameter (or `filter` alias) to identify target rows.
- **`json_remove` uses `paths` array**: Unlike other write tools that accept a single `path` string, `json_remove` accepts `paths` (an array of strings) to remove multiple paths in one operation.
- **Pagination**: `mysql_json_extract`, `mysql_json_contains`, `mysql_json_keys`, and `mysql_json_search` inject a default `LIMIT 50` on queries without an explicit `LIMIT` clause.
