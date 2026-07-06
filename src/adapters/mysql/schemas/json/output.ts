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
    value: z.unknown(),
    rowFound: z.boolean().optional(),
  }).optional(),
});

export const JsonUpdateOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsAffected: z.number(),
  }).optional(),
});

export const JsonNormalizeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    uniqueKeys: z.array(z.string()).optional(),
    keyCount: z.number().optional(),
    keyStats: z.array(z.object({
      key: z.string(),
      types: z.array(z.object({
        value_type: z.string().nullable(),
        count: z.number()
      }))
    })).optional(),
    truncated: z.boolean().optional(),
  }).optional(),
});

export const JsonStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    totalSampled: z.number().optional(),
    nullCount: z.number().optional(),
    length: z.object({
      avg: z.number().optional(),
      max: z.number().optional(),
      min: z.number().optional()
    }).optional(),
    depth: z.object({
      avg: z.number().optional(),
      max: z.number().optional(),
      min: z.number().optional()
    }).optional(),
    sizeBytes: z.object({
      avg: z.number().optional(),
      max: z.number().optional(),
      min: z.number().optional()
    }).optional(),
    sampleSize: z.number().optional(),
    topKeys: z.array(z.object({
      key: z.string(),
      count: z.number()
    })).optional(),
  }).optional(),
});

export const JsonIndexSuggestOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string().optional(),
    column: z.string().optional(),
    suggestions: z.array(z.object({
      path: z.string(),
      type: z.string().optional(),
      cardinality: z.number().optional(),
      indexDdl: z.string().optional(),
    })).optional(),
    suggestion: z.string().optional(),
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
