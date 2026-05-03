# mysql-mcp Advanced Stress Tests: [security]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

## Test Database Schema

| Table | Rows | Key Columns | JSON Columns |
|---|---|---|---|
| `test_products` | 16 | id, name, price, category | metadata |
| `test_orders` | 20 | id, product_id (FK), customer_name, status (ENUM) | notes |
| `test_json_docs` | 8 | id, doc, metadata, tags | doc, metadata, tags |
| `test_articles` | 10 | id, title, body, author (FULLTEXT) | — |
| `test_users` | 10 | id, username, email, phone, bio, role | — |
| `test_measurements` | 200 | id, sensor_id (INT 1-5), temperature, humidity | — |
| `test_locations` | 15 | id, name, city, latitude, longitude, geom (POINT) | — |
| `test_events` | 100 | id, event_type (ENUM), user_id (1-8), event_date | payload |
| `test_documents` | 10 | id, collection_name, doc, \_id (UUID) | doc |
| `test_partitioned` | 26 | id, region, created_at | data |
| `test_categories` | 17 | id, name, path, level | — |

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type | What you see | Verdict |
|---|---|---|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw error string, no `success` field | Bug — report as ❌ |

During error path testing, if an invalid Code Mode call returns a raw error string instead of a JSON object with `success` and `error` fields, report it as ❌.

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-security.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Password Validation Boundaries

1. `mysql_security_password_validate({password: ""})` → verify structured response (empty password)
2. `mysql_security_password_validate({password: "a"})` → verify weak assessment
3. `mysql_security_password_validate({password: "A1!aB2@bC3#cD4$d"})` → verify strong assessment
4. `mysql_security_password_validate({password: "' OR 1=1 --"})` → verify structured response (no SQL injection)
5. `mysql_security_password_validate` with a 256-character password → verify no truncation crash

## Category 2: Sensitive Table Detection

6. Create `stress_sensitive` table with columns: `id INT`, `password VARCHAR(255)`, `ssn VARCHAR(11)`, `credit_card VARCHAR(20)`
7. `mysql_security_sensitive_tables({database: "testdb"})` → verify `stress_sensitive` is flagged
8. Create `stress_safe` table with columns: `id INT`, `name VARCHAR(100)`, `quantity INT`
9. `mysql_security_sensitive_tables({database: "testdb"})` → verify `stress_safe` is NOT flagged

## Category 3: Privilege Enumeration Edge Cases

10. `mysql_security_user_privileges({user: "root"})` → log token estimate (full)
11. `mysql_security_user_privileges({user: "root", summary: true})` → log token estimate (summary)
12. Verify summary is smaller than full output
13. `mysql_security_user_privileges({user: "nonexistent_user_xyz"})` → verify structured `{success: false}` or empty result

## Category 4: Payload Monitoring

14. `mysql_security_audit()` → log token estimate, flag > 500 tokens as 📦
15. `mysql_security_encryption_status()` → log token estimate
16. `mysql_security_ssl_status()` → log token estimate

## Cleanup

17. Drop `stress_sensitive` and `stress_safe` tables
