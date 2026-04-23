# mysql-mcp Advanced Stress Tests: [document]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups/test-tool-group-document.md` MUST pass first.

## Post-Test: Drop all `stress_*` collections. Fix findings, update changelog, commit without pushing.

---

## Category 1: Collection Lifecycle

1. Create collection `stress_docs`, add 5 documents, verify count
2. Drop and recreate — verify clean state
3. Create collection with same name as dropped — verify no leakage

## Category 2: Edge Cases

4. Find with empty criteria `{}` — should return all documents
5. Find with criteria matching no documents — verify empty result (not error)
6. Add document with empty object `{}` — verify insertion succeeds
7. Modify with criteria matching no documents — verify structured response
8. Remove with criteria matching no documents — verify structured response

## Category 3: Index Operations

9. Create index on JSON path for `stress_docs` collection
10. Drop collection with index — verify clean removal

## Cleanup

11. Drop `stress_docs` if still exists
