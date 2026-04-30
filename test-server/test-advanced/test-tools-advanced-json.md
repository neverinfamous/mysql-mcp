# mysql-mcp Advanced Stress Tests: [json]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic deterministic checklists in `../test-tool-groups/test-tool-group-json.md` MUST pass first.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Deep Mutation Workflows

1. ✅ PASS Create `stress_json` table with JSON column, insert row with deeply nested object (3+ levels)
2. ✅ PASS Extract from deep path `$.level1.level2.level3` — verify correct value
3. ✅ PASS Set value at deep path — verify mutation took effect
4. ✅ PASS Remove from deep path — verify removal
5. ✅ PASS Insert at existing path (should not overwrite) — verify original value preserved

## Category 2: Array Operations

6. ✅ PASS Insert row with JSON array, use json_array_append to add element
7. ✅ PASS Verify array length increased
8. ✅ PASS Remove element from array by index — verify removal

## Category 3: Edge Cases

9. ✅ PASS Extract from NULL JSON column — verify structured response (not crash)
10. ✅ PASS Validate empty string `""` — verify `{valid: false}`
11. ✅ PASS Validate empty object `{}` — verify `{valid: true}`
12. ✅ PASS Validate empty array `[]` — verify `{valid: true}`
13. ✅ PASS json_diff with identical documents — verify no differences
14. ✅ PASS json_merge with conflicting keys — verify last-writer-wins for PATCH

## Category 4: Payload Monitoring

15. ✅ PASS json_stats on large JSON documents — monitor token estimate
16. ✅ PASS json_keys on deeply nested documents — verify key listing

## Cleanup

17. ✅ PASS Drop `stress_json` table
