# Reset Prompts Test Database

[![Tools](https://img.shields.io/badge/Tools-241-blue?style=for-the-badge)](#)
[![Resources](https://img.shields.io/badge/Resources-23-green?style=for-the-badge)](#)
[![Prompts](https://img.shields.io/badge/Prompts-19-purple?style=for-the-badge)](#)
<br>
[![OAuth 2.1](https://img.shields.io/badge/OAuth-2.1-red?style=for-the-badge)](#)
[![Code Mode](https://img.shields.io/badge/Code-Mode-orange?style=for-the-badge)](#)

## Value Proposition
Build AI integrations instantly.
Empower agents with secure database access.
Execute complex logic via Code Mode.
Scale operations with robust connection pooling.
Leverage OAuth 2.1 for enterprise security.

Run this command to seed the database for testing all 19 mysql-mcp prompts:

```powershell
docker exec mysql-final mysql -uroot -proot testdb -e "DROP TABLE IF EXISTS prompt_order_items, prompt_orders, prompt_users, prompt_transactions, prompt_sessions, prompt_audit_log, prompt_locations, prompt_documents, prompt_events, prompt_daily_reports, prompt_weekly_metrics;" && Get-Content .\test-server\test-prompts.sql -Raw | docker exec -i mysql-final mysql -uroot -proot testdb
```

## What This Creates

Tables prefixed with `prompt_*` to support testing:

| Section     | Tables                                                                     | Supports Prompts                                                                                                                              |
| ----------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Core        | `prompt_users`, `prompt_orders`, `prompt_order_items`                      | `mysql_query_builder`, `mysql_schema_design`, `mysql_migration`                                                                               |
| Performance | `prompt_transactions` (10K rows)                                           | `mysql_performance_analysis`, `mysql_index_tuning`                                                                                            |
| Health      | `prompt_sessions`                                                          | `mysql_database_health_check`                                                                                                                 |
| Backup      | `prompt_audit_log`                                                         | `mysql_backup_strategy`                                                                                                                       |
| Events      | `prompt_events` (1K rows), `prompt_daily_reports`, `prompt_weekly_metrics` | `mysql_setup_events`                                                                                                                          |
| Spatial     | `prompt_locations` (POINT geometry, SRID 4326)                             | `mysql_setup_spatial`                                                                                                                         |
| Docstore    | `prompt_documents` (JSON + `_id`)                                          | `mysql_setup_docstore`                                                                                                                        |
| Infra       | Uses existing server state                                                 | `mysql_setup_router`, `mysql_setup_proxysql`, `mysql_setup_replication`, `mysql_setup_shell`, `mysql_setup_cluster`, `mysql_sys_schema_guide` |

## Testing Prompts

### No-Argument Prompts (10 — complete immediately)

```
/mysql_tool_index
/mysql_quick_schema
/mysql_setup_router
/mysql_setup_proxysql
/mysql_setup_shell
/mysql_setup_events
/mysql_sys_schema_guide
/mysql_setup_spatial
/mysql_setup_cluster
/mysql_setup_docstore
```

### Optional-Argument Prompts (4)

#### mysql_database_health_check (focus: connections, performance, replication, storage)

```
/mysql_database_health_check
/mysql_database_health_check focus:connections
/mysql_database_health_check focus:performance
/mysql_database_health_check focus:replication
/mysql_database_health_check focus:storage
```

#### mysql_backup_strategy (rpo, rto, data_size)

```
/mysql_backup_strategy
/mysql_backup_strategy rpo:1 hour
/mysql_backup_strategy rpo:15 minutes rto:30 minutes
/mysql_backup_strategy rpo:1 hour rto:4 hours data_size:100GB
```

#### mysql_index_tuning (table)

```
/mysql_index_tuning
/mysql_index_tuning table:prompt_transactions
/mysql_index_tuning table:prompt_orders
```

#### mysql_setup_replication (type: async, semisync, group)

```
/mysql_setup_replication
/mysql_setup_replication type:semisync
/mysql_setup_replication type:group
```

### Required-Argument Prompts (6)

#### mysql_query_builder (operation, table, description)

```
/mysql_query_builder operation:SELECT table:prompt_users description:find all users with their order counts
/mysql_query_builder operation:INSERT table:prompt_orders description:create a new order for a user
/mysql_query_builder operation:UPDATE table:prompt_users description:update last_login timestamp
/mysql_query_builder operation:DELETE table:prompt_sessions description:remove expired sessions
```

#### mysql_quick_query (sql, type)

```
/mysql_quick_query sql:SELECT * FROM prompt_users
/mysql_quick_query sql:SELECT u.username, COUNT(o.id) as order_count FROM prompt_users u LEFT JOIN prompt_orders o ON u.id = o.user_id GROUP BY u.username
/mysql_quick_query sql:UPDATE prompt_users SET last_login = NOW() WHERE username = 'alice' type:write
```

#### mysql_quick_schema (table — optional but tested as required)

```
/mysql_quick_schema
/mysql_quick_schema table:prompt_transactions
/mysql_quick_schema table:prompt_locations
```

#### mysql_schema_design (entity, requirements)

```
/mysql_schema_design entity:e-commerce product catalog
/mysql_schema_design entity:user notification system requirements:support email, SMS, and push notifications with delivery tracking
```

#### mysql_performance_analysis (query, context)

```
/mysql_performance_analysis query:SELECT * FROM prompt_transactions WHERE amount > 1000
/mysql_performance_analysis query:SELECT account_id, SUM(amount) FROM prompt_transactions GROUP BY account_id HAVING SUM(amount) > 50000 context:prompt_transactions has 10K rows with indexes on account_id and transaction_type
```

#### mysql_migration (change, table)

```
/mysql_migration change:add status column table:prompt_users
/mysql_migration change:add composite index on (account_id, created_at) table:prompt_transactions
```

## Cleanup

To remove all prompt test tables:

```sql
DROP TABLE IF EXISTS prompt_order_items;
DROP TABLE IF EXISTS prompt_orders;
DROP TABLE IF EXISTS prompt_users;
DROP TABLE IF EXISTS prompt_transactions;
DROP TABLE IF EXISTS prompt_sessions;
DROP TABLE IF EXISTS prompt_audit_log;
DROP TABLE IF EXISTS prompt_events;
DROP TABLE IF EXISTS prompt_daily_reports;
DROP TABLE IF EXISTS prompt_weekly_metrics;
DROP TABLE IF EXISTS prompt_locations;
DROP TABLE IF EXISTS prompt_documents;
```

## Validation Criteria

### Pass Criteria

Each prompt invocation should:

1. **Return structured markdown** — not empty, not an error, not raw SQL
2. **Include actionable guidance** — step-by-step instructions, example queries, or configuration recommendations
3. **Respect arguments** — when optional/required arguments are provided, the output should reflect them (e.g., `focus:connections` should emphasize connection analysis)
4. **Reference correct tools** — prompts should mention the relevant mysql-mcp tools for each workflow step

### Reporting Format

- ✅ **Pass**: Prompt returns well-structured guidance matching the expected use case
- ⚠️ **Partial**: Prompt returns guidance but misses arguments, ignores parameters, or has stale information
- ❌ **Fail**: Prompt errors, returns empty output, or produces irrelevant content

### Final Summary

Provide a summary table of all 19 prompts with their pass/partial/fail status. Separately list any issues requiring code fixes vs. documentation improvements.
