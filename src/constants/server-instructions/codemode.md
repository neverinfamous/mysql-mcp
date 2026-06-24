# Code Mode (`mysql_execute_code`)

- **Purpose**: Safely execute arbitrary raw SQL queries natively on the database.
- **Tools**: `mysql_execute_code` is the singular entry point for ad-hoc execution when specific MCP tools do not cover the requirements.
- **Safety**: 
  - Ensure queries are valid against the specific MySQL/MariaDB version.
  - Pay attention to the response if it returns errors or partial execution results.
- **Best Practices**:
  - Only use this tool if no other specialized tool (e.g., introspection, vector, docstore) provides the requested functionality.
  - Parameterize variables whenever possible or format the SQL carefully to avoid syntax errors.
  - When returning large data sets, use `LIMIT` to avoid overwhelming the context window.
