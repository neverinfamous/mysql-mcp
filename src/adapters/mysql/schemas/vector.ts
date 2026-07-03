import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";
import { preprocessVectorParams } from "./preprocess-utils.js";

/**
 * Common schema fragments
 */

const tableAliasesBase = {
  table: z.string().optional().describe("Target table name (Note: Pass table, not tableName)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
};
const columnParamBase = z.string().optional().describe("Vector column name");
const idParamBase = z.union([z.string(), z.number()]).optional().describe("Row identifier (primary key value)");
const idColumnParamBase = z.string().optional().describe("Primary key column name (default: 'id')");
const metricParamBase = z
  .enum(["COSINE", "EUCLIDEAN", "DOT"])
  .optional()
  .describe("Distance metric: 'COSINE', 'EUCLIDEAN', or 'DOT' (default: 'COSINE')");
const filterParamBase = z
  .string()
  .optional()
  .describe("Optional SQL WHERE clause fragment to filter results (e.g., 'status = \"active\"')");

const tableParam = z.string().min(1, "Table name cannot be empty").describe("Target table name (Note: Pass table, not tableName)");
const columnParam = z.string().min(1, "Column name cannot be empty").optional().describe("Vector column name (optional if table has only one)");
const idParam = z.union([z.string(), z.number()]).describe("Row identifier (primary key value)");
const idColumnParam = z
  .string()
  .min(1, "ID column name cannot be empty")
  .optional()
  .default("id")
  .describe("Primary key column name (default: 'id')");
const metricParam = z
  .enum(["COSINE", "EUCLIDEAN", "DOT"])
  .optional()
  .default("COSINE")
  .describe("Distance metric: 'COSINE', 'EUCLIDEAN', or 'DOT' (default: 'COSINE')");
const filterParam = z
  .string()
  .optional()
  .describe("Optional SQL WHERE clause fragment to filter results");

/**
 * Storage Tools
 */

export const VectorStoreSchemaBase = z.object({
  ...tableAliasesBase,
  column: columnParamBase,
  id: idParamBase,
  vector: z.array(z.number()).optional().describe("Vector embedding as an array of numbers"),
  idColumn: idColumnParamBase,
});

export const VectorStoreSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  column: columnParam,
  id: idParam,
  vector: z.array(z.number()).min(1, "Vector cannot be empty").describe("Vector embedding as an array of numbers"),
  idColumn: idColumnParam,
})
  );

export const VectorBatchStoreSchemaBase = z.object({
  ...tableAliasesBase,
  column: columnParamBase,
  items: z.array(z.object({ id: z.union([z.string(), z.number()]), vector: z.array(z.number()) })).optional().describe("Array of objects with 'id' and 'vector' fields"),
  idColumn: idColumnParamBase,
});

export const VectorBatchStoreSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  column: columnParam,
  items: z.array(z.object({
    id: idParam,
    vector: z.array(z.number()).min(1, "Vector cannot be empty")
  })).min(1, "Items array cannot be empty").describe("Array of objects with 'id' and 'vector' fields"),
  idColumn: idColumnParam,
})
  );

export const VectorDeleteSchemaBase = z.object({
  ...tableAliasesBase,
  id: idParamBase,
  idColumn: idColumnParamBase,
});

export const VectorDeleteSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  id: idParam,
  idColumn: idColumnParam,
})
  );

export const VectorGetSchemaBase = z.object({
  ...tableAliasesBase,
  id: idParamBase,
  column: z.string().optional().describe("Specific vector column to return (if omitted, searches for VECTOR columns)"),
  idColumn: idColumnParamBase,
});

export const VectorGetSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  id: idParam,
  column: z.string().min(1).optional().describe("Specific vector column to return"),
  idColumn: idColumnParam,
})
  );

/**
 * Search Tools
 */

