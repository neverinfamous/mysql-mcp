# mysql-mcp Code Mode Testing: [docstore]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.

## Setup & Pre-requisites

**Step 1:** Confirm you read the server help content sourced from `C:\Users\chris\Desktop\mysql-mcp\src\constants\server-instructions\gotchas.md` using `view_file` (not grep or search) — to understand documented behaviors, edge cases, and response structures for this tool group.

**Step 2:** Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`). Ensure your validation script returns an aggregated array of failures if any exist. Group multiple tests into a single script to save context window tokens.

**Step 3:** The agent should update `C:\Users\chris\Desktop\mysql-mcp\UNRELEASED.md`, update `C:\Users\chris\Desktop\mysql-mcp\test-server\code-map.md` if appropriate, and create a `memory-journal-mcp` entry summarizing the changes/fixes.

> [!WARNING]
> **Stale Build Issues:** The MCP server runs from the compiled `dist/` directory, NOT `src/`. If you encounter inexplicable behavior (e.g., tools executing old logic or throwing validation errors for things already fixed in the source code), the server might be running a stale build. Check if the compiled code in `dist/` matches the source code in `src/`. If out of sync, stop and instruct the user to run `npm run build` and restart the server before continuing testing.

> **Note**: If temp tables are present from a previous test pass, it's because the database is locked. Ignore them. Use existing `test_*` tables for read operations.


> **Note**: The default test database is `testdb`. If you need to specify a database explicitly in your API calls, use `testdb`.

### Test Schema Reference

| Table               | Rows | Key Columns                                       | JSON Columns        |
| ------------------- | ---- | ------------------------------------------------- | ------------------- |
| `test_products`     | 16   | id, name, price, category                         | metadata            |
| `test_orders`       | 20   | id, product_id (FK), customer_name, status (ENUM) | notes               |
| `test_json_docs`    | 8    | id, doc, metadata, tags                           | doc, metadata, tags |
| `test_articles`     | 10   | id, title, body, author (FULLTEXT)                | —                   |
| `test_users`        | 10   | id, username, email, phone, bio, role             | —                   |
| `test_measurements` | 200  | id, sensor_id (INT 1-5), temperature, humidity    | —                   |
| `test_locations`    | 15   | id, name, city, latitude, longitude, geom (POINT) | —                   |
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date  | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)             | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                            | data                |
| `test_categories`   | 17   | id, name, path, level                             | —                   |

## Reporting Format

- ❌ **Fail**: Tool errors or produces incorrect results (include error message)
- ⚠️ **Issue**: Unexpected behavior or improvement opportunity
- 📦 **Payload**: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. Report the response size in KB/tokens and suggest a concrete optimization.
- ✅ **Confirmed**: (Use inline only during testing; omit from Final Summary)

### Error Message Quality Rating

| Level                                  | Verdict |
| -------------------------------------- | ------- |
| 5 - Excellent (name + code + context)  | ✅      |
| 4 - Good (name)                        | ✅      |
| 3 - Adequate (raw MySQL, informative)  | ⚠️      |
| 2 - Poor (no object name)              | ⚠️      |
| 1 - Useless (generic)                  | ❌      |

## Testing Requirements & Error Standards

> [!NOTE]
> **Tool Availability & Code Mode**: The `mysql_execute_code` tool is globally injected and always available across all test groups for multi-step test logic or setup. However, if a test step requires a setup tool from a _different_ group (e.g., `mysql_write_query`) that is missing from the active MCP registry due to injection scoping, do not fail the group. Use `mysql_execute_code`, existing seed data, or backups if possible, note the missing tool as an expected ⚠️ finding, and proceed with testing.

> [!IMPORTANT]
> **Testing Code Mode**: Do NOT write test scripts to the filesystem. Pass your JavaScript snippets directly to the `mysql_execute_code` tool's `code` parameter. Do NOT wrap your tests in monolithic `try/catch` blocks that suppress or transform the server's natural error output. You must allow the server to return its native structured error responses so you can evaluate them against the standards below.

> [!CAUTION]
> **Zero tolerance for raw MCP errors.** ANY response that is a raw MCP error (e.g., `-32602`, or a raw text string wrapped in `isError: true` with no `success` field) is a **bug that must be reported and fixed** — never an acceptable design choice, SDK limitation, or expected behavior. If you see one, report it as ❌ immediately. Do not rationalize it as "the SDK rejecting at the boundary" or "by design for range-constrained params." The handler MUST catch it.
>
> ⚠️ **ARCHITECTURAL NOTE — `isError: true` rules for tools with `outputSchema`**: The MCP SDK uses `isError` to decide whether to validate `structuredContent` against the `outputSchema`. Getting this wrong causes either raw `-32602` crashes or valid responses wrapped in error frames. **This is now handled automatically by the server framework in `tools.ts`**, but as a tester, you must verify the SDK output matches this rule:
>
> | Response         | `isError: true` | SDK behavior                                              | Verdict                                |
> | ---------------- | --------------- | --------------------------------------------------------- | -------------------------------------- |
> | `success: true`  | **Absent**      | Validates `structuredContent` → passes                    | ✅ Correct                             |
> | `success: true`  | **Present**     | Skips validation, wraps in error frame                    | ❌ Bug — valid response shown as error |
> | `success: false` | **Present**     | Skips validation (error shape won't match success schema) | ✅ Correct                             |
> | `success: false` | **Absent**      | Validates error against success schema → fails            | ❌ Bug — raw `-32602`                  |
>
> **TL;DR**: `isError: true` on errors, absent on successes. The framework handles this automatically when your handler returns `success: false`.

1. **Test Realism**: Test each tool with realistic inputs based on the schema above.
2. **Error Path Testing**: For **every** tool, test at least **two** invalid inputs:
   - (a) A domain error (e.g., non-existent table).
   - (b) An **empty parameters test** (call the tool with `{}`).
     Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
     > **Note on Aliases & Zod**: Tools that support legacy parameter aliases (e.g. `tableName` instead of `table`) often use `.default("")` in their Zod schema so the SDK validation lets the payload reach the handler's alias-resolution logic. For these tools, calling with `{}` will pass Zod validation and correctly trigger a handler-level domain error (e.g. `TABLE_NOT_FOUND`) instead of a strict Zod `invalid_type` error. **This is expected behavior.** Do NOT remove `.default("")` from schemas to force a Zod error, as this will break alias compatibility.
3. **Output Schema Testing**: For **every** tool that has an `outputSchema`, confirm that at least one valid happy-path call returns a structured JSON response — NOT a raw MCP `-32602` "output schema" error. Output schema mismatches produce the same `-32602` code as input errors but are only caught with valid inputs.
4. **Wrong-Type Coercion**: For every tool with optional numeric parameters (e.g., `limit`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error.
   > **Note on Zod Coercion & Validation Errors**: When passing `"abc"` to a numeric field, receiving a structured handler error like `{ success: false, error: "limit: Expected number, received string", code: "VALIDATION_ERROR" }` is **correct**. This proves the global SDK monkey-patch successfully intercepted Zod's `invalid_type` error and transformed it into a structured domain error. Do NOT attempt to "fix" `coerceNumber` or schema definitions to bypass this Zod validation or force a silent fallback to `undefined`.
5. **Proactive Improvements**: You are highly encouraged to proactively improve functionality, performance, security, agent experience, and token/payload efficiency whenever you see an opportunity during your testing and handler code review.
   > **CRITICAL**: Architectural consistency is paramount. Do not introduce undocumented architectural deviations. If you implement a structural or architectural improvement in one tool, you must apply it symmetrically to other applicable tools in the group or project.
6. **Code Over Docs**: Fix the handler code if standards (Structured Errors/Zod) are violated. Do NOT change docs/prompts to accommodate broken code.
7. **Token Tracking**: Monitor `metrics.tokenEstimate` or `_meta.tokenEstimate` to detect payload issues.
8. **Coverage Matrix**: Maintain a coverage matrix: 
| Tool | Code Mode (Happy Path) | Code Mode (Domain Error/Zod Error) |

### Structured Error Response Pattern

All tools should return errors as strongly-typed structured objects instead of throwing. The expected pattern:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "VALIDATION_ERROR",
  "category": "validation",
  "recoverable": false,
  "details": { }
}
```

