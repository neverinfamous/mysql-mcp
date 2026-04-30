# mysql-mcp Advanced Stress Tests: [text]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-text.md` MUST pass first.
- Database must be freshly seeded.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Regex Edge Cases

1. `mysql_regexp_match` with invalid regex pattern (e.g., `"[invalid"`) → verify structured `{success: false}`
2. `mysql_regexp_match` with empty pattern `""` → verify behavior (empty match or error)
3. `mysql_regexp_match` with MySQL-specific metacharacters (e.g., `"[[:<:]]"` word boundary) → verify results

## Category 2: Unicode & Encoding

4. Create `stress_text_unicode` table with VARCHAR column, insert rows with multi-byte UTF-8 characters (e.g., `'日本語'`, `'émojis 🎉'`)
5. `mysql_substring` on multi-byte column with `start: 1, length: 2` → verify correct character extraction (not byte slicing)
6. `mysql_concat` on multi-byte rows → verify concatenation preserves encoding
7. `mysql_soundex` on non-ASCII values → verify structured response (may return empty soundex)

## Category 3: Boundary Lengths

8. `mysql_substring` with `start: 0` → verify behavior (MySQL uses 1-indexed)
9. `mysql_substring` with `length: 0` → verify empty string or structured response
10. `mysql_substring` with `length: 99999` (exceeding column length) → verify graceful truncation
11. `mysql_concat` with empty `columns: []` array → verify structured error
12. `mysql_concat` with single column in array → verify no separator artifacts

## Category 4: Collation Stress

13. `mysql_collation_convert` with invalid collation name → verify structured `{success: false}`
14. `mysql_like_search` with `%` only pattern → verify returns all rows
15. `mysql_like_search` with `_` pattern → verify single-character wildcard behavior

## Cleanup

16. Drop all `stress_*` tables
