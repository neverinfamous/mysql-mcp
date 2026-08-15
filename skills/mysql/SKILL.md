---
name: mysql
version: 1.0.0
tags:
  - "agent-skill"
triggers:
  - MySQL
  - MariaDB
  - InnoDB
  - my.cnf
  - mysql-mcp
  - STRICT_TRANS_TABLES
exclude:
  - "generic database setup without engine name"
  - Postgres
  - PostgreSQL
  - SQLite
  - ORM-managed migrations
description: |
  Use when designing, querying, or managing a MySQL or MariaDB database.
  Enforces enterprise production rules for query safety (strict parameterization),
  connection pooling, and strict schema configurations (STRICT_TRANS_TABLES).
  Require the user to name the database engine explicitly before triggering. Never guess.
---

# MySQL / MariaDB Production Standards

MySQL and MariaDB are powerful relationship-driven databases, but AI agents MUST adhere to these strict behavioral boundaries when executing queries, utilizing the `mysql-mcp` server, or generating application code.

> [!NOTE]
> Actively target **8.4 LTS** or **9.0+** for production environments. Both MySQL 9.0+ and MariaDB now feature native `VECTOR` data types and search capabilities.

## 1. Query Safety & Execution Rules

- **Absolute Parameterization**: You MUST ALWAYS use parameterized queries (`?`). Under zero circumstances are you permitted to string-interpolate or concatenate variables into a raw SQL string. This is to enforce strict SQL-injection prevention.
- **Guarded Reads**: Every top-level `SELECT` statement MUST contain a `LIMIT` clause. Never use `SELECT *` in production code; always enumerate required columns explicitly.
- **Safe Destructive Ops**: `DELETE` and `UPDATE` queries MUST include a `WHERE` clause.
- **DDL Destructive Ops**: `TRUNCATE TABLE`, `DROP TABLE`, `DROP DATABASE`, `ALTER TABLE ... DROP COLUMN`, and `ALTER TABLE ... RENAME COLUMN` MUST require explicit user confirmation before execution. Never infer intent for these.
- **Action Scoping**: Limit operations to single-statements. Do not stack multiple statements (`query1; query2;`) in a single payload unless executing a batch migration.
- **Performance Validation**: ALWAYS run `EXPLAIN` (or `EXPLAIN ANALYZE` in MySQL 9.0+ for JSON output) before suggesting index optimizations or query rewrites to the user.

## 2. Connections & Transactions

- **Connection Pooling**: Always assume and design for connection pooling. Code evaluating database connections should handle acquiring from and releasing to a pool, avoiding connection leaks. 
  - **Sizing Formula**: `pool_size = (max_connections - reserved_admin) / app_instances`.
  - **Multiplexing**: Utilize **ProxySQL** to handle connection multiplexing and read/write splitting. **CRITICAL**: Avoid anti-patterns that pin connections and kill multiplexing efficiency (e.g., long-running transactions, temporary tables, `SET @var`, and caching prepared statements on the client without closing them).
- **Data Mutability Scopes**: Whenever executing writes spanning across multiple tables (e.g., inserts requiring foreign key links), they MUST be wrapped in a transaction block. You MUST implement a `ROLLBACK` in every `catch` block for these operations.

## 3. Strict Schema Configurations

- **Mode Enforcement**: Ensure `sql_mode` includes `STRICT_TRANS_TABLES` and `ONLY_FULL_GROUP_BY`. AI agents must not disable these modes to bypass errors; you must rewrite your `GROUP BY` logic to be strictly compliant.
- **Foreign Keys**: Explicitly define `FOREIGN KEY` constraints during `CREATE TABLE` unless specifically orchestrating a Vitess/PlanetScale sharded environment where declarative FKs are explicitly forbidden by the user context.

## 4. Ecosystem & Performance Tuning

- **Hardware Awareness**: Align thread pool sizes closely with CPU core counts on modern chiplet architectures.
- **Error Handling**: When intercepting connection drops or authentication failures (e.g., ER_ACCESS_DENIED_ERROR), instruct the user to verify their `.env` configurations (`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`). Do not hallucinate database names.
- **Using MCP**: If the `mysql-mcp` server is attached, prefer utilizing its formal structured tools over executing raw Bash CLI scripts (`mysql -h ...`) to guarantee payload optimizations and schema intelligence.
- **MySQL Shell (AdminAPI)**: ALWAYS prefer using MySQL Shell (`mysqlsh`) for InnoDB Cluster management and topology changes rather than raw SQL replication commands.
- **Router vs ProxySQL**: Use MySQL Router for out-of-the-box HA routing with InnoDB Cluster. Use ProxySQL when advanced connection multiplexing or query rewriting is required.

## 5. Security & Authentication

- **Authentication Plugins**: MySQL 9.0 completely removes the legacy `mysql_native_password` plugin (and it is disabled by default in 8.4). You MUST mandate and configure `caching_sha2_password` for all application drivers.
- **TLS/SSL**: Enforce TLS/SSL for all connections. Use the `validate_password` plugin to strictly enforce password complexity.

## 6. Modern Data Types (JSON & Vector)

- **JSON Data**: ALWAYS use the native `JSON` data type instead of storing stringified JSON in `TEXT`/`VARCHAR` columns. Utilize `JSON_EXTRACT` (or the `->` / `->>` operators) for querying, and strongly consider creating Multi-Valued Indexes or functional indexes on heavily queried JSON paths.
- **AI & Vector Workloads**: When working with MySQL 9.0+, utilize the native `VECTOR` data type and `VECTOR_DISTANCE()` function for storing and querying AI embeddings. Note that vector columns cannot currently be used as primary or foreign keys.
