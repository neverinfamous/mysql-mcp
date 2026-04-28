# mysql-mcp Tool Group Testing: [security]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Test Database Schema

| Table | Rows | Key Columns |
|-------|------|-------------|
| `test_products` | 16 | id, name, price, category |
| `test_users` | 10 | id, username, email, phone, bio, role |

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: security

### security Group-Specific Testing

security Tool Group (9 tools +1 for code mode):

1. 'mysql_security_audit'
2. 'mysql_security_firewall_status'
3. 'mysql_security_firewall_rules'
4. 'mysql_security_mask_data'
5. 'mysql_security_password_validate'
6. 'mysql_security_ssl_status'
7. 'mysql_security_user_privileges'
8. 'mysql_security_sensitive_tables'
9. 'mysql_security_encryption_status'
10. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. ✅ `mysql_security_audit()` → Passed (13 events, 670 tokens)
2. ✅ `mysql_security_ssl_status()` → Passed (SSL disabled on test db, 101 tokens)
3. ✅ `mysql_security_user_privileges({user: "root"})` → Passed (2 users, full grants, 798 tokens)
4. ✅ `mysql_security_user_privileges({user: "root", summary: true})` → Passed (summarized payload, 291 tokens)
5. ✅ `mysql_security_sensitive_tables({database: "testdb"})` → Passed (3 tables identified, 434 tokens)
6. ✅ `mysql_security_password_validate({password: "weak"})` → Passed (strength: 25, meetsPolicy: false, 130 tokens)
7. ✅ `mysql_security_password_validate({password: "Str0ng!Pass#2026"})` → Passed (strength: 100, meetsPolicy: true, 132 tokens)
8. ✅ `mysql_security_encryption_status()` → Passed (keyringPlugins: [], 133 tokens)

**Domain error paths (🔴):**

9. ✅ 🔴 `mysql_security_user_privileges({user: "nonexistent_user_xyz"})` → Passed (returned `{success: false, error: "User 'nonexistent_user_xyz' does not exist."}`)

**Zod validation error paths (🔴):**

10. ✅ 🔴 `mysql_security_password_validate({})` → Passed (returned `{success: false, error: "Validation error: password: Invalid input: expected string, received undefined"}`)
