# mysql-mcp Advanced Stress Tests: [partitioning]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

## Test Database Schema

| Table               | Rows | Key Columns                                       | JSON Columns        |
| ------------------- | ---- | ------------------------------------------------- | ------------------- |
| `test_products`     | 16   | id, name, price, category                         | metadata            |
| `test_orders`       | 20   | id, product_id (FK), customer_name, status (ENUM) | notes               |
| `test_json_docs`    | 8    | id, doc, metadata, tags                           | doc, metadata, tags |
| `test_articles`     | 10   | id, title, body, author (FULLTEXT)                | —                   |
| `test_users`        | 10   | id, username, email, phone, bio, role             | —                   |
| `test_measurements` | 200  | id, sensor_id (INT 1-5), temperature, humidity    | —                   |
| `test_locations`    | 15   | id, name, city, latitude, longitude, geom (POINT) | —                   |
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date  | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)             | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                            | data                |
| `test_categories`   | 17   | id, name, path, level                             | —                   |

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type                 | What you see                                     | Verdict            |
| -------------------- | ------------------------------------------------ | ------------------ |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct            |
| **MCP error** ❌     | Raw error string, no `success` field             | Bug — report as ❌ |

During error path testing, if an invalid Code Mode call returns a raw error string instead of a JSON object with `success` and `error` fields, report it as ❌.

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
