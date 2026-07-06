# Code Mode (`mysql_execute_code`)

- **Purpose**: Execute JavaScript in a secure worker-thread sandbox (separate V8 isolate) with full access to all 200+ MySQL MCP tools via the global `mysql.*` API.
- **Capabilities**: The sandbox allows you to script complex multi-step workflows, loops, logic, and data transformations natively on the server, saving 70-90% on token consumption compared to making individual MCP tool calls.
- **API Access**: 
  - All tools are organized into groups on the `mysql` object (e.g., `mysql.core.readQuery()`, `mysql.admin.optimizeTable()`, `mysql.json.extract()`, `mysql.shell.version()`).
  - Tools that take a single object parameter can be called positionally or with the object (e.g. `mysql.core.readQuery("SELECT 1")` or `mysql.core.readQuery({ query: "SELECT 1" })`).
- **Safety & Execution**: 
  - The sandbox intercepts all tool calls and routes them through the same `AuditInterceptor` as standard MCP calls.
  - The last expression in the script is automatically returned (Node REPL semantics) via an auto-return transform. You do not need explicit `return` statements for the final value.
  - Smart result proxies handle missing `await` statements, preventing Promise-related errors.
- **Best Practices**:
  - **Always** use Code Mode for iterative tasks (like paginating through records, bulk updates, or parsing results to feed into another query).
  - You can combine tools from multiple groups (e.g., fetch data with `mysql.core.readQuery`, transform it in JS, and insert via `mysql.core.writeQuery`).
