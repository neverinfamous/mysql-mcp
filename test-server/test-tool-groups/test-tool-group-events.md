# mysql-mcp Tool Group Testing: [events]

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

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: events

### events Group-Specific Testing

events Tool Group (6 tools +1 for code mode):

1. 'mysql_event_create'
2. 'mysql_event_alter'
3. 'mysql_event_drop'
4. 'mysql_event_list'
5. 'mysql_event_status'
6. 'mysql_scheduler_status'
7. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_scheduler_status()` → verify scheduler ON/OFF status
2. `mysql_event_list()` → verify event listing structure

**Create → Use → Drop lifecycle:**

3. `mysql_event_create({name: "temp_test_event", schedule: "EVERY 1 DAY", body: "SELECT 1", status: "DISABLE"})` → `{success: true}`
4. `mysql_event_status({name: "temp_test_event"})` → verify event status
5. `mysql_event_alter({name: "temp_test_event", status: "DISABLE"})` → `{success: true}`
6. `mysql_event_drop({name: "temp_test_event"})` → `{success: true}`

**Domain error paths (🔴):**

7. 🔴 `mysql_event_status({name: "nonexistent_event_xyz"})` → `{success: false, error: "..."}` handler error
8. 🔴 `mysql_event_drop({name: "nonexistent_event_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

9. 🔴 `mysql_event_create({})` → `{success: false, error: "..."}` (Zod validation)
10. 🔴 `mysql_event_alter({})` → `{success: false, error: "..."}` (missing required params)
