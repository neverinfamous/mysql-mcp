import { z } from "zod";
import { preprocessDocFilterParams } from "./preprocess-utils.js";

export const ListCollectionsSchema = z.object({
  schema: z.string().optional().describe("Schema name (defaults to current)"),
});

export const CreateCollectionSchema = z.object({
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

export const DropCollectionSchema = z.object({
  name: z.string(),
  schema: z.string().optional(),
  ifExists: z.boolean().default(true),
});

export const FindSchemaBase = z.object({
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
  FindSchemaBase
);

export const AddDocSchema = z.object({
  collection: z.string(),
  schema: z.string().optional(),
  documents: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Documents to add"),
});

export const ModifyDocSchema = z.object({
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

export const RemoveDocSchema = z.object({
  collection: z.string(),
  schema: z.string().optional(),
  filter: z
    .string()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
});

export const CreateDocIndexSchema = z.object({
  collection: z.string(),
  schema: z.string().optional(),
  name: z.string(),
  fields: z.array(
    z.object({
      path: z.string(),
      type: z
        .enum(["TEXT", "INT", "DOUBLE", "DATE", "DATETIME", "GEOJSON"])
        .default("TEXT"),
      required: z.boolean().default(false),
    }),
  ),
  unique: z.boolean().default(false),
});

export const CollectionInfoSchema = z.object({
  collection: z.string(),
  schema: z.string().optional(),
});
