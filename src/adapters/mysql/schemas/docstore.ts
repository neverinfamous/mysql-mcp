import { z } from "zod";
import { preprocessDocFilterParams, preprocessDocIndexParams, preprocessDocCollectionParams } from "./preprocess-utils.js";

export const ListCollectionsSchemaBase = z.object({
  schema: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Schema name (defaults to current)"),
  database: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for schema"),
});
export const ListCollectionsSchemaStrict = z.object({
  schema: z.string().optional().describe("Schema name (defaults to current)"),
});
export const ListCollectionsSchema = z.preprocess(
  preprocessDocCollectionParams,
  ListCollectionsSchemaStrict
);

export const CreateCollectionSchemaBase = z.object({
  name: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Collection name"),
  collection: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  collectionName: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  table: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  tableName: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  tbl: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  schema: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional(),
  database: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for schema"),
  ifNotExists: z.union([z.boolean(), z.string()]).optional().describe("Add IF NOT EXISTS clause"),
  validation: z
    .object({
      schema: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("JSON schema"),
      level: z
        .enum(["OFF", "STRICT", "MODERATE"])
        .optional()
        .describe("Validation level"),
    })
    .optional()
    .describe("Validation config"),
});

export const CreateCollectionSchemaStrict = z.object({
  name: z.string().max(64).describe("Collection name. Hint: Use 'name' instead of 'tableName' or 'collectionName'."),
  schema: z.string().optional(),
  ifNotExists: z.boolean().default(false).describe("Add IF NOT EXISTS clause"),
  validation: z
    .object({
      schema: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("JSON schema"),
      level: z
        .enum(["OFF", "STRICT", "MODERATE"])
        .optional()
        .describe("Validation level"),
    })
    .optional()
    .describe("Validation config"),
  collection: z.unknown().optional(),
}).strict();

export const CreateCollectionSchema = z.preprocess(
  preprocessDocCollectionParams,
  CreateCollectionSchemaStrict
);

export const DropCollectionSchemaBase = z.object({
  name: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional(),
  collection: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  collectionName: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  table: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  tableName: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  tbl: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for name"),
  schema: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional(),
  database: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for schema"),
  ifExists: z.union([z.boolean(), z.string()]).optional(),
});

export const DropCollectionSchemaStrict = z.object({
  name: z.string(),
  collection: z.unknown().optional(),
  schema: z.string().optional(),
  ifExists: z.boolean().default(true),
}).strict();

export const DropCollectionSchema = z.preprocess(
  preprocessDocCollectionParams,
  DropCollectionSchemaStrict
);

export const FindSchemaBase = z.object({
  collection: z.unknown().optional(),
  collectionName: z.unknown().optional().describe("Alias for collection"),
  name: z.unknown().optional().describe("Alias for collection"),
  table: z.unknown().optional().describe("Alias for collection"),
  tableName: z.unknown().optional().describe("Alias for collection"),
  tbl: z.unknown().optional().describe("Alias for collection"),
  schema: z.unknown().optional(),
  database: z.unknown().optional().describe("Alias for schema"),
  filter: z
    .unknown()
    .optional()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
  documentId: z.unknown().optional().describe("Alias for filter"),
  criteria: z.unknown().optional().describe("Alias for filter"),
  condition: z.unknown().optional().describe("Alias for filter"),
  query: z.unknown().optional().describe("Alias for filter"),
  sql: z.unknown().optional().describe("Alias for filter"),
  where: z.unknown().optional().describe("Alias for filter"),
  search: z.unknown().optional().describe("Alias for filter"),
  fields: z.unknown().optional(),
  limit: z.unknown().optional(),
  offset: z.unknown().optional(),
});

export const FindSchemaStrict = z.object({
  collection: z.string().describe("Collection name. Hint: Use 'collection' instead of 'table' or 'tableName'."),
  name: z.unknown().optional(),
  schema: z.string().optional(),
  filter: z
    .string()
    .optional()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document. Hint: Use 'filter' instead of 'query' or 'sql'.",
    ),
  fields: z.array(z.string()).optional(),
  limit: z.number().int().nonnegative().default(100),
  offset: z.number().int().nonnegative().default(0),
}).strict();

