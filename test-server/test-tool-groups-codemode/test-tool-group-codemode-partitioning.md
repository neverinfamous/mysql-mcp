# mysql-mcp Code Mode Re-Testing: [partitioning]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

---

## Group Focus: partitioning

partitioning Tool Group (4 tools +1 code mode):

1. `mysql_partition_info` 2. `mysql_add_partition` 3. `mysql_drop_partition`
2. `mysql_reorganize_partition`

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
