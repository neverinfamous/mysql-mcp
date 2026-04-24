# Document Store Code Mode Verification

## Coverage Matrix

| Tool | Happy Path | Domain Error | Validation Error | Notes |
|------|------------|--------------|------------------|-------|
| `mysql_doc_list_collections` | ✅ | N/A | ✅ | Verified |
| `mysql_doc_create_collection`| ✅ | ✅ (Exists) | ✅ | Verified |
| `mysql_doc_drop_collection` | ✅ | ✅ (Not found) | ✅ | Verified |
| `mysql_doc_find` | ✅ | ✅ | ✅ | Verified |
| `mysql_doc_add` | ✅ | ✅ (Not found) | ✅ | Verified |
| `mysql_doc_modify` | ✅ | ✅ (Not found) | ✅ | Verified (Uses `filter` and `set` per schema, not `criteria` and `update`). |
| `mysql_doc_remove` | ✅ | ✅ (Not found) | ✅ | Verified |
| `mysql_doc_create_index` | ✅ | ✅ (Exists) | ✅ | Verified |
| `mysql_doc_collection_info` | ✅ | ✅ | ✅ | Verified |

## Findings & Remediation

- **Code Mode Discrepancies**:
  - Initially, `mysql.docstore.find` and `mysql.docstore.collectionInfo` domain errors for nonexistent collections returned `{exists: false}` instead of structured `{success: false, error: "..."}` via Code Mode due to the server running a stale cache from an older build.
  - **Remediation**: Upon restarting the `mysql-mcp` server process, the Code Mode execution achieved a 100% pass rate, confirming the codebase correctly returns structured errors.
- **Zod Validation Schema Adjustments**:
  - The initial test script instructions used `criteria` and `update`, which triggered `Validation error: Invalid input: expected string, received undefined`. The test script was adjusted to strictly adhere to the actual schema specifications (`filter`, `set`, and `unset`).
- **Unit Testing**:
  - Executed `npx vitest run src/adapters/mysql/tools/__tests__/docstore.test.ts` to confirm complete structural parity. **100% Pass Rate** (66/66 tests passed).
