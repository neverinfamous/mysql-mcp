# mysql-mcp Tool Group Testing: [partitioning]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Test Database Schema

| Table | Rows | Key Columns |
|-------|------|-------------|
| `test_partitioned` | 26 | id, region, created_at, data (PARTITION BY LIST on region) |

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: partitioning

### partitioning Group-Specific Testing

partitioning Tool Group (4 tools +1 for code mode):

1. 'mysql_partition_info'
2. 'mysql_add_partition'
3. 'mysql_drop_partition'
4. 'mysql_reorganize_partition'
5. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_partition_info({table: "test_partitioned"})` → verify partition information returned with partition names
2. `mysql_partition_info({table: "test_products"})` → verify response for non-partitioned table (may return empty or informational)

**Domain error paths (🔴):**

3. 🔴 `mysql_partition_info({table: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error (P154)

**Zod validation error paths (🔴):**

4. 🔴 `mysql_partition_info({})` → `{success: false, error: "..."}` (Zod validation)
5. 🔴 `mysql_add_partition({})` → `{success: false, error: "..."}` (missing required params)
6. 🔴 `mysql_drop_partition({})` → `{success: false, error: "..."}` (missing required params)