export const VectorSearchSchemaBase = z.object({
  ...tableAliasesBase,
  column: columnParamBase,
  queryVector: z.array(z.number()).optional().describe("Query vector as an array of numbers (Note: Pass queryVector, not sql or query)"),
  vector: z.array(z.number()).optional().describe("Alias for queryVector"),
  k: z.number().optional().describe("Number of nearest neighbors to return (default: 10)"),
  metric: metricParamBase,
  filter: filterParamBase,
  select: z.array(z.string()).optional().describe("Array of additional column names to return alongside the distance score"),
});

export const VectorSearchSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  column: z.string().min(1).optional().describe("Vector column name (optional if table has only one)"),
  queryVector: z.array(z.number()).min(1, "Query vector cannot be empty"),
  k: z.number().int().positive().max(1000).optional().default(10),
  metric: metricParam,
  filter: filterParam,
  select: z.array(z.string().min(1)).optional(),
})
  );

export const VectorRangeSearchSchemaBase = z.object({
  ...tableAliasesBase,
  column: columnParamBase,
  queryVector: z.array(z.number()).optional().describe("Query vector as an array of numbers (Note: Pass queryVector, not sql or query)"),
  vector: z.array(z.number()).optional().describe("Alias for queryVector"),
  maxDistance: z.number().optional().describe("Maximum distance threshold"),
  distance: z.number().optional().describe("Alias for maxDistance"),
  metric: metricParamBase,
  limit: z.number().optional().describe("Maximum number of results to return (default: 50)"),
  filter: filterParamBase,
  select: z.array(z.string()).optional().describe("Array of additional column names to return alongside the distance score"),
});

export const VectorRangeSearchSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  column: z.string().min(1).optional().describe("Vector column name (optional if table has only one)"),
  queryVector: z.array(z.number()).min(1, "Query vector cannot be empty"),
  maxDistance: z.number().nonnegative("Distance threshold must be non-negative"),
  metric: metricParam,
  limit: z.number().int().positive().max(1000).optional().default(50),
  filter: filterParam,
  select: z.array(z.string().min(1)).optional(),
})
  );

export const VectorHybridSearchSchemaBase = z.object({
  ...tableAliasesBase,
  vectorColumn: z.string().optional().describe("Name of the vector column"),
  column: z.string().optional().describe("Alias for vectorColumn"),
  textColumn: z.string().optional().describe("Name of the fulltext-indexed column"),
  queryVector: z.array(z.number()).optional().describe("Query vector as an array of numbers (Note: Pass queryVector, not sql)"),
  vector: z.array(z.number()).optional().describe("Alias for queryVector"),
  queryText: z.string().optional().describe("Natural language search query (Note: Pass queryText, not sql)"),
  query: z.string().optional().describe("Alias for queryText"),
  k: z.number().optional().describe("Number of fused results to return (default: 10)"),
  metric: z.enum(["COSINE", "EUCLIDEAN", "DOT"]).optional().describe("Distance metric: 'COSINE', 'EUCLIDEAN', or 'DOT' (default: 'COSINE')"),
  rrfK: z.number().optional().describe("RRF smoothing constant (default: 60). Lower = more weight to top ranks"),
  vectorWeight: z.number().optional().describe("Weight for vector score in RRF (0.0 to 1.0, default: 0.5)"),
  textWeight: z.number().optional().describe("Weight for text score in RRF (0.0 to 1.0, default: 0.5)"),
  select: z.array(z.string()).optional().describe("Array of column names to return alongside scores"),
  filter: z.string().optional().describe("Optional SQL WHERE clause fragment to pre-filter results"),
});

