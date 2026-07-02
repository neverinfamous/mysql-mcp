import { z } from "zod";
import { preprocessDocFilterParams, preprocessDocIndexParams, preprocessDocCollectionParams } from "./preprocess-utils.js";

export const ListCollectionsSchemaBase = z.object({
  schema: z.string().optional().describe("Schema name (defaults to current)"),
  database: z.string().optional().describe("Alias for schema"),
});
export const ListCollectionsSchemaStrict = z.object({
  schema: z.string().optional().describe("Schema name (defaults to current)"),
});
export const ListCollectionsSchema = z.preprocess(
  preprocessDocCollectionParams,
  ListCollectionsSchemaStrict
);

export const CreateCollectionSchemaBase = z.object({
  name: z.string().optional().describe("Collection name"),
  collection: z.string().optional().describe("Alias for name"),
  table: z.string().optional().describe("Alias for name"),
  tableName: z.string().optional().describe("Alias for name"),
  schema: z.string().optional(),
  database: z.string().optional().describe("Alias for schema"),
  ifNotExists: z.boolean().optional().describe("Add IF NOT EXISTS clause"),
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
  name: z.string().describe("Collection name"),
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
        .default("OFF")
        .describe("Validation level"),
    })
    .optional()
    .describe("Validation config"),
});

export const CreateCollectionSchema = z.preprocess(
  preprocessDocCollectionParams,
  CreateCollectionSchemaStrict
);

export const DropCollectionSchemaBase = z.object({
  name: z.string().optional(),
  collection: z.string().optional().describe("Alias for name"),
  table: z.string().optional().describe("Alias for name"),
  tableName: z.string().optional().describe("Alias for name"),
  schema: z.string().optional(),
  database: z.string().optional().describe("Alias for schema"),
  ifExists: z.boolean().optional(),
});

export const DropCollectionSchemaStrict = z.object({
  name: z.string(),
  schema: z.string().optional(),
  ifExists: z.boolean().default(false),
});

export const DropCollectionSchema = z.preprocess(
  preprocessDocCollectionParams,
  DropCollectionSchemaStrict
);

export const FindSchemaBase = z.object({
  collection: z.string().optional(),
  name: z.string().optional().describe("Alias for collection"),
  table: z.string().optional().describe("Alias for collection"),
  tableName: z.string().optional().describe("Alias for collection"),
  schema: z.string().optional(),
  database: z.string().optional().describe("Alias for schema"),
  filter: z
    .string()
    .optional()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
  criteria: z.unknown().optional(),
  fields: z.array(z.string()).optional(),
  limit: z.unknown().optional(),
  offset: z.unknown().optional(),
});

export const FindSchemaStrict = z.object({
  collection: z.string(),
  schema: z.string().optional(),
  filter: z
    .string()
    .optional()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
  fields: z.array(z.string()).optional(),
  limit: z.number().default(100),
  offset: z.number().default(0),
});

export const FindSchema = z.preprocess(
  preprocessDocFilterParams,
  FindSchemaStrict,
);

export const AddDocSchemaBase = z.object({
  collection: z.string().optional(),
  name: z.string().optional().describe("Alias for collection"),
  table: z.string().optional().describe("Alias for collection"),
  tableName: z.string().optional().describe("Alias for collection"),
  schema: z.string().optional(),
  database: z.string().optional().describe("Alias for schema"),
  document: z.unknown().optional().describe("Alias for documents"),
  documents: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe("Documents to add"),
});

export const AddDocSchemaStrict = z.object({
  collection: z.string(),
  schema: z.string().optional(),
  documents: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Documents to add"),
});

export const AddDocSchema = z.preprocess(
  preprocessDocCollectionParams,
  AddDocSchemaStrict
);

export const ModifyDocSchemaBase = z.object({
  collection: z.string().optional(),
  name: z.string().optional().describe("Alias for collection"),
  table: z.string().optional().describe("Alias for collection"),
  tableName: z.string().optional().describe("Alias for collection"),
  schema: z.string().optional(),
  database: z.string().optional().describe("Alias for schema"),
  documentId: z.unknown().optional().describe("Alias for filter"),
  filter: z
    .string()
    .optional()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
  criteria: z.unknown().optional(),
  set: z.record(z.string(), z.unknown()).optional().describe("Fields to set"),
  patch: z.record(z.string(), z.unknown()).optional().describe("Alias for set"),
  update: z.record(z.string(), z.unknown()).optional(),
  unset: z.array(z.string()).optional(),
});

export const ModifyDocSchemaStrict = z.object({
  collection: z.string(),
  schema: z.string().optional(),
  filter: z
    .string()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
  set: z.record(z.string(), z.unknown()).optional().describe("Fields to set"),
  unset: z.array(z.string()).optional(),
});

export const ModifyDocSchema = z.preprocess(
  preprocessDocFilterParams,
  ModifyDocSchemaStrict,
);

export const RemoveDocSchemaBase = z.object({
  collection: z.string().optional(),
  name: z.string().optional().describe("Alias for collection"),
  table: z.string().optional().describe("Alias for collection"),
  tableName: z.string().optional().describe("Alias for collection"),
  schema: z.string().optional(),
  database: z.string().optional().describe("Alias for schema"),
  documentId: z.unknown().optional().describe("Alias for filter"),
  filter: z
    .string()
    .optional()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
  criteria: z.unknown().optional(),
});

export const RemoveDocSchemaStrict = z.object({
  collection: z.string(),
  schema: z.string().optional(),
  filter: z
    .string()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
});

export const RemoveDocSchema = z.preprocess(
  preprocessDocFilterParams,
  RemoveDocSchemaStrict,
);

export const CreateDocIndexSchemaBase = z.object({
  collection: z.string().optional(),
  table: z.string().optional().describe("Alias for collection"),
  tableName: z.string().optional().describe("Alias for collection"),
  schema: z.string().optional(),
  database: z.string().optional().describe("Alias for schema"),
  name: z.string().optional(),
  indexName: z.string().optional().describe("Alias for name"),
  fields: z
    .array(
      z.object({
        path: z.string().optional(),
        field: z.string().optional(),
        type: z.string().optional(),
        required: z.boolean().optional(),
      }),
    )
    .optional(),
  unique: z.boolean().optional(),
});

export const CreateDocIndexSchemaStrict = z.object({
  collection: z.string(),
  schema: z.string().optional(),
  name: z.string(),
  fields: z.array(
    z.object({
      path: z.string(),
      type: z.string().default("TEXT"),
      required: z.boolean().default(false),
    }),
  ),
  unique: z.boolean().default(false),
});

export const CreateDocIndexSchema = z.preprocess(
  preprocessDocIndexParams,
  CreateDocIndexSchemaStrict,
);

export const CollectionInfoSchemaBase = z.object({
  collection: z.string().optional(),
  name: z.string().optional().describe("Alias for collection"),
  table: z.string().optional().describe("Alias for collection"),
  tableName: z.string().optional().describe("Alias for collection"),
  schema: z.string().optional(),
  database: z.string().optional().describe("Alias for schema"),
});

export const CollectionInfoSchemaStrict = z.object({
  collection: z.string(),
  schema: z.string().optional(),
});

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
