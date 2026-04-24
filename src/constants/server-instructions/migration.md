# Migration Tools

The **Migration** group provides an integrated, structured schema versioning and deployment system directly within the MCP server. It is designed to track schema changes, ensure idempotent deployments, and allow safe rollbacks.

## Core Capabilities

- **Initialization**: Set up the migration tracking tables (`_mysql_migrations`) in the target database (`mysql_migration_init`).
- **Tracking & Status**: View applied migrations (`mysql_migration_history`) and check the current state against pending migrations (`mysql_migration_status`).
- **Execution**: Apply a single forward migration step (`mysql_migration_apply`) safely.
- **Rollback**: Revert a recently applied migration (`mysql_migration_rollback`).
- **Record Auditing**: Manually record that a migration was applied out-of-band (`mysql_migration_record`).

## Best Practices

- **Idempotency**: Always ensure your migration scripts are idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP TABLE IF EXISTS`).
- **Downtime Minimization**: Combine with tools from the `introspection` group (like `mysql_migration_risks`) prior to applying migrations to production databases.
- **Transactions**: For storage engines that support transactional DDL (note: MySQL largely commits DDL implicitly, unlike PostgreSQL), still attempt to group related DML updates together safely.
- **Initialization First**: You must run `mysql_migration_init` before attempting to use `mysql_migration_apply` or track history.