export const VectorHybridSearchSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  vectorColumn: z.string().min(1).optional().describe("Vector column name (optional if table has only one)"),
  textColumn: z.string().min(1, "Text column name cannot be empty"),
  queryVector: z.array(z.number()).min(1).optional(),
  queryText: z.string().optional(),
  k: z.number().int().positive().max(1000).optional().default(10),
  metric: metricParam,
  rrfK: z.number().int().min(1).max(1000).optional().default(60),
  vectorWeight: z.number().min(0).max(1).optional().default(0.5),
  textWeight: z.number().min(0).max(1).optional().default(0.5),
  select: z.array(z.string().min(1)).optional(),
  filter: filterParam,
})
  )
  .refine(data => data.queryVector !== undefined || data.queryText !== undefined, {
  message: "At least one of queryVector or queryText must be provided",
  path: ["queryVector"],
});

/**
 * Management Tools
 */

export const VectorInfoSchemaBase = z.object({
  ...tableAliasesBase,
  column: z.string().optional().describe("Specific vector column to check (if omitted, checks all VECTOR columns)"),
});

export const VectorInfoSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  column: z.string().min(1).optional(),
})
  );

export const VectorCreateIndexSchemaBase = z.object({
  ...tableAliasesBase,
  column: columnParamBase,
  metric: metricParamBase,
  type: z.enum(["HNSW"]).optional().describe("Vector index type (default: 'HNSW')"),
});

export const VectorCreateIndexSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  column: z.string().min(1).optional().describe("Vector column name (optional if table has only one)"),
  metric: metricParam,
  type: z.enum(["HNSW"]).optional().default("HNSW"),
})
  );

export const VectorOptimizeSchemaBase = z.object({
  ...tableAliasesBase,
});

export const VectorOptimizeSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
})
  );

export const VectorStatsSchemaBase = z.object({
  ...tableAliasesBase,
  column: columnParamBase,
});

export const VectorStatsSchema = z
  .preprocess(
    preprocessVectorParams,
    z.object({
  table: tableParam,
  column: z.string().min(1).optional().describe("Vector column name (optional if table has only one)"),
})
  );

// =============================================================================
// Output Schemas
// =============================================================================

export const VectorStoreOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    stored: z.boolean(),
    table: z.string(),
    id: z.unknown(),
    affectedRows: z.number().optional(),
  }).loose().optional(),
});

export const VectorBatchStoreOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    stored: z.boolean(),
    table: z.string(),
    count: z.number(),
    affectedRows: z.number().optional(),
  }).loose().optional(),
});

export const VectorDeleteOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    deleted: z.boolean(),
    table: z.string(),
    id: z.unknown(),
  }).loose().optional(),
});

export const VectorGetOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    exists: z.boolean(),
    table: z.string(),
    column: z.string().optional(),
    id: z.unknown(),
    vector: z.array(z.number()).nullable().optional(),
  }).loose().optional(),
});

export const VectorSearchOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string(),
    metric: z.string(),
    results: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const VectorRangeSearchOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string(),
    metric: z.string(),
    maxDistance: z.number(),
    results: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const VectorHybridSearchOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string(),
    results: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
    weights: z.object({
      vector: z.number(),
      text: z.number(),
    }),
  }).loose().optional(),
});

export const VectorInfoOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string(),
    columns: z.array(
      z.object({
        name: z.string(),
        dimensions: z.number().nullable(),
        isNullable: z.boolean(),
        default: z.unknown(),
      })
    ),
  }).loose().optional(),
});

export const VectorCreateIndexOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    created: z.boolean(),
    table: z.string(),
    column: z.string(),
    indexName: z.string(),
    metric: z.string(),
  }).loose().optional(),
});

export const VectorOptimizeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    optimized: z.boolean(),
    table: z.string(),
    result: z.array(z.record(z.string(), z.unknown())).optional(),
  }).loose().optional(),
});

export const VectorStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string(),
    column: z.string(),
    totalRows: z.number(),
    stats: z.object({
      nonNullCount: z.number(),
      nullCount: z.number(),
      dimensions: z.object({
        consistent: z.boolean(),
        min: z.number(),
        max: z.number(),
      }),
    }).nullable(),
  }).loose().optional(),
});
