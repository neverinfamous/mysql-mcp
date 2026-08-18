# Prompt Testing Guide

[![Tools](https://img.shields.io/badge/Tools-Available-blue?style=for-the-badge)](#)
[![Resources](https://img.shields.io/badge/Resources-Available-green?style=for-the-badge)](#)
[![Prompts](https://img.shields.io/badge/Prompts-Available-purple?style=for-the-badge)](#)
<br>
[![OAuth 2.1](https://img.shields.io/badge/OAuth-2.1-red?style=for-the-badge)](#)
[![Code Mode](https://img.shields.io/badge/Code-Mode-orange?style=for-the-badge)](#)

This document provides human-readable instructions for testing all AI-powered prompts exposed by the `mysql-mcp` server.

> [!IMPORTANT]
> **Prerequisite: Seed the Database**
> Before testing the prompts, you must seed the `testdb` database with the required mock data.
>
> Run the following PowerShell command to reset and seed the database:
> ```powershell
> docker exec mysql-node1 mysql -uroot -proot testdb -e "DROP TABLE IF EXISTS prompt_order_items, prompt_orders, prompt_users, prompt_transactions, prompt_sessions, prompt_audit_log, prompt_locations, prompt_documents, prompt_events, prompt_daily_reports, prompt_weekly_metrics;"
> Get-Content .\test-server\test-prompts.sql -Raw | docker exec -i mysql-node1 mysql -uroot -proot testdb
> ```

## 1. Environment Setup

The seeding script creates several tables prefixed with `prompt_*` to support specific prompt workflows:

| Section | Target Tables | Supports Prompts |
| :--- | :--- | :--- |
| **Core** | `prompt_users`, `prompt_orders`, `prompt_order_items` | `mysql_query_builder`, `mysql_schema_design`, `mysql_migration` |
| **Performance** | `prompt_transactions` *(10K rows)* | `mysql_performance_analysis`, `mysql_index_tuning` |
| **Health** | `prompt_sessions` | `mysql_database_health_check` |
| **Backup** | `prompt_audit_log` | `mysql_backup_strategy` |
| **Events** | `prompt_events` *(1K rows)*, `prompt_daily_reports`, `prompt_weekly_metrics` | `mysql_setup_events` |
| **Spatial** | `prompt_locations` *(POINT geometry, SRID 4326)* | `mysql_setup_spatial` |
| **Docstore** | `prompt_documents` *(JSON + `_id`)* | `mysql_setup_docstore` |
| **Infra** | *(Uses existing server state)* | `mysql_setup_router`, `mysql_setup_proxysql`, `mysql_setup_replication`, `mysql_setup_shell`, `mysql_setup_cluster`, `mysql_sys_schema_guide`, `mysql_setup_observability` |

---

## 2. Test Execution Commands

Use your MCP client to invoke the following prompts.

### 2.1 No-Argument Prompts (Instant Execution)
These prompts do not require any input and should immediately return comprehensive guides:
- `/mysql_tool_index`
- `/mysql_setup_router`
- `/mysql_setup_proxysql`
- `/mysql_setup_shell`
- `/mysql_setup_events`
- `/mysql_sys_schema_guide`
- `/mysql_setup_spatial`
- `/mysql_setup_cluster`
- `/mysql_setup_docstore`
- `/mysql_mcp_heal`
- `/mysql_setup_observability`

### 2.2 Optional-Argument Prompts
Test these prompts both with and without arguments to verify dynamic context generation.

#### Health Check
- `/mysql_database_health_check`
- `/mysql_database_health_check focus:connections`
- `/mysql_database_health_check focus:performance`
- `/mysql_database_health_check focus:replication`
- `/mysql_database_health_check focus:storage`

#### Backup Strategy
- `/mysql_backup_strategy`
- `/mysql_backup_strategy rpo:1 hour`
- `/mysql_backup_strategy rpo:15 minutes rto:30 minutes`
- `/mysql_backup_strategy rpo:1 hour rto:4 hours data_size:100GB`

#### Index Tuning
- `/mysql_index_tuning`
- `/mysql_index_tuning table:prompt_transactions`
- `/mysql_index_tuning table:prompt_orders`

#### Replication Setup
- `/mysql_setup_replication`
- `/mysql_setup_replication type:semisync`
- `/mysql_setup_replication type:group`

### 2.3 Required-Argument Prompts
Test these prompts to ensure they properly enforce constraints and utilize the provided context.

#### Query Builder
- `/mysql_query_builder operation:SELECT table:prompt_users description:find all users with their order counts`
- `/mysql_query_builder operation:INSERT table:prompt_orders description:create a new order for a user`
- `/mysql_query_builder operation:UPDATE table:prompt_users description:update last_login timestamp`
- `/mysql_query_builder operation:DELETE table:prompt_sessions description:remove expired sessions`

#### Quick Query
- `/mysql_quick_query sql:SELECT * FROM prompt_users`
- `/mysql_quick_query sql:SELECT u.username, COUNT(o.id) as order_count FROM prompt_users u LEFT JOIN prompt_orders o ON u.id = o.user_id GROUP BY u.username`
- `/mysql_quick_query sql:UPDATE prompt_users SET last_login = NOW() WHERE username = 'alice' type:write`

#### Quick Schema *(table is optional, but heavily relied on)*
- `/mysql_quick_schema`
- `/mysql_quick_schema table:prompt_transactions`
- `/mysql_quick_schema table:prompt_locations`

#### Schema Design
- `/mysql_schema_design entity:e-commerce product catalog`
- `/mysql_schema_design entity:user notification system requirements:support email, SMS, and push notifications with delivery tracking`

#### Performance Analysis
- `/mysql_performance_analysis query:SELECT * FROM prompt_transactions WHERE amount > 1000`
- `/mysql_performance_analysis query:SELECT account_id, SUM(amount) FROM prompt_transactions GROUP BY account_id HAVING SUM(amount) > 50000 context:prompt_transactions has 10K rows with indexes on account_id and transaction_type`

#### Migration Generation
- `/mysql_migration change:add status column table:prompt_users`
- `/mysql_migration change:add composite index on (account_id, created_at) table:prompt_transactions`

---

## 3. Validation & Quality Gates

When reviewing the outputs from the AI agent, verify the following criteria:

1. **Structured Markdown**: The agent must return well-formatted Markdown (no raw SQL dumps or empty responses).
2. **Actionable Guidance**: The response should include step-by-step instructions, example queries, and configuration recommendations.
3. **Parameter Honor**: The agent must respect the provided arguments (e.g., `focus:connections` should strictly emphasize connection analysis over generic health metrics).
4. **Tool Discovery**: The agent must correctly mention and utilize the appropriate `mysql-mcp` tools required for the workflow.

### Reporting Rubric
- ✅ **Pass**: Prompt returns well-structured guidance perfectly matching the expected use case.
- ⚠️ **Partial**: Prompt returns guidance but misses arguments, ignores parameters, or provides stale/generic information.
- ❌ **Fail**: Prompt errors, returns empty output, or hallucinates irrelevant context.

Provide a summary table of all prompts with their pass/partial/fail status. Separately list any issues requiring code fixes vs. documentation improvements.

---

## 4. Teardown

To clean up the environment after testing, execute the following SQL script to drop all test tables:

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
