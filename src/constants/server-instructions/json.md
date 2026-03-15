# JSON Tools (`mysql_json_*`)

- **Automatic String Handling**: JSON tools automatically convert bare strings to valid JSON.
  - ✅ `value: "green"` → stored as JSON string `"green"`
  - ✅ `value: 42` → stored as number `42`
  - ✅ `value: {"key": "val"}` → stored as object
  - ✅ `value: "[1,2,3]"` → stored as array (already valid JSON)
- **Validation**: Creating or updating JSON values enforces JSON validity after auto-conversion.
- **Error Handling**: All table-querying JSON tools return `{ exists: false, table }` for nonexistent tables and `{ success: false, error }` for other query errors, instead of throwing raw exceptions. `mysql_json_merge` and `mysql_json_diff` (literal JSON, no table) return `{ success: false, error }` for invalid input.
- **`json_get` nonexistent row**: When the target row ID does not exist, returns `{ value: null, rowFound: false }`. When the row exists but the JSON path yields null, returns `{ value: null }` (no `rowFound` field). This distinguishes missing rows from null paths.
- **Write operations require WHERE**: `json_set`, `json_insert`, `json_replace`, `json_remove`, and `json_array_append` all require a mandatory `where` parameter (or `filter` alias) to identify target rows.
- **`json_remove` uses `paths` array**: Unlike other write tools that accept a single `path` string, `json_remove` accepts `paths` (an array of strings) to remove multiple paths in one operation.
