# Document Store (`mysql_doc_*`)

- **Collection creation**: `mysql_doc_create_collection` creates a JSON document collection. Use `ifNotExists: true` to avoid errors when the collection already exists. Returns `{ success: false, error }` if collection already exists (without `ifNotExists`). Accepts optional `schema` parameter to create in a specific database.
- **Collection drop**: `mysql_doc_drop_collection` removes a collection. Returns `{ success: false, error }` if collection does not exist (without `ifExists`). With `ifExists: true` (default), returns `{ success: true, message: "Collection did not exist" }` when the collection was already absent. Accepts optional `schema` parameter to target a specific database.
- **Collection detection**: Tools identify document collections as tables containing a `doc JSON` column with an `_id` field. Manually created JSON tables may appear in collection listings.
- **Nonexistent collection handling**: `mysql_doc_collection_info`, `mysql_doc_add`, `mysql_doc_find`, `mysql_doc_modify`, `mysql_doc_remove`, and `mysql_doc_create_index` return `{ exists: false, collection }` when the target collection does not exist, and `{ exists: false, schema }` when a nonexistent schema is explicitly provided. All six tools accept an optional `schema` parameter for cross-database collection access.
- **Index creation**: `mysql_doc_create_index` returns `{ success: false, error }` if the index or its generated columns already exist. Accepts optional `schema` parameter.
- **Filter Syntax** (for `mysql_doc_modify`, `mysql_doc_remove`):
  - **By _id**: Pass the 32-character hex _id directly: `filter: "686dd247b9724bcfa08ce6f1efed8b77"`
  - **By field value**: Use `field=value` format: `filter: "name=Alice"` or `filter: "age=30"`
  - **By existence**: Use JSON path: `filter: "$.address"` (matches docs where address field exists)
  - ❌ Incorrect: `filter: "$.name == 'Alice'"` (comparison operators not supported in path)
  - ✅ Correct: `filter: "name=Alice"` (field=value format)
- **Schema existence**: All docstore tools that accept a `schema` parameter return `{ exists: false, schema }` when a nonexistent schema is explicitly provided, matching the P154 pattern used by schema introspection and event tools.
- **Find Filters** (`mysql_doc_find`): The filter parameter checks for field existence using JSON path only (e.g., `$.address.zip`). The path must be a valid JSON path (`$`, `$.field`, `$.field.sub`, `$.field[0]`); invalid paths return `{ success: false, error }`. Does NOT support `_id` or `field=value` formats. Accepts optional `schema` parameter. Returns `{ exists: false, collection, documents: [], count: 0 }` gracefully if the collection does not exist.
