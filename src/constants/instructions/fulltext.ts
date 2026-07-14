export const FULLTEXT_HELP = `# Fulltext Search (\`mysql_fulltext_create\`, \`mysql_fulltext_drop\`, \`mysql_fulltext_search\`, etc.)

**Encapsulated Tools**: \`mysql_fulltext_create\`, \`mysql_fulltext_drop\`, \`mysql_fulltext_search\`, \`mysql_fulltext_boolean\`, \`mysql_fulltext_expand\`

### Index Management (\`mysql_fulltext_create\`, \`mysql_fulltext_drop\`)
- **Create**: Adds a FULLTEXT index. Returns \`{ success: false, error }\` if it exists.
- **Drop**: Removes it. Returns \`{ success: false, error }\` if it does not exist.

### Search (\`mysql_fulltext_search\`, \`mysql_fulltext_boolean\`, \`mysql_fulltext_expand\`)
- **NATURAL Mode** (\`mysql_fulltext_search\`): Standard natural language matching. Supports \`includeFacets\` for aggregate term counts.
- **BOOLEAN Mode** (\`mysql_fulltext_boolean\`): Supports \`includeFacets\` for aggregate term counts.
  - \`+word\` (required), \`-word\` (excluded), \`word*\` (prefix wildcard), \`>word\`/\`<word\` (relevance weighting).
  \`\`\`json
  { "query": "+database -sql" }
  \`\`\`
- **EXPANSION Mode** (\`mysql_fulltext_expand\`): Finds related terms. May return more rows than exact match.
- **Column Matching**: MATCH column list must *exactly* match the columns of an existing FULLTEXT index. Searching a subset fails.

### Output & Features
- **Minimal Output**: Tools return \`id\`, searched column(s), and \`relevance\` score.
- **Truncation**: Use \`maxLength\` parameter to truncate long text columns (e.g., \`maxLength: 200\`).

- **Query Sanitization**: Queries automatically balance unmatched quotes/parentheses, strip dangling operators, and normalize whitespace. Empty sanitized queries return \`{ rows: [], count: 0 }\`.
- **Pagination**: Use \`cursor\` for pagination. Default \`limit\` is 5.
- **Errors**: Nonexistent tables yield \`{ exists: false, table }\`. Index mismatch yields \`{ success: false, error }\`.`;