| Type                 | Source                                                                          | What you see                                                                                                              | Verdict            |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "...", code: "..."}` | Parseable JSON object with `success`, `error`, `code` (e.g., `VALIDATION_ERROR`, `CONFLICT_ERROR`), and `category` fields | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                                      | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field     | Bug — report as ❌ |

## Split Schema Pattern Verification

All tools use the Split Schema pattern: a plain `z.object()` Base schema for MCP parameter visibility, and a `z.preprocess()` wrapper for handler parsing. Verify:

1. **Parameter visibility**: For tools with optional parameters (e.g., `database`, `limit`), make a direct MCP call using those parameters. If the tool ignores or rejects documented parameters, report as a Split Schema violation.
2. **Alias acceptance**: For tools with documented parameter aliases (e.g., `table`/`tableName`/`name`, `query`/`sql`, `where`/`filter`), verify that direct MCP tool calls correctly accept the aliases — not just the primary parameter name.
3. **`z.preprocess()` as `inputSchema`**: If a tool uses `z.preprocess()` directly as its `inputSchema` (instead of a plain `SchemaBase`), parameter metadata is stripped from JSON Schema generation. Report as a Split Schema violation.

## P154 Object Existence Verification

All tools that accept a table name should return structured error responses for nonexistent tables and databases. For each, verify:

1. **Nonexistent table**: Calling with `table: "nonexistent_table_xyz"` returns a structured error — not a raw MySQL exception
2. **Nonexistent database/schema**: Where applicable, calling with a nonexistent database produces a similarly clear structured error

Key MySQL error codes that should be intercepted by handlers (not leaked as raw errors):

| MySQL Error Code          | Meaning                | Expected Structured Message   |
| ------------------------- | ---------------------- | ----------------------------- |
| 1146 (ER_NO_SUCH_TABLE)   | Table doesn't exist    | `Table 'X' does not exist`    |
| 1049 (ER_BAD_DB_ERROR)    | Database doesn't exist | `Database 'X' does not exist` |
| 1054 (ER_BAD_FIELD_ERROR) | Unknown column         | `Column 'X' not found`        |
| 1064 (ER_PARSE_ERROR)     | SQL syntax error       | `SQL syntax error: ...`       |

## Error Consistency Audit

During testing, check for these inconsistencies:

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌.
2. **Error field name**: All `{ success: false }` error responses should use `error` as the field name.
3. **Zod validation leaks**: If calling a tool with an invalid enum value or missing required field produces a raw MCP `-32602` Zod validation error instead of a structured response, report as ❌.

## Naming & Cleanup

- **Temporary tables**: `temp_*` (or `stress_*`) prefix
- **Temporary views**: `test_view_*` prefix
- **Temporary procedures**: `test_proc_*` prefix
- Drop at the end of the script. If DROP fails due to lock, note and move on.


---

## Group Focus: docstore

docstore Tool Group (9 tools +1 code mode):

1. `mysql_doc_list_collections` 2. `mysql_doc_create_collection` 3. `mysql_doc_drop_collection`
2. `mysql_doc_find` 5. `mysql_doc_add` 6. `mysql_doc_modify`
3. `mysql_doc_remove` 8. `mysql_doc_create_index` 9. `mysql_doc_collection_info`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.docstore.help()` → verify method listing
2. `mysql.docstore.listCollections()` → verify `test_documents` present
3. `mysql.docstore.find({collection: "test_documents", limit: 3})` → 3 documents
4. `mysql.docstore.collectionInfo({collection: "test_documents"})` → count of 10

