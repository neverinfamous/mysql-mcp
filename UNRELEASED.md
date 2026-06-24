# Unreleased

- Fixed `mysql_show_status` and `mysql_show_variables` to allow explicit empty string filter for the `like` parameter (`""`) instead of ignoring it.
- Fixed `test-codemode-advanced-security.md` test prompt to explicitly reference `testdb.stress_sensitive` so `mysql_security_sensitive_tables` tests pass correctly when run in the default connection scope.
- Optimized spatial query payloads by capping `ST_Distance` and `ST_Distance_Sphere` precision to 5 decimal places in `mysql_spatial_distance` and `mysql_spatial_distance_sphere`.
