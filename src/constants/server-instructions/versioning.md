# Versioning (Optimistic Concurrency Control)

mysql-mcp provides tools to implement Optimistic Concurrency Control (OCC) for your applications. This ensures that when multiple actors try to update the same row simultaneously, lost updates are prevented.

## OCC Workflow

1. **Enable Versioning**: `mysql_enable_versioning` adds a `_version` column to your table and creates an auto-incrementing trigger.
2. **Read the Row**: Use `mysql_read_query` or `mysql_check_version` to obtain the row's current `_version`.
3. **Update Conditionally**: Use `mysql_conditional_update`, passing the `_version` you read as the `expectedVersion`.
4. **Handle Conflicts**: If the row was modified since you read it, the update will fail with a `Version conflict`. Re-read the row and retry the update.

## Versioning Tools

- **`mysql_enable_versioning`**: Enables versioning on a table by adding a `_version INT NOT NULL DEFAULT 1` column and a `BEFORE UPDATE` trigger to auto-increment it.
- **`mysql_disable_versioning`**: Disables versioning by dropping the trigger and the `_version` column.
- **`mysql_check_version`**: Quickly checks the current `_version` of a specific row.
- **`mysql_conditional_update`**: Updates a row only if its `_version` matches the provided `expectedVersion`.

### Example

```typescript
// 1. Enable versioning
mysql_enable_versioning({ table: "users" });

// 2. Read the current version
const { version } = mysql_check_version({ table: "users", rowId: 1 });

// 3. Attempt to update
mysql_conditional_update({
  table: "users",
  data: { status: "active" },
  conditions: [{ column: "id", value: 1 }],
  expectedVersion: version
});
```

*Note: OCC tools require `admin` or `write` scopes depending on the operation.*
