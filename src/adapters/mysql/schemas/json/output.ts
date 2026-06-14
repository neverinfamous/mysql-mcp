import { z } from "zod";
import { BaseOutputSchema } from "../output-schemas.js";

// =============================================================================
// Output Schemas
// =============================================================================

export const JsonExtractOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
  }).optional(),
});

export const JsonSetOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsAffected: z.number(),
  }).optional(),
});

export const JsonInsertOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsAffected: z.number(),
    changed: z.boolean().optional(),
    suggestion: z.string().optional(),
  }).optional(),
});

export const JsonReplaceOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsAffected: z.number(),
  }).optional(),
});

export const JsonRemoveOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsAffected: z.number(),
  }).optional(),
});

export const JsonContainsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
  }).optional(),
});

export const JsonKeysOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    keys: z.array(z.string()).optional(),
  }).optional(),
});

export const JsonSearchOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
  }).optional(),
});

export const JsonArrayAppendOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsAffected: z.number(),
  }).optional(),
});

export const JsonGetOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
  }).optional(),
});

export const JsonUpdateOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsAffected: z.number(),
  }).optional(),
});

export const JsonNormalizeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsProcessed: z.number().optional(),
    rowsAffected: z.number().optional(),
    failed: z.number().optional(),
  }).optional(),
});

export const JsonStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    totalRows: z.number().optional(),
    nonNullRows: z.number().optional(),
    validJsonRows: z.number().optional(),
    invalidJsonRows: z.number().optional(),
    typeDistribution: z.record(z.string(), z.number()).optional(),
    avgSize: z.number().optional(),
    maxSize: z.number().optional(),
    maxDepth: z.number().optional(),
  }).optional(),
});

export const JsonIndexSuggestOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    suggestions: z.array(z.object({
      path: z.string(),
      frequency: z.number().optional(),
      type: z.string().optional(),
      selectivity: z.number().optional(),
      recommendation: z.string().optional(),
    })).optional(),
    sampleSize: z.number().optional(),
    message: z.string().optional(),
  }).optional(),
});

export const JsonValidateOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    valid: z.boolean(),
    error: z.string().optional(),
    type: z.string().optional(),
    size: z.number().optional(),
    depth: z.number().optional(),
    keys: z.number().optional(),
  }).optional(),
});

export const JsonMergeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    result: z.unknown(),
    mode: z.string(),
  }).optional(),
});

export const JsonDiffOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    identical: z.boolean(),
    json1ContainsJson2: z.boolean().optional(),
    json2ContainsJson1: z.boolean().optional(),
    json1Length: z.number().optional(),
    json2Length: z.number().optional(),
    json1Keys: z.array(z.string()).optional(),
    json2Keys: z.array(z.string()).optional(),
    addedKeys: z.array(z.string()).optional(),
    removedKeys: z.array(z.string()).optional(),
    differences: z.array(z.object({
      path: z.string(),
      value1: z.unknown().optional(),
      value2: z.unknown().optional(),
    })).optional(),
  }).optional(),
});
