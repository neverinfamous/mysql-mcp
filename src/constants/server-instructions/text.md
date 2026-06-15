# Text Tools (`mysql_like_search`, `mysql_regexp_match`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert`)

- **LIKE patterns**: `%` matches any characters, `_` matches single character.
- **Regex**: Uses MySQL regex syntax (not PCRE). Example: `^[A-Z].*@.*\.com$`
- **SOUNDEX**: Finds phonetically similar values - matches alternative spellings (e.g., `johndoe` matches `jonedoe`).
- **WHERE clause**: All text tools support optional `where` parameter to filter rows. For pattern-matching tools (`mysql_regexp_match`, `mysql_like_search`, `mysql_soundex`), the `where` clause is combined with the pattern match using AND.
- **Concat columns**: `mysql_concat` includes source columns by default. Use `includeSourceColumns: false` for minimal payload (only id and concatenated result).
- **Minimal output**: Tools return only `id`, target column(s), and computed result with `count`.
- **Error handling**: All text tools return `{ exists: false, table }` for nonexistent tables and `{ success: false, error }` for other query errors (e.g., unknown column, invalid regex, invalid charset). No raw MySQL errors are thrown.
