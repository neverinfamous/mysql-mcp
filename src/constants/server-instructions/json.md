# JSON Tools (`mysql_json_*`)

**Encapsulated Tools**: `mysql_json_extract`, `mysql_json_set`, `mysql_json_insert`, `mysql_json_replace`, `mysql_json_remove`, `mysql_json_contains`, `mysql_json_keys`, `mysql_json_array_append`, `mysql_json_get`, `mysql_json_update`, `mysql_json_search`, `mysql_json_validate`, `mysql_json_merge`, `mysql_json_diff`, `mysql_json_normalize`, `mysql_json_stats`, `mysql_json_index_suggest`

### Read & Extract (`mysql_json_get`, `mysql_json_extract`, `mysql_json_search`, `mysql_json_keys`, `mysql_json_contains`)
- **`mysql_json_get`**: Retrieves JSON values by ID.
  - Missing row: returns `{ value: null, rowFound: false }`.
  - Null JSON path: returns `{ value: null }` (no `rowFound` field).
- **Pagination**: `mysql_json_extract`, `mysql_json_contains`, `mysql_json_keys`, and `mysql_json_search` inject a default `LIMIT 50` on queries without explicit `LIMIT` clause.

### Write Operations (`mysql_json_set`, `mysql_json_insert`, `mysql_json_replace`, `mysql_json_remove`, `mysql_json_array_append`, `mysql_json_update`, `mysql_json_merge`)
- **WHERE Clause Requirement**: All write tools require a mandatory `where` parameter (or `filter` alias) to identify target rows.
- **Automatic String Handling**: Bare strings are auto-converted to JSON strings:
  ```json
  { "value": "green" } // stored as JSON string "green"
  { "value": 42 } // stored as number 42
  { "value": {"key": "val"} } // stored as object
  { "value": "[1,2,3]" } // stored as array
  ```
- **`mysql_json_remove` Array Paths**: Accepts `paths` (an array of strings) to remove multiple paths simultaneously.

### Utilities & Validation (`mysql_json_validate`, `mysql_json_diff`, `mysql_json_normalize`, `mysql_json_stats`, `mysql_json_index_suggest`)
- **Validation**: Creating/updating validates JSON payload. `mysql_json_validate` explicitly validates JSON against syntax rules.
- **Comparison & Formatting**: Use `mysql_json_diff` to compare objects and `mysql_json_normalize` to format or strip nulls/empty structures.
- **Analysis**: `mysql_json_stats` provides column storage stats; `mysql_json_index_suggest` recommends generated columns and indexes for frequently queried paths.

### Error Handling
- All JSON tools return structured domain errors instead of raw exceptions:
  ```json
  { "success": false, "error": "Table does not exist", "code": "NOT_FOUND" }
  ```
