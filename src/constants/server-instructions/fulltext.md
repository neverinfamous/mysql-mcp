# Fulltext Search (`mysql_fulltext_*`)

- **Index management**: `mysql_fulltext_create` creates a FULLTEXT index (returns `{ success: false, error }` if index already exists), `mysql_fulltext_drop` removes it (returns `{ success: false, error }` if index does not exist).
- **Search modes**: `mysql_fulltext_search` supports NATURAL (default), BOOLEAN, and EXPANSION modes.
- **Boolean operators** (`mysql_fulltext_boolean`): `+word` (required), `-word` (excluded), `word*` (prefix wildcard), `>word`/`<word` (relevance weighting).
- **Query expansion** (`mysql_fulltext_expand`): Finds related terms - may return more rows than exact match.
- **Column matching**: MATCH column list must exactly match the columns of an existing FULLTEXT index. Searching a subset of indexed columns will fail.
- **Output**: Tools return only `id`, searched column(s), and `relevance` score. Use `maxLength` parameter to truncate long text columns in results (e.g., `maxLength: 200` truncates values over 200 characters with `...`).
- **Error handling**: All fulltext tools return `{ exists: false, table }` for nonexistent tables. Search tools (`mysql_fulltext_search`, `mysql_fulltext_boolean`, `mysql_fulltext_expand`) also return `{ success: false, error }` for other query errors (e.g., FULLTEXT index column mismatch). No raw MySQL errors are thrown.
