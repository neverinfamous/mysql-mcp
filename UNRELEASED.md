# Unreleased

## Internal/Testing

- Fixed `mysql_slave_status` and `mysql_replication_lag` tools to return structured domain errors instead of generic `UNKNOWN_ERROR` when the server is not configured as a replica.
- Fixed missing `mysql_explain_analyze` and `mysql_slow_queries` tests in `test-codemode-performance-analysis-queries.md` prompt.
