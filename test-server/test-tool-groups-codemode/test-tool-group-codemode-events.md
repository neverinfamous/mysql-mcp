# mysql-mcp Code Mode Re-Testing: [events]

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

## Group Focus: events

events Tool Group (6 tools +1 code mode):

1. `mysql_event_create` 2. `mysql_event_alter` 3. `mysql_event_drop`
2. `mysql_event_list` 5. `mysql_event_status` 6. `mysql_scheduler_status`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.events.help()` → verify method listing
2. `mysql.events.schedulerStatus()` → ON/OFF
3. `mysql.events.list()` → event listing

**Create → Use → Drop lifecycle:**

4. `mysql.events.create({name: "temp_cm_event", schedule: "EVERY 1 DAY", body: "SELECT 1", status: "DISABLE"})` → `success: true`
5. `mysql.events.status({name: "temp_cm_event"})` → event status
6. `mysql.events.alter({name: "temp_cm_event", status: "DISABLE"})` → `success: true`
7. `mysql.events.drop({name: "temp_cm_event"})` → `success: true`

**Domain error paths (🔴):**

8. 🔴 `mysql.events.status({name: "nonexistent_xyz"})` → `{success: false}`
9. 🔴 `mysql.events.drop({name: "nonexistent_xyz"})` → `{success: false}`

**Zod validation error paths (🔴):**

10. 🔴 `mysql.events.create({})` → `{success: false, error: "Validation error: ..."}`
