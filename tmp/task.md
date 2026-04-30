# MySQL-MCP Text Tool Group Certification

## Coverage Matrix

| Tool | Happy Path | Domain Error | Zod Error | Status |
|------|------------|--------------|-----------|--------|
| `mysql_regexp_match` | ✅ | ✅ | ✅ | CERTIFIED |
| `mysql_like_search` | ✅ | ✅ | ✅ | CERTIFIED |
| `mysql_soundex` | ✅ | ✅ | ✅ | CERTIFIED |
| `mysql_substring` | ✅ | ✅ | ✅ | CERTIFIED |
| `mysql_concat` | ✅ | ✅ | ✅ | CERTIFIED |
| `mysql_collation_convert` | ✅ | ✅ | ✅ | CERTIFIED |

## Remediation Log
- **Zod Error Handling**: Updated all 6 tools in `src/adapters/mysql/tools/text/processing.ts` to use `formatHandlerErrorResponse()` in their catch blocks instead of custom error serialization. This guarantees structured `{success: false, error: "Validation error: ..."}` formatting for all schema validation failures, aligning with the server's rigid error contract.
