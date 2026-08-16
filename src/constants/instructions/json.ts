export const JSON_HELP = `# JSON Tools (\`mysql_json_extract\`, \`mysql_json_set\`, \`mysql_json_insert\`, etc.)

**Encapsulated Tools**: \`mysql_json_extract\`, \`mysql_json_set\`, \`mysql_json_insert\`, \`mysql_json_replace\`, \`mysql_json_remove\`, \`mysql_json_contains\`, \`mysql_json_keys\`, \`mysql_json_array_append\`, \`mysql_json_get\`, \`mysql_json_update\`, \`mysql_json_search\`, \`mysql_json_validate\`, \`mysql_json_merge\`, \`mysql_json_diff\`, \`mysql_json_normalize\`, \`mysql_json_stats\`, \`mysql_json_index_suggest\`

### Read & Extract (\`mysql_json_get\`, \`mysql_json_extract\`, \`mysql_json_search\`, \`mysql_json_keys\`, \`mysql_json_contains\`)
- **\`mysql_json_get\`**: Retrieves JSON values by ID.
  - Missing row: returns \`{ value: null, rowFound: false }\`.
  - Null JSON path: returns \`{ value: null }\` (no \`rowFound\` field).
- **Pagination**: \`mysql_json_extract\`, \`mysql_json_contains\`, and \`mysql_json_search\` inject a default \`LIMIT 50\` on queries without explicit \`LIMIT\` clause. \`mysql_json_get\` and \`mysql_json_keys\` strictly enforce \`LIMIT 1\`.

### Write Operations (\`mysql_json_set\`, \`mysql_json_insert\`, \`mysql_json_replace\`, \`mysql_json_remove\`, \`mysql_json_array_append\`, \`mysql_json_update\`)
- **WHERE Clause Requirement**: All write tools require a mandatory \`where\` parameter (or \`filter\`, \`condition\`, \`idColumn\`/\`rowId\` aliases) to identify target rows. The \`where\` parameter can be a raw SQL string, or an object (e.g., \`{"id": 1, "status": "active"}\`) which will be joined with \`AND\`.
- **Automatic String Handling**: Bare strings are auto-converted to JSON strings:
  \`\`\`json
  { "value": "green" } // stored as JSON string "green"
  { "value": 42 } // stored as number 42
  { "value": {"key": "val"} } // stored as object
  { "value": "[1,2,3]" } // stored as array
  \`\`\`
- **\`mysql_json_remove\` Array Paths**: Accepts \`paths\` (an array of strings) to remove multiple paths simultaneously.

### Utilities & Validation (\`mysql_json_validate\`, \`mysql_json_diff\`, \`mysql_json_merge\`, \`mysql_json_normalize\`, \`mysql_json_stats\`, \`mysql_json_index_suggest\`)
- **Validation**: Creating/updating validates JSON payload. \`mysql_json_validate\` explicitly validates JSON against syntax rules.
- **Comparison & Formatting**: Use \`mysql_json_diff\` to compare objects, \`mysql_json_merge\` to combine raw JSON documents, and \`mysql_json_normalize\` to extract unique keys and type stats from a JSON column.
- **Analysis**: \`mysql_json_stats\` provides column storage stats; \`mysql_json_index_suggest\` recommends generated columns and indexes for frequently queried paths.

### Error Handling
- All JSON tools return structured domain errors instead of raw exceptions:
  \`\`\`json
  { "success": false, "error": "Table does not exist", "code": "NOT_FOUND" }
  \`\`\``;
