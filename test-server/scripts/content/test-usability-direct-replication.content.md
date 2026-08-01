## Hallucination & Usability Fuzzing

> **Instructions**: You must organically test the tool group using direct MCP tool calls, intentionally fuzzing the inputs.
> 1. Provide edge cases, unexpected types, and boundary values directly into the MCP tool payloads.
> 2. Ensure that the tool gracefully handles errors and returns structured domain errors, rather than crashing or returning raw `-32602` or `FAILED_FILE_NOT_FOUND` errors.
> 3. If you find a hallucination or unhandled edge case, you must apply a permanent fix to the codebase to harden it against this scenario.

> **Replication Context Guardrail**: Tools like `mysql_replication_lag` and `mysql_slave_status` rely on `SHOW REPLICA STATUS`. Because the default test environment connects via a router (`6446`) which directs traffic to the Primary node, these tools will correctly return `null` or empty metrics. This is the **expected and valid success state** for testing. DO NOT mark this as an "Infrastructure Absent" failure, and DO NOT attempt to reconfigure `mcp_config.json` to hit the replica node directly unless explicitly requested.
