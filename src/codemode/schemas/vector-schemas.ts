import { z } from "zod";

export function createSuccessResponseSchema(dataSchema: z.ZodType, description: string): z.ZodType {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  }).describe(description);
}

// Basic schemas for common fields
const storedVectorResponse = z.object({
  stored: z.boolean(),
  table: z.string(),
  id: z.union([z.string(), z.number()]).optional(), // Optional for batch
  affectedRows: z.number().optional(),
  count: z.number().optional(), // For batch store
});

const deletedVectorResponse = z.object({
  deleted: z.boolean(),
  table: z.string(),
  id: z.union([z.string(), z.number()]),
});

const getVectorResponse = z.object({
  exists: z.boolean(),
  table: z.string(),
  column: z.string().optional(),
  id: z.union([z.string(), z.number()]),
  vector: z.array(z.number()).nullable().optional(),
});

const searchVectorResponse = z.object({
  table: z.string(),
  metric: z.string().optional(),
  maxDistance: z.number().optional(), // For range search
  results: z.array(z.record(z.string(), z.unknown())),
  count: z.number(),
  weights: z.object({
    vector: z.number(),
    text: z.number()
  }).optional(), // For hybrid search
});

const infoVectorResponse = z.object({
  table: z.string(),
  columns: z.array(z.object({
    name: z.string(),
    dimensions: z.number().nullable(),
    isNullable: z.boolean(),
    default: z.unknown(),
  })),
});

const createIndexVectorResponse = z.object({
  created: z.boolean(),
  table: z.string(),
  column: z.string(),
  indexName: z.string(),
  metric: z.string().optional(),
});

const optimizeVectorResponse = z.object({
  optimized: z.boolean(),
  table: z.string(),
  result: z.array(z.record(z.string(), z.unknown())).optional(),
});

const statsVectorResponse = z.object({
  table: z.string(),
  column: z.string(),
  totalRows: z.number(),
  stats: z.object({
    nonNullCount: z.number(),
    nullCount: z.number(),
    dimensions: z.object({
      consistent: z.boolean(),
      min: z.number(),
      max: z.number()
    })
  }).nullable()
});

// Create full success response schemas
export const VectorStoreResponseSchema = createSuccessResponseSchema(storedVectorResponse, "Store vector response");
export const VectorBatchStoreResponseSchema = createSuccessResponseSchema(storedVectorResponse, "Batch store vector response");
export const VectorDeleteResponseSchema = createSuccessResponseSchema(deletedVectorResponse, "Delete vector response");
export const VectorGetResponseSchema = createSuccessResponseSchema(getVectorResponse, "Get vector response");
export const VectorSearchResponseSchema = createSuccessResponseSchema(searchVectorResponse, "Search vector response");
export const VectorRangeSearchResponseSchema = createSuccessResponseSchema(searchVectorResponse, "Range search vector response");
export const VectorHybridSearchResponseSchema = createSuccessResponseSchema(searchVectorResponse, "Hybrid search vector response");
export const VectorInfoResponseSchema = createSuccessResponseSchema(infoVectorResponse, "Vector info response");
export const VectorCreateIndexResponseSchema = createSuccessResponseSchema(createIndexVectorResponse, "Create vector index response");
export const VectorOptimizeResponseSchema = createSuccessResponseSchema(optimizeVectorResponse, "Optimize vector index response");
export const VectorStatsResponseSchema = createSuccessResponseSchema(statsVectorResponse, "Vector stats response");
