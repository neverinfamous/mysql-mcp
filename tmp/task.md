# monitoring Tool Group Code Mode Certification

## Coverage Matrix

1. `mysql.monitoring.help()`: ✅ Passed. Returns correct method list.
2. `mysql.monitoring.showProcesslist()`: ✅ Passed. Valid processlist object returned.
3. `mysql.monitoring.showStatus({like: "Uptime"})`: ✅ Passed. Key-value pair returned with valid value.
4. `mysql.monitoring.showVariables({like: "max_connections"})`: ✅ Passed. Key-value pair returned.
5. `mysql.monitoring.innodbStatus()`: ✅ Passed. Returns correct status string.
6. `mysql.monitoring.innodbStatus({summary: true})`: ✅ Passed. Returns correct summary string.
7. `mysql.monitoring.poolStats()`: ✅ Passed. Returns pool stats.
8. `mysql.monitoring.serverHealth()`: ✅ Passed. Valid health status returned without wrapper.
9. `mysql.monitoring.showStatus({like: "nonexistent_var_xyz"})`: ✅ Passed (Domain Error). Returns empty object without raw error as expected.

## Failures

None.
