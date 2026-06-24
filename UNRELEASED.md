# Unreleased

- Fixed `mysql_show_status` and `mysql_show_variables` to allow explicit empty string filter for the `like` parameter (`""`) instead of ignoring it.
- Fixed `test-codemode-advanced-security.md` test prompt to explicitly reference `testdb.stress_sensitive` so `mysql_security_sensitive_tables` tests pass correctly when run in the default connection scope.
- Optimized spatial query payloads by capping `ST_Distance` and `ST_Distance_Sphere` precision to 5 decimal places in `mysql_spatial_distance` and `mysql_spatial_distance_sphere`.
- Fixed Stats tools (`mysql_stats_frequency`, `mysql_stats_distinct`, `mysql_stats_top_n`, `mysql_stats_summary`, `mysql_stats_hypothesis`, and `mysql_stats_outliers`) to support an optional `database` parameter and cross-database `database.table` naming conventions.
- Fixed descriptive and comparative stats tools to support cross-database `database.table` naming conventions by properly validating table names via `validateQualifiedIdentifier`.
- Fixed window function stats tools (`rowNumber`, `rank`, `lagLead`, `runningTotal`, `movingAvg`, `ntile`) to support an optional `database` parameter and cross-database `database.table` naming conventions.
- Fixed introspection tools (`mysql_dependency_graph`, `mysql_topological_sort`, `mysql_cascade_simulator`, `mysql_schema_snapshot`, `mysql_constraint_analysis`, `mysql_migration_risks`) to expose parameter aliases (like `database`, `tableName`) on their `*SchemaBase` definitions, ensuring they are not stripped by Zod when called directly from MCP.
- Fixed a bug in `MigrationRecordSchema`'s `z.preprocess` logic where an early return on the `migrationSql` alias transformation prevented the `description` alias (`name`) from being properly mapped and recorded.
- Fixed monitoring tools (mysql_server_health, mysql_pool_stats, mysql_innodb_status, mysql_replication_status) to strictly adhere to the Split Schema Pattern, creating *SchemaBase definitions so their optional parameters are properly visible in the MCP registry instead of being stripped out by local inline z.object() definitions.
