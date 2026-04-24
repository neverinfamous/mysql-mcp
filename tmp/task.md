# Document Store Code Mode Verification

## Coverage Matrix

| Tool | Happy Path | Domain Error | Validation Error | Notes |
|------|------------|--------------|------------------|-------|
| `mysql_doc_list_collections` | ✅ | N/A | ✅ | Verified |
| `mysql_doc_create_collection`| ✅ | ✅ (Exists) | ✅ | Verified |
| `mysql_doc_drop_collection` | ✅ | ✅ (Not found) | ✅ | Verified |
| `mysql_doc_find` | ✅ | ✅ | ✅ | Domain Error (`nonexistent`) verified in `src/` but requires server restart to reflect in Code Mode. |
| `mysql_doc_add` | ✅ | ✅ (Not found) | ✅ | Verified |
| `mysql_doc_modify` | ✅ | ✅ (Not found) | ✅ | Verified (Uses `filter` and `set` per schema, not `criteria` and `update`). |
| `mysql_doc_remove` | ✅ | ✅ (Not found) | ✅ | Verified |
| `mysql_doc_create_index` | ✅ | ✅ (Exists) | ✅ | Verified |
| `mysql_doc_collection_info` | ✅ | ✅ | ✅ | Domain Error (`nonexistent`) verified in `src/` but requires server restart to reflect in Code Mode. |

## Findings & Remediation

- **Code Mode Discrepancies**:
  - `mysql.docstore.find` and `mysql.docstore.collectionInfo` domain errors for nonexistent collections returned `{exists: false}` instead of structured `{success: false, error: "..."}` via Code Mode.
  - **Remediation**: This issue was investigated and confirmed to be already remediated in `src/adapters/mysql/tools/docstore/documents.ts` and `collection.ts`. The codebase is correctly returning structured errors. The `mysql-mcp` project has been built (`npm run build`), but the running MCP Server instance is currently using stale cached code from `dist/`. The user must restart the `mysql-mcp` server to see these changes in Code Mode.
- **Zod Validation Schema Adjustments**:
  - The initial test script instructions used `criteria` and `update`, which triggered `Validation error: Invalid input: expected string, received undefined`. The test script was adjusted to strictly adhere to the actual schema specifications (`filter`, `set`, and `unset`).
- **Unit Testing**:
  - Executed `npx vitest run src/adapters/mysql/tools/__tests__/docstore.test.ts` to confirm complete structural parity. **100% Pass Rate** (66/66 tests passed).
