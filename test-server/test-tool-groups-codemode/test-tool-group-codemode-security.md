# mysql-mcp Code Mode Re-Testing: [security]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

---

## Group Focus: security

security Tool Group (9 tools +1 code mode):

1. `mysql_security_audit` 2. `mysql_security_firewall_status` 3. `mysql_security_firewall_rules`
2. `mysql_security_mask_data` 5. `mysql_security_password_validate` 6. `mysql_security_ssl_status`
3. `mysql_security_user_privileges` 8. `mysql_security_sensitive_tables` 9. `mysql_security_encryption_status`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.security.help()` → verify method listing
2. `mysql.security.audit()` → audit results
3. `mysql.security.sslStatus()` → SSL info
4. `mysql.security.userPrivileges({user: "root"})` → privileges
5. `mysql.security.userPrivileges({user: "root", summary: true})` → summarized
6. `mysql.security.sensitiveTables({database: "testdb"})` → scan results
7. `mysql.security.passwordValidate({password: "weak"})` → weak assessment
8. `mysql.security.passwordValidate({password: "Str0ng!Pass#2026"})` → passes
9. `mysql.security.encryptionStatus()` → encryption info

**Domain error paths (🔴):**

10. 🔴 `mysql.security.userPrivileges({user: "nonexistent_xyz"})` → `{success: false}` or empty

**Zod validation error paths (🔴):**

11. 🔴 `mysql.security.passwordValidate({})` → `{success: false, error: "Validation error: ..."}`
