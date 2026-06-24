# ProxySQL Tools (`proxysql_*`)

Tools: `proxysql_status`, `proxysql_servers`, `proxysql_query_rules`, `proxysql_query_digest`, `proxysql_connection_pool`, `proxysql_users`, `proxysql_global_variables`, `proxysql_runtime_status`, `proxysql_memory_stats`, `proxysql_commands`, `proxysql_process_list`

- **Prerequisites**: ProxySQL must be running with admin interface accessible (default port 6032). Environment variables: `PROXYSQL_HOST`, `PROXYSQL_PORT`, `PROXYSQL_USER`, `PROXYSQL_PASSWORD`.
- **Status monitoring**: `proxysql_status` returns global status variables. Use `summary: true` for key metrics.
- **Global variables**: `proxysql_global_variables` supports `prefix` filter (`mysql`, `admin`, or `all`) and `like` pattern. Use `limit` (default: 50). Passwords are redacted.
- **Runtime status**: `proxysql_runtime_status` returns version and admin variables. Use `summary: true` for condensed output. Sensitive variables are redacted.
- **Backend servers & pools**: `proxysql_servers` shows backend MySQL servers. `proxysql_connection_pool` shows connection pool stats. Both support `hostgroup_id` filter.
- **Users**: `proxysql_users` lists configured ProxySQL users and their assigned hostgroups.
- **Query analysis**: `proxysql_query_rules` lists routing rules; `proxysql_query_digest` shows top queries by execution count. Both support `limit`.
- **Admin commands**: `proxysql_commands` executes LOAD/SAVE for users, servers, query rules, variables, and FLUSH operations.
- **Memory/Process**: `proxysql_memory_stats` shows memory allocation; `proxysql_process_list` shows active client sessions.
- **Error handling**: All ProxySQL tools return `{ success: false, error }` instead of throwing raw exceptions. Invalid parameters/patterns return structured errors.
