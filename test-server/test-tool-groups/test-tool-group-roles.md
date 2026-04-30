# mysql-mcp Tool Group Testing: [roles]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Structured Error Response Pattern

| Type                 | What you see                                     | Verdict |
| -------------------- | ------------------------------------------------ | ------- |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌     | Raw text error string with `isError: true`       | Bug     |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: roles

### roles Group-Specific Testing

roles Tool Group (8 tools +1 for code mode):

1. 'mysql_role_list'
2. 'mysql_role_create'
3. 'mysql_role_drop'
4. 'mysql_role_grants'
5. 'mysql_role_grant'
6. 'mysql_role_assign'
7. 'mysql_role_revoke'
8. 'mysql_user_roles'
9. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_role_list()` → verify response structure (may be empty)

**Create → Use → Drop lifecycle:**

2. `mysql_role_create({name: "temp_test_role"})` → `{success: true}`
3. `mysql_role_grants({role: "temp_test_role"})` → verify grants (initially empty)
4. `mysql_role_grant({role: "temp_test_role", privilege: "SELECT", on: "testdb.*"})` → `{success: true}`
5. `mysql_role_grants({role: "temp_test_role"})` → verify SELECT privilege appears
6. `mysql_role_drop({name: "temp_test_role"})` → `{success: true}`

**Domain error paths (🔴):**

7. 🔴 `mysql_role_grants({role: "nonexistent_role_xyz"})` → `{success: false, error: "..."}` handler error
8. 🔴 `mysql_role_drop({name: "nonexistent_role_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

9. 🔴 `mysql_role_create({})` → `{success: false, error: "..."}` (Zod validation)
10. 🔴 `mysql_role_grant({})` → `{success: false, error: "..."}` (missing required params)
