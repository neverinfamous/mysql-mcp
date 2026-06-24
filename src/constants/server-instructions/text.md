# Text Tools (`mysql_regexp_match`, `mysql_like_search`, `mysql_soundex`, etc.)

**Encapsulated Tools**: `mysql_regexp_match`, `mysql_like_search`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert`

### Search & Match (`mysql_like_search`, `mysql_regexp_match`, `mysql_soundex`)
- **LIKE patterns**: `%` matches any characters, `_` matches single character.
- **Regex**: Uses MySQL regex syntax (not PCRE).
  ```json
  { "pattern": "^[A-Z].*@.*\\.com$" }
  ```
- **SOUNDEX**: Finds phonetically similar values (e.g., `johndoe` matches `jonedoe`).
- **WHERE Filtering**: Support optional `where` parameter to filter rows. Combined with the pattern match using AND.

### Manipulation (`mysql_substring`, `mysql_concat`, `mysql_collation_convert`)
- **Substring/Collation**: Standard string manipulations and character set conversions.
- **Concat columns**: `mysql_concat` includes source columns by default. Set `includeSourceColumns: false` for minimal payload (returns only `id` and the concatenated result).

### General Rules
- **Minimal Output**: These tools return only `id`, target column(s), and computed result with `count`.
- **Error Handling**: Nonexistent tables return `{ exists: false, table: "..." }`. Query errors (unknown column, invalid regex/charset) return `{ success: false, error: "..." }`. Raw MySQL errors are caught and transformed.
