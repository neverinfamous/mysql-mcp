# mysql-mcp Advanced Stress Tests: [security]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-security.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Password Validation Boundaries

1. ✅ `mysql_security_password_validate({password: ""})` → verify structured response (empty password)
2. ✅ `mysql_security_password_validate({password: "a"})` → verify weak assessment
3. ✅ `mysql_security_password_validate({password: "A1!aB2@bC3#cD4$d"})` → verify strong assessment
4. ✅ `mysql_security_password_validate({password: "' OR 1=1 --"})` → verify structured response (no SQL injection)
5. ✅ `mysql_security_password_validate` with a 256-character password → verify no truncation crash

## Category 2: Sensitive Table Detection

6. ✅ Create `stress_sensitive` table with columns: `id INT`, `password VARCHAR(255)`, `ssn VARCHAR(11)`, `credit_card VARCHAR(20)`
7. ✅ `mysql_security_sensitive_tables({database: "testdb"})` → verify `stress_sensitive` is flagged
8. ✅ Create `stress_safe` table with columns: `id INT`, `name VARCHAR(100)`, `quantity INT`
9. ✅ `mysql_security_sensitive_tables({database: "testdb"})` → verify `stress_safe` is NOT flagged

## Category 3: Privilege Enumeration Edge Cases

10. 📦 `mysql_security_user_privileges({user: "root"})` → log token estimate (full): 896 tokens
11. ✅ `mysql_security_user_privileges({user: "root", summary: true})` → log token estimate (summary): 413 tokens
12. ✅ Verify summary is smaller than full output (413 < 896)
13. ✅ `mysql_security_user_privileges({user: "nonexistent_user_xyz"})` → verify structured `{success: false}` or empty result

## Category 4: Payload Monitoring

14. 📦 `mysql_security_audit()` → log token estimate, flag > 500 tokens as 📦: 1243 tokens
15. ✅ `mysql_security_encryption_status()` → log token estimate: 217 tokens
16. ✅ `mysql_security_ssl_status()` → log token estimate: 184 tokens

## Cleanup

17. ✅ Drop `stress_sensitive` and `stress_safe` tables

## Aggregated Failures

```json
[]
```
