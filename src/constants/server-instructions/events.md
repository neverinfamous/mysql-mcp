# Events Tools (`mysql_event_*`, `mysql_scheduler_status`)

- **Scheduler status**: `mysql_scheduler_status` shows global scheduler state (ON/OFF), event counts, and recently executed events.
- **Event types**: `mysql_event_create` takes a raw MySQL `schedule` string (e.g. `"EVERY 1 DAY"`, `"AT CURRENT_TIMESTAMP + INTERVAL 1 HOUR"`). Use `ifNotExists: true` to skip creation if the event already exists.
- **Graceful error handling**: `mysql_event_create` returns `{ success: false, error }` when the event already exists (without `ifNotExists`). `mysql_event_alter` and `mysql_event_drop` (without `ifExists`) return `{ success: false, error }` when the event does not exist. `mysql_event_drop` with `ifExists: true` returns `{ success: true, skipped: true, reason: "Event did not exist" }` when the event was already absent.
- **Event status**: `mysql_event_status` returns a structured error `{ success: false, error: ... }` gracefully when the event is not found, instead of throwing an error.
- **Event lifecycle**: Use `status: "DISABLE"` when creating/testing events. `onCompletion: "PRESERVE"` keeps events after expiry.
- **Alter operations**: `mysql_event_alter` can enable/disable, change schedule/body, change `onCompletion` (PRESERVE/NOT PRESERVE), update comment, or rename (via `newName`).
- **Listing events**: `mysql_event_list` accepts `includeDisabled` (default: true) to filter out disabled events.
- **Cross-schema**: Both `mysql_event_list` and `mysql_event_status` accept `schema` parameter to query other databases. Both return a structured error `{ success: false, error: ... }` when the specified schema does not exist.

### Example: Creating a Recurring Event
```json
{
  "name": "daily_cleanup",
  "schedule": "EVERY 1 DAY STARTS '2024-01-01 00:00:00'",
  "body": "DELETE FROM sessions WHERE updated_at < NOW() - INTERVAL 1 DAY;",
  "status": "ENABLE",
  "onCompletion": "PRESERVE",
  "ifNotExists": true
}
```
