# Admin Tools (`mysql_optimize_table`, `mysql_repair_table`, etc.)

- **Optimize**: `mysql_optimize_table` reclaims unused space (InnoDB does recreate + analyze).
- **Analyze**: `mysql_analyze_table` updates index statistics for the query optimizer.
- **Check**: `mysql_check_table` verifies table integrity. Options: QUICK, FAST, MEDIUM, EXTENDED, CHANGED.
- **Repair**: `mysql_repair_table` only works for MyISAM tables; InnoDB reports "not supported."
- **Flush**: `mysql_flush_tables` writes cached changes to disk. When some specified tables do not exist, valid tables are still flushed; the response returns `{ success: false, notFound, flushed }` listing both missing and successfully flushed tables. Global flush (no tables) always succeeds.
- **Kill**: `mysql_kill_query` terminates queries by process ID. Use `connection: true` to kill the entire connection. Returns `{ success: false, error }` for invalid process IDs.
- **Error handling**: `mysql_optimize_table`, `mysql_analyze_table`, `mysql_check_table`, and `mysql_repair_table` return MySQL's native per-table `results` array. Nonexistent tables appear as rows with `Msg_type: "Error"` and `Msg_text: "Table does not exist"` (no P154 wrapping—these are multi-table DDL commands).
