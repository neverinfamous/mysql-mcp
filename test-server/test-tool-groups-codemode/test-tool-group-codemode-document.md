# mysql-mcp Code Mode Re-Testing: [document]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Test Data: `test_documents` (10 rows, collection_name, doc JSON, _id UUID)

## Requirements

1. 
2. 

---

## Group Focus: document

document Tool Group (9 tools +1 code mode):

1. `mysql_doc_list_collections` 2. `mysql_doc_create_collection` 3. `mysql_doc_drop_collection`
4. `mysql_doc_find` 5. `mysql_doc_add` 6. `mysql_doc_modify`
7. `mysql_doc_remove` 8. `mysql_doc_create_index` 9. `mysql_doc_collection_info`

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
