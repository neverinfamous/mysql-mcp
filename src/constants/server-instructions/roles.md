# Role Management

Tools: `mysql_role_list`, `mysql_role_create`, `mysql_role_drop`, `mysql_role_grants`, `mysql_role_grant`, `mysql_role_assign`, `mysql_role_revoke`, `mysql_user_roles`

- **Privilege requirements**: Role management requires `CREATE ROLE`, `DROP ROLE`, `GRANT`, and `REVOKE` privileges.
- **Role lifecycle**: Create roles with `mysql_role_create`, grant privileges with `mysql_role_grant`, then assign to users with `mysql_role_assign`.
- **Listing roles**: `mysql_role_list` shows all defined roles. Use `pattern` parameter for LIKE-style filtering (e.g., `pattern: "admin%"`).
- **Create/Drop safety**: `mysql_role_create` with `ifNotExists: true` returns `{ success: true, skipped: true, reason: "Role already exists" }` for existing roles. `mysql_role_drop` with `ifExists: true` returns `{ success: true, skipped: true, reason: "Role did not exist" }` for nonexistent roles.
- **Graceful create/drop errors**: `mysql_role_create` returns `{ success: false, error }` when the role already exists (without `ifNotExists`). `mysql_role_drop` returns `{ success: false, error }` when the role does not exist (without `ifExists`).
- **Privilege grants**: `mysql_role_grant` supports `database.table` syntax (e.g., `table: "my_schema.my_table"`). Use `table: "*"` for schema-wide privileges (e.g., `testdb.*`). Use `privileges: ["SELECT", "INSERT"]`. Returns a structured error for nonexistent tables or roles.
- **Role assignment**: `mysql_role_assign` assigns a role to a user. Use `withAdminOption: true` to allow the user to grant the role to others. Returns a structured error when the target user or role does not exist.
- **Role revocation**: `mysql_role_revoke` pre-checks `mysql.role_edges` and returns a structured error when the role is not currently assigned to the user. Also returns a structured error when the target user or role does not exist.
- **User roles**: `mysql_user_roles` lists roles assigned to a user, including the `admin` flag (Y/N) indicating admin option status. Returns a structured error when the user does not exist.
- **Existence checks**: `mysql_role_grants` returns a structured error (`OBJECT_NOT_FOUND`) if the role does not exist, avoiding raw SQL errors. `mysql_role_grant`, `mysql_role_assign`, and `mysql_role_revoke` also check role/user existence and return structured errors gracefully.
