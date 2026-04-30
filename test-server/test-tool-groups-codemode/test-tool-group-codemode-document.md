# mysql-mcp Code Mode Re-Testing: [document]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

---

## Group Focus: document

document Tool Group (9 tools +1 code mode):

1. `mysql_doc_list_collections` 2. `mysql_doc_create_collection` 3. `mysql_doc_drop_collection`
2. `mysql_doc_find` 5. `mysql_doc_add` 6. `mysql_doc_modify`
3. `mysql_doc_remove` 8. `mysql_doc_create_index` 9. `mysql_doc_collection_info`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.document.help()` → verify method listing
2. `mysql.document.listCollections()` → verify `test_documents` present
3. `mysql.document.find({collection: "test_documents", limit: 3})` → 3 documents
4. `mysql.document.collectionInfo({collection: "test_documents"})` → count of 10

**Create → Use → Drop lifecycle:**

5. `mysql.document.createCollection({name: "temp_cm_docs"})` → `success: true`
6. `mysql.document.add({collection: "temp_cm_docs", documents: [{name: "Alice"}, {name: "Bob"}]})` → 2 added
7. `mysql.document.find({collection: "temp_cm_docs"})` → 2 documents
8. `mysql.document.modify({collection: "temp_cm_docs", criteria: {name: "Alice"}, update: {age: 30}})` → modified
9. `mysql.document.remove({collection: "temp_cm_docs", criteria: {name: "Bob"}})` → removed
10. `mysql.document.dropCollection({name: "temp_cm_docs"})` → `success: true`

**Domain error paths (🔴):**

11. 🔴 `mysql.document.find({collection: "nonexistent_xyz"})` → `{success: false}`
12. 🔴 `mysql.document.collectionInfo({collection: "nonexistent_xyz"})` → `{success: false}`

**Zod validation error paths (🔴):**

13. 🔴 `mysql.document.add({})` → `{success: false, error: "Validation error: ..."}`
14. 🔴 `mysql.document.createCollection({})` → `{success: false, error: "Validation error: ..."}`
