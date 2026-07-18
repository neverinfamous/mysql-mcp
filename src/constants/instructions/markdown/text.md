# Text Tools

**Encapsulated Tools**: `mysql_regexp_match`, `mysql_like_search`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert`

### Search & Match (`mysql_regexp_match`, `mysql_like_search`, `mysql_soundex`, etc.)
- **LIKE patterns**: `%` matches any characters, `_` matches single character.
- **Regex**: Uses MySQL regex syntax (not PCRE).
  ```json
  { "pattern": "^[A-Z].*@.*\\.com$" }
  ```
- **SOUNDEX**: Finds phonetically similar values (e.g., `johndoe` matches `jonedoe`).
- **WHERE Filtering**: Support optional `where` parameter to filter rows. Combined with the pattern match using AND.

### Manipulation (`mysql_substring`, `mysql_concat`, `mysql_collation_convert`)
- **Substring/Collation**: Standard string manipulations and character set conversions.
- **Concat columns**: `mysql_concat` omits source columns by default to minimize payload size. Set `includeSourceColumns: true` to include them.

### General Rules
- **Minimal Output**: These tools return only `id`, target column(s), and computed result with `count`.
- **Error Handling**: All errors return a structured `ErrorResponse` (e.g. `TABLE_NOT_FOUND`, `COLUMN_NOT_FOUND`, `SYNTAX_ERROR`) with `{ success: false, code: "...", category: "..." }`. Raw MySQL errors are caught and securely transformed.