export const FindSchema = z.preprocess(
  preprocessDocFilterParams,
  FindSchemaStrict,
);

export const AddDocSchemaBase = z.object({
  collection: z.unknown().optional(),
  collectionName: z.unknown().optional().describe("Alias for collection"),
  name: z.unknown().optional().describe("Alias for collection"),
  table: z.unknown().optional().describe("Alias for collection"),
  tableName: z.unknown().optional().describe("Alias for collection"),
  tbl: z.unknown().optional().describe("Alias for collection"),
  schema: z.unknown().optional(),
  database: z.unknown().optional().describe("Alias for schema"),
  document: z.unknown().optional().describe("Alias for documents"),
  data: z.unknown().optional().describe("Alias for documents"),
  items: z.unknown().optional().describe("Alias for documents"),
  documents: z
    .unknown()
    .optional()
    .describe("Documents to add"),
});

export const AddDocSchemaStrict = z.object({
  collection: z.string().describe("Collection name. Hint: Use 'collection' instead of 'table' or 'tableName'."),
  schema: z.string().optional(),
  documents: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .describe("Documents to add. Hint: Use 'documents' instead of 'document'."),
  name: z.unknown().optional(),
}).strict();

export const AddDocSchema = z.preprocess(
  preprocessDocCollectionParams,
  AddDocSchemaStrict
);

export const ModifyDocSchemaBase = z.object({
  collection: z.unknown().optional(),
  collectionName: z.unknown().optional().describe("Alias for collection"),
  name: z.unknown().optional().describe("Alias for collection"),
  table: z.unknown().optional().describe("Alias for collection"),
  tableName: z.unknown().optional().describe("Alias for collection"),
  tbl: z.unknown().optional().describe("Alias for collection"),
  schema: z.unknown().optional(),
  database: z.unknown().optional().describe("Alias for schema"),
  documentId: z.unknown().optional().describe("Alias for filter"),
  filter: z
    .unknown()
    .optional()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
  criteria: z.unknown().optional().describe("Alias for filter"),
  condition: z.unknown().optional().describe("Alias for filter"),
  query: z.unknown().optional().describe("Alias for filter"),
  sql: z.unknown().optional().describe("Alias for filter"),
  where: z.unknown().optional().describe("Alias for filter"),
  search: z.unknown().optional().describe("Alias for filter"),
  set: z.unknown().optional().describe("Fields to set"),
  patch: z.unknown().optional().describe("Alias for set"),
  update: z.unknown().optional().describe("Alias for set"),
  unset: z.unknown().optional(),
  arrayAppend: z.unknown().optional().describe("Values to append to array fields"),
});

export const ModifyDocSchemaStrict = z.object({
  collection: z.string().describe("Collection name. Hint: Use 'collection' instead of 'table' or 'tableName'."),
  schema: z.string().optional(),
  filter: z
    .string()
    .min(1)
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document. Hint: Use 'filter' instead of 'query' or 'sql'.",
    ),
  set: z.record(z.string(), z.unknown()).optional().describe("Fields to set. Hint: Use 'set' instead of 'patch' or 'update'."),
  unset: z.array(z.string()).optional(),
  arrayAppend: z.record(z.string(), z.unknown()).optional().describe("Values to append to array fields."),
  name: z.unknown().optional(),
}).strict();

export const ModifyDocSchema = z.preprocess(
  preprocessDocFilterParams,
  ModifyDocSchemaStrict,
);

export const RemoveDocSchemaBase = z.object({
  collection: z.unknown().optional(),
  collectionName: z.unknown().optional().describe("Alias for collection"),
  name: z.unknown().optional().describe("Alias for collection"),
  table: z.unknown().optional().describe("Alias for collection"),
  tableName: z.unknown().optional().describe("Alias for collection"),
  tbl: z.unknown().optional().describe("Alias for collection"),
  schema: z.unknown().optional(),
  database: z.unknown().optional().describe("Alias for schema"),
  documentId: z.unknown().optional().describe("Alias for filter"),
  filter: z
    .unknown()
    .optional()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
  criteria: z.unknown().optional().describe("Alias for filter"),
  condition: z.unknown().optional().describe("Alias for filter"),
  query: z.unknown().optional().describe("Alias for filter"),
  sql: z.unknown().optional().describe("Alias for filter"),
  where: z.unknown().optional().describe("Alias for filter"),
  search: z.unknown().optional().describe("Alias for filter"),
});

