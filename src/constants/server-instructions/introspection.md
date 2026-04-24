# Introspection Tools

The **Introspection** group provides advanced schema analysis capabilities, specifically designed to help AI agents understand complex entity relationships, simulate changes, and assess risks before performing database migrations or schema modifications.

## Core Capabilities

- **Dependency Mapping**: Analyze deep relationships between tables (`mysql_dependency_graph`) to understand how entities are interconnected.
- **Topological Sorting**: Determine the exact order in which tables must be created or deleted to satisfy foreign key constraints (`mysql_topological_sort`).
- **Cascade Simulation**: Safely simulate the cascading effects of a `DELETE` or `UPDATE` operation (`mysql_cascade_simulator`) without modifying actual data, preventing accidental mass data loss.
- **Schema Snapshots**: Capture the exact state of the schema definition at a given point in time (`mysql_schema_snapshot`).
- **Constraint Analysis**: Detect circular dependencies, missing indexes on foreign keys, and overlapping constraints (`mysql_constraint_analysis`).
- **Risk Assessment**: Pre-flight checks for `ALTER TABLE` and `DROP TABLE` operations to identify potential downtime or locking issues (`mysql_migration_risks`).

## Best Practices

- **Pre-Migration Checks**: Always run `mysql_migration_risks` and `mysql_topological_sort` before executing any broad schema changes.
- **Cascade Safety**: If you are planning a `DELETE` on a core table (e.g., `users` or `organizations`), use `mysql_cascade_simulator` first to understand the blast radius.
- **Dependency Awareness**: When writing complex `JOIN` queries across unfamiliar schemas, use `mysql_dependency_graph` to ensure you understand the optimal traversal paths.
