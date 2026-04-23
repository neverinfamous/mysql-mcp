# mysql-mcp Advanced Stress Tests: [fulltext]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups/test-tool-group-fulltext.md` MUST pass first.

## Post-Test: Drop all `stress_*` tables and indexes. Fix findings, update changelog, commit without pushing.

---

## Category 1: Search Pipeline

1. Create `stress_fts` table with `title VARCHAR(255)`, `body TEXT`
2. Insert 5 rows with searchable terms
3. Create FULLTEXT index on (title, body)
4. Natural language search — verify relevance ordering
5. Boolean search with `+required -excluded` — verify filtering
6. Query expansion search — verify expanded results
7. Drop FULLTEXT index — verify clean removal

## Category 2: Edge Cases

8. Search for empty string `""` — verify structured response (not crash)
9. Search for very long query string (1000+ chars) — verify handling
10. Search with special characters `@!#$%` — verify no SQL injection
11. Search on table without FULLTEXT index — verify structured error

## Cleanup

12. Drop `stress_fts` table