export const RemoveDocSchemaStrict = z.object({
  collection: z.string().describe("Collection name. Hint: Use 'collection' instead of 'table' or 'tableName'."),
  schema: z.string().optional(),
  filter: z
    .string()
    .min(1)
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document. Hint: Use 'filter' instead of 'query' or 'sql'.",
    ),
  name: z.unknown().optional(),
}).strict();

export const RemoveDocSchema = z.preprocess(
  preprocessDocFilterParams,
  RemoveDocSchemaStrict,
);

export const CreateDocIndexSchemaBase = z.object({
  collection: z.unknown().optional(),
  collectionName: z.unknown().optional().describe("Alias for collection"),
  table: z.unknown().optional().describe("Alias for collection"),
  tableName: z.unknown().optional().describe("Alias for collection"),
  tbl: z.unknown().optional().describe("Alias for collection"),
  schema: z.unknown().optional(),
  database: z.unknown().optional().describe("Alias for schema"),
  name: z.unknown().optional(),
  indexName: z.unknown().optional().describe("Alias for name"),
  index: z.unknown().optional().describe("Alias for name"),
  fields: z
    .union([
      z.string(),
      z.array(z.string()),
      z.object({
        path: z.string().optional(),
        field: z.string().optional(),
        type: z.string().optional(),
        required: z.boolean().optional(),
      }),
      z.array(
        z.object({
          path: z.string().optional(),
          field: z.string().optional(),
          type: z.string().optional(),
          required: z.boolean().optional(),
        }),
      )
    ])
    .optional()
    .describe("Array of field config objects, array of string paths, or a single string path"),
  unique: z.boolean().optional(),
});

export const CreateDocIndexSchemaStrict = z.object({
  collection: z.string().describe("Collection name. Hint: Use 'collection' instead of 'table' or 'tableName'."),
  schema: z.string().optional(),
  name: z.string().describe("Index name. Hint: Use 'name' instead of 'indexName' or 'index'."),
  fields: z.array(
    z.object({
      path: z.string().min(1),
      type: z.string().default("TEXT"),
      required: z.boolean().default(false),
    }),
  ).min(1),
  unique: z.boolean().default(false),
}).strict();

export const CreateDocIndexSchema = z.preprocess(
  preprocessDocIndexParams,
  CreateDocIndexSchemaStrict,
);

export const CollectionInfoSchemaBase = z.object({
  collection: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional(),
  collectionName: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for collection"),
  name: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for collection"),
  table: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for collection"),
  tableName: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for collection"),
  tbl: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for collection"),
  schema: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional(),
  database: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]).optional().describe("Alias for schema"),
});

export const CollectionInfoSchemaStrict = z.object({
  collection: z.string().describe("Collection name. Hint: Use 'collection' instead of 'table' or 'tableName'."),
  schema: z.string().optional(),
  name: z.unknown().optional(),
}).strict();

export const CollectionInfoSchema = z.preprocess(
  preprocessDocCollectionParams,
  CollectionInfoSchemaStrict
);

// Output Schemas

import { BaseOutputSchema } from "./output-schemas.js";

export const ListCollectionsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    collections: z.array(z.record(z.string(), z.unknown())),
  }).loose().optional(),
});

export const CreateCollectionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    collection: z.string(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  }).loose().optional(),
});

export const DropCollectionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    collection: z.string(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  }).loose().optional(),
});

export const FindDocOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    documents: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const AddDocOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    inserted: z.number(),
  }).loose().optional(),
});

export const ModifyDocOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    modified: z.number(),
  }).loose().optional(),
});

export const RemoveDocOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    removed: z.number(),
  }).loose().optional(),
});

export const CreateDocIndexOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    index: z.string(),
  }).loose().optional(),
});

export const CollectionInfoOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    collection: z.string(),
    info: z.record(z.string(), z.unknown()),
  }).loose().optional(),
});
