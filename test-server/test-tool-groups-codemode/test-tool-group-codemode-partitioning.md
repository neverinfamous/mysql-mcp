# mysql-mcp Code Mode Re-Testing: [partitioning]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Test Data: `test_partitioned` (26 rows, PARTITION BY LIST on region)

## Requirements

1. **Coverage Matrix**: Track in `tmp/task.md`. Log Happy Path + Domain Error for EVERY tool.
2. Handler errors must return `{success: false, error: "..."}` — NOT raw MCP errors.
3. Post-Test: Fix findings, read `code-map.md`, update changelog, commit without pushing.

---

## Group Focus: partitioning

partitioning Tool Group (4 tools +1 code mode):

1. `mysql_partition_info` 2. `mysql_add_partition` 3. `mysql_drop_partition`
4. `mysql_reorganize_partition`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.partitioning.help()` → verify method listing
2. `mysql.partitioning.partitionInfo({table: "test_partitioned"})` → partition names
3. `mysql.partitioning.partitionInfo({table: "test_products"})` → non-partitioned response

**Domain error paths (🔴):**

4. 🔴 `mysql.partitioning.partitionInfo({table: "nonexistent_xyz"})` → `{success: false}` (P154)

**Zod validation error paths (🔴):**

5. 🔴 `mysql.partitioning.partitionInfo({})` → `{success: false, error: "Validation error: ..."}`
6. 🔴 `mysql.partitioning.addPartition({})` → `{success: false, error: "Validation error: ..."}`
7. 🔴 `mysql.partitioning.dropPartition({})` → `{success: false, error: "Validation error: ..."}`
