# Partitioning Tools (`mysql_partition_*`, `mysql_add_partition`, `mysql_drop_partition`, `mysql_reorganize_partition`)

- **Existence Check**: `mysql_partition_info` returns a structured error when the table does not exist. Returns `{ partitioned: false }` for existing non-partitioned tables.
- **Value Parameter**: The `value` parameter expects only the boundary value, NOT the full SQL clause.
  - ❌ Incorrect: `value: "LESS THAN (2024)"` (SQL syntax error - duplicates keywords)
  - ✅ Correct: `value: "2024"` for RANGE partitions
  - ✅ Correct: `value: "1,2,3"` for LIST partitions (integer values)
  - ✅ Correct: `value: "'region1','region2'"` for LIST COLUMNS (quoted string values)
  - ✅ Correct: `value: "4"` for HASH/KEY (number of partitions to add)
- **Error Handling**: Write tools return `{ success: false, error }` for common failures (non-partitioned table, nonexistent partition, MAXVALUE conflicts) instead of throwing raw errors.
- **RANGE + MAXVALUE**: Adding a RANGE partition when a MAXVALUE catch-all exists returns a structured error suggesting `mysql_reorganize_partition` instead.
- **Reorganize**: Requires `partitionType` parameter (RANGE or LIST). HASH/KEY partitions cannot be reorganized.
- **Drop Warning**: `mysql_drop_partition` permanently deletes all data in the partition.
