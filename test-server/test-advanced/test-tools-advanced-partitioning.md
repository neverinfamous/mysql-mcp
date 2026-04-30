# mysql-mcp Advanced Stress Tests: [partitioning]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-partitioning.md` MUST pass first.
- Database must be freshly seeded (requires `test_partitioned` table).

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Partition Lifecycle Stress

1. Create `stress_part_range` table with RANGE partitioning on an INT column (p0: <100, p1: <200, p2: MAXVALUE)
2. `mysql_partition_info({table: "stress_part_range"})` → verify 3 partitions listed
3. `mysql_add_partition` on a RANGE table that already has MAXVALUE → verify structured `{success: false}` (cannot add past MAXVALUE)
4. `mysql_drop_partition({table: "stress_part_range", partition: "nonexistent_p99"})` → verify structured `{success: false}`
5. `mysql_drop_partition({table: "stress_part_range", partition: "p0"})` → success
6. `mysql_partition_info({table: "stress_part_range"})` → verify only 2 partitions remain

## Category 2: Non-Partitioned Table Handling

7. `mysql_partition_info({table: "test_products"})` → verify `{success: true, partitioned: false}` response shape
8. `mysql_drop_partition({table: "test_products", partition: "p0"})` → verify structured `{success: false}` (not partitioned)

## Category 3: Reorganize Edge Cases

9. `mysql_reorganize_partition({table: "test_partitioned", fromPartitions: ["nonexistent_p99"], intoPartitions: [{name: "p_new", values: "1,2"}]})` → verify structured `{success: false}`
10. `mysql_reorganize_partition` with empty `fromPartitions` array → verify structured error

## Category 4: Payload Monitoring

11. `mysql_partition_info({table: "test_partitioned"})` → log token estimate
12. Flag any response > 500 tokens as 📦

## Cleanup

13. Drop all `stress_*` tables
