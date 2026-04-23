# mysql-mcp Advanced Stress Tests: [spatial]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups/test-tool-group-spatial.md` MUST pass first.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Boundary Coordinates

1. Create point at exact boundary: latitude 90, longitude 180
2. Create point at exact boundary: latitude -90, longitude -180
3. Create point at origin: latitude 0, longitude 0
4. Distance calculation between poles — verify large distance
5. Distance calculation between identical points — verify 0

## Category 2: Geometry Operations

6. Create a polygon that wraps the entire globe — verify ST_Contains for any point
7. Buffer with radius 0 — verify behavior
8. Intersection of non-overlapping geometries — verify empty result

## Category 3: SRID Handling

9. Query with mismatched SRID — verify structured error
10. Transform between SRIDs — verify coordinate change

## Cleanup

11. Drop `stress_*` spatial tables
