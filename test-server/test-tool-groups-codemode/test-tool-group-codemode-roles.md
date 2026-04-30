# mysql-mcp Code Mode Re-Testing: [roles]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Requirements

1. 
2. 

---

## Group Focus: roles

roles Tool Group (8 tools +1 code mode):

1. `mysql_role_list` 2. `mysql_role_create` 3. `mysql_role_drop`
2. `mysql_role_grants` 5. `mysql_role_grant` 6. `mysql_role_assign`
3. `mysql_role_revoke` 8. `mysql_user_roles`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.roles.help()` → verify method listing
2. `mysql.roles.list()` → response structure

**Create → Use → Drop lifecycle:**

3. `mysql.roles.create({name: "temp_cm_role"})` → `success: true`
4. `mysql.roles.grants({role: "temp_cm_role"})` → empty grants
5. `mysql.roles.grant({role: "temp_cm_role", privilege: "SELECT", on: "testdb.*"})` → `success: true`
6. `mysql.roles.grants({role: "temp_cm_role"})` → SELECT visible
7. `mysql.roles.drop({name: "temp_cm_role"})` → `success: true`

**Domain error paths (🔴):**

8. 🔴 `mysql.roles.grants({role: "nonexistent_xyz"})` → `{success: false}`
9. 🔴 `mysql.roles.drop({name: "nonexistent_xyz"})` → `{success: false}`

**Zod validation error paths (🔴):**

10. 🔴 `mysql.roles.create({})` → `{success: false, error: "Validation error: ..."}`
11. 🔴 `mysql.roles.grant({})` → `{success: false, error: "Validation error: ..."}`
