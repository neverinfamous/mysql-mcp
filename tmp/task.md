# JSON Tool Group Verification Matrix

All tests passed locally via `mysql_execute_code`.

## Core Tools (Coverage)

| Tool | Happy Path | Domain Error (Non-existent Table/Col) | Zod Validation |
| :--- | :--- | :--- | :--- |
| `mysql_json_extract` | ✅ Passed | ✅ Passed (`{success: false, error: ...}`) | ✅ Passed |
| `mysql_json_set` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_insert` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_replace`| ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_remove` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_contains`| ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_keys` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_array_append` | ✅ Passed | ✅ Passed | ✅ Passed |

## Helper & Enhanced Tools (Coverage)

| Tool | Happy Path | Domain Error (Non-existent Table/Col) | Zod Validation |
| :--- | :--- | :--- | :--- |
| `mysql_json_get` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_update` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_search` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_validate` | ✅ Passed | ✅ Passed (Invalid JSON string) | ✅ Passed |
| `mysql_json_merge` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_diff` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_normalize`| ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_stats` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_json_index_suggest` | ✅ Passed | ✅ Passed | ✅ Passed |

## Remediation Applied

1. Standardized all 17 tools to use `formatHandlerErrorResponse` rather than throwing ad-hoc raw errors.
2. Standardized domain checks (P154) to return `{success: false, error: "Table or column does not exist"}` instead of `{exists: false, table: "..."}`.
3. Updated unit tests (`core.test.ts`, `helpers.test.ts`, `enhanced.test.ts`) to align with these `{success: false}` schemas, bringing coverage metrics up to par and tests to a clean build.
4. Code Mode Proxy validated for Zod constraints which properly surfaced as standard proxy boundary exceptions.