**Create → Use → Drop lifecycle:**

5. `mysql.docstore.createCollection({name: "temp_cm_docs"})` → `success: true`
6. `mysql.docstore.add({collection: "temp_cm_docs", documents: [{name: "Alice"}, {name: "Bob"}]})` → 2 added
7. `mysql.docstore.find({collection: "temp_cm_docs"})` → 2 documents
8. `mysql.docstore.modify({collection: "temp_cm_docs", criteria: {name: "Alice"}, update: {age: 30}})` → modified
9. `mysql.docstore.createIndex({collection: "temp_cm_docs", name: "idx_age", fields: [{field: "age", type: "INTEGER"}]})` → `success: true`
10. `mysql.docstore.remove({collection: "temp_cm_docs", criteria: {name: "Bob"}})` → removed
11. `mysql.docstore.dropCollection({name: "temp_cm_docs"})` → `success: true`

**Domain error paths (🔴):**

12. 🔴 `mysql.docstore.find({collection: "nonexistent_xyz"})` → `{success: false}`
13. 🔴 `mysql.docstore.collectionInfo({collection: "nonexistent_xyz"})` → `{success: false}`

**Zod validation error paths (🔴):**

13. 🔴 `mysql.docstore.add({})` → `{success: false, error: "Validation error: ..."}`
14. 🔴 `mysql.docstore.createCollection({})` → `{success: false, error: "Validation error: ..."}`

---

## Post-Test Procedures

### Reporting Rules

- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in help resources and runtime hints

### After Testing

1. **Token Audit**: Use `read_resource` on `mysql://audit` to retrieve total token usage. Include in your final report.
2. **Triage findings**: If issues were found, create an implementation plan, making sure they are consistent with working patterns in other tools/tool groups. If the plan requires no user decisions, proceed directly to implementation.
3. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `src/constants/server-instructions/*.md` (per-group help files) — run `npm run generate:instructions` after editing to regenerate `server-instructions.ts`
   - Test database (`scripts/test-seed.sql`)
   - This prompt

### After Implementation

4. **Document**: Update `UNRELEASED.md`, `code-map.md` (if appropriate), and create a `memory-journal-mcp` entry detailing the changes and improvements made.
5. **Commit**: Stage and commit all changes — do NOT push.
6. **Validate**: Halt your work and instruct the user to validate the changes by running the test suite (Vitest/Playwright), lint, and typecheck. Do NOT run them yourself. Also instruct the user to rebuild and restart the server.
7. **Live re-test**: Once the user confirms the server is restarted, test the fixes with direct MCP tool calls to confirm they are working.
8. **Final summary**: If no issues found, provide the final summary. If issues were fixed, provide the summary after live MCP re-testing confirms fixes are working.
