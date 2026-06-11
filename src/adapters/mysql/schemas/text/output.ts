import { z } from "zod";
import { BaseOutputSchema } from "../output-schemas.js";

// =============================================================================
// Output Schemas
// =============================================================================

export const RegexpMatchOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
});

export const TextQueryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).optional(),
});

export const LikeSearchOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
});

export const FulltextCreateOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    success: z.boolean(),
    indexName: z.string(),
    message: z.string().optional(),
  }).optional(),
});

export const FulltextSearchOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
    facets: z.record(z.string(), z.record(z.string(), z.number())).optional(),
    nextCursor: z.string().optional(),
    hasMore: z.boolean().optional(),
  }).optional(),
});

export const FulltextDropOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    success: z.boolean(),
    indexName: z.string(),
    message: z.string().optional(),
  }).optional(),
});

export const FulltextBooleanOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
    facets: z.record(z.string(), z.record(z.string(), z.number())).optional(),
    nextCursor: z.string().optional(),
    hasMore: z.boolean().optional(),
  }).optional(),
});

export const FulltextExpandOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
    facets: z.record(z.string(), z.record(z.string(), z.number())).optional(),
    nextCursor: z.string().optional(),
    hasMore: z.boolean().optional(),
  }).optional(),
});

export const SoundexOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
    soundex: z.string().optional(),
  }).optional(),
});

export const SubstringOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
  }).optional(),
});

export const ConcatOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
  }).optional(),
});

export const CollationConvertOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
    charset: z.string().optional(),
    collation: z.string().optional(),
  }).optional(),
});
