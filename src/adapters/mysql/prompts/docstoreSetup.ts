/**
 * MySQL Prompt - Document Store Setup
 *
 * Complete Document Store / X DevAPI setup guide.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupDocstorePrompt(): PromptDefinition {
  return {
    name: "mysql_setup_docstore",
    description: "Complete MySQL Document Store and X DevAPI setup guide",
    arguments: [],
    handler: (_args: Record<string, string>, _context: RequestContext) => {
      return Promise.resolve(`# MySQL Document Store Setup Guide

MySQL Document Store allows you to store and query JSON documents using collections, similar to NoSQL databases.

## Prerequisites

1. **MySQL 8.0+** (full Document Store support)
2. **X Plugin enabled** (default in 8.0)
3. **MySQL Shell** for X DevAPI access
4. **Port 33060** open (X Protocol)

## Step 1: Verify X Plugin

\`\`\`sql
SHOW PLUGINS WHERE Name = 'mysqlx';
-- Should show: mysqlx | ACTIVE
\`\`\`

If not enabled:
\`\`\`sql
INSTALL PLUGIN mysqlx SONAME 'mysqlx.so';
\`\`\`

## Step 2: Create a Collection (MySQL Shell)

\`\`\`javascript
// Connect using X Protocol
\\connect mysqlx://user@localhost:33060/mydb

// Create collection
db.createCollection('users')

// Add documents
db.users.add({
    "_id": "user001",
    "name": "John Doe",
    "email": "john@example.com",
    "tags": ["admin", "active"]
})
\`\`\`

## Step 3: Query Documents

\`\`\`javascript
// Find all
db.users.find()

// Find with filter
db.users.find("name = 'John Doe'")

// Find with JSON path
db.users.find("'admin' IN tags")
\`\`\`

## SQL Access to Collections

Collections are regular tables with a JSON column:
\`\`\`sql
-- View collection data
SELECT * FROM mydb.users;

-- Query with JSON functions
SELECT doc->>'$.name' AS name
FROM mydb.users
WHERE JSON_CONTAINS(doc->'$.tags', '"admin"');
\`\`\`

## Available MCP Tools

| Tool | Description |
|------|-------------|
| \`mysql_doc_list_collections\` | List collections |
| \`mysql_doc_create_collection\` | Create collection |
| \`mysql_doc_drop_collection\` | Drop collection |
| \`mysql_doc_find\` | Query documents |
| \`mysql_doc_add\` | Add documents |
| \`mysql_doc_modify\` | Update documents |
| \`mysql_doc_remove\` | Delete documents |
| \`mysql_doc_create_index\` | Create index |
| \`mysql_doc_collection_info\` | Collection stats |

## Creating Indexes

\`\`\`javascript
// Index on document field
db.users.createIndex("email_idx", {
    fields: [{
        field: "$.email",
        type: "TEXT(100)"
    }]
})
\`\`\`

## Best Practices

1. **Use _id field** for document identification
2. **Create indexes** on frequently queried fields
3. **Use JSON schema validation** for data integrity
4. **Consider hybrid approach** - mix relational and document data

## Common Issues

1. **Port 33060 blocked**: Open firewall for X Protocol
2. **Connection refused**: Verify mysqlx plugin is running
3. **Schema not found**: Create database first

Start by listing collections with \`mysql_doc_list_collections\`.`);
    },
  };
}
