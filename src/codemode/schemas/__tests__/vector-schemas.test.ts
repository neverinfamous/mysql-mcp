import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  createSuccessResponseSchema,
  VectorStoreResponseSchema,
  VectorSearchResponseSchema,
  VectorDeleteResponseSchema,
  VectorGetResponseSchema,
  VectorInfoResponseSchema,
  VectorCreateIndexResponseSchema,
  VectorOptimizeResponseSchema,
  VectorStatsResponseSchema,
} from "../vector-schemas.js";

describe("Vector Schemas", () => {
  describe("createSuccessResponseSchema", () => {
    it("should create a schema that requires success to be true and includes the provided data schema", () => {
      const dataSchema = z.object({ foo: z.string() });
      const schema = createSuccessResponseSchema(dataSchema, "Test Schema");

      // Valid object
      const validObj = {
        success: true as const,
        data: { foo: "bar" },
      };
      expect(schema.parse(validObj)).toEqual(validObj);

      // Invalid: success is false
      expect(() =>
        schema.parse({
          success: false,
          data: { foo: "bar" },
        })
      ).toThrow();

      // Invalid: missing success
      expect(() =>
        schema.parse({
          data: { foo: "bar" },
        })
      ).toThrow();

      // Invalid: data doesn't match
      expect(() =>
        schema.parse({
          success: true,
          data: { foo: 123 },
        })
      ).toThrow();
      
      // Should have correct description
      expect(schema.description).toBe("Test Schema");
    });
  });

  describe("VectorStoreResponseSchema", () => {
    it("should validate valid store responses", () => {
      const validResponse = {
        success: true as const,
        data: {
          stored: true,
          table: "embeddings",
          id: 1,
          affectedRows: 1,
        }
      };
      expect(VectorStoreResponseSchema.parse(validResponse)).toEqual(validResponse);
    });

    it("should validate valid batch store responses", () => {
      const validBatchResponse = {
        success: true as const,
        data: {
          stored: true,
          table: "embeddings",
          count: 5,
          affectedRows: 5,
        }
      };
      expect(VectorStoreResponseSchema.parse(validBatchResponse)).toEqual(validBatchResponse);
    });

    it("should reject invalid store responses", () => {
      // Missing table
      expect(() =>
        VectorStoreResponseSchema.parse({
          success: true,
          data: {
            stored: true,
          }
        })
      ).toThrow();

      // Invalid stored type
      expect(() =>
        VectorStoreResponseSchema.parse({
          success: true,
          data: {
            stored: "yes",
            table: "embeddings",
          }
        })
      ).toThrow();
    });
  });

  describe("VectorSearchResponseSchema", () => {
    it("should validate valid search responses", () => {
      const validResponse = {
        success: true as const,
        data: {
          table: "embeddings",
          results: [{ id: 1, distance: 0.1 }],
          count: 1
        }
      };
      expect(VectorSearchResponseSchema.parse(validResponse)).toEqual(validResponse);
    });

    it("should validate hybrid search responses with weights", () => {
      const validHybridResponse = {
        success: true as const,
        data: {
          table: "embeddings",
          results: [{ id: 1, score: 0.9 }],
          count: 1,
          weights: {
            vector: 0.7,
            text: 0.3
          }
        }
      };
      expect(VectorSearchResponseSchema.parse(validHybridResponse)).toEqual(validHybridResponse);
    });

    it("should reject invalid search responses", () => {
      // Missing results
      expect(() =>
        VectorSearchResponseSchema.parse({
          success: true,
          data: {
            table: "embeddings",
            count: 0
          }
        })
      ).toThrow();

      // Results is not an array
      expect(() =>
        VectorSearchResponseSchema.parse({
          success: true,
          data: {
            table: "embeddings",
            results: {},
            count: 0
          }
        })
      ).toThrow();
    });
  });

  describe("Other Vector Schemas", () => {
    it("VectorDeleteResponseSchema validates correctly", () => {
      const valid = {
        success: true as const,
        data: {
          deleted: true,
          table: "embeddings",
          id: 123
        }
      };
      expect(VectorDeleteResponseSchema.parse(valid)).toEqual(valid);

      expect(() => VectorDeleteResponseSchema.parse({ success: true, data: { deleted: true, table: "embeddings" } })).toThrow();
    });

    it("VectorGetResponseSchema validates correctly", () => {
      const valid = {
        success: true as const,
        data: {
          exists: true,
          table: "embeddings",
          id: "uuid-123",
          vector: [0.1, 0.2, 0.3]
        }
      };
      expect(VectorGetResponseSchema.parse(valid)).toEqual(valid);

      expect(() => VectorGetResponseSchema.parse({ success: true, data: { exists: true, table: "embeddings" } })).toThrow(); // missing id
    });

    it("VectorInfoResponseSchema validates correctly", () => {
      const valid = {
        success: true as const,
        data: {
          table: "embeddings",
          columns: [
            {
              name: "vec",
              dimensions: 1536,
              isNullable: false,
              default: null
            }
          ]
        }
      };
      expect(VectorInfoResponseSchema.parse(valid)).toEqual(valid);
      
      expect(() => VectorInfoResponseSchema.parse({ success: true, data: { table: "embeddings", columns: [{ name: "vec" }] } })).toThrow();
    });

    it("VectorStatsResponseSchema validates correctly", () => {
      const valid = {
        success: true as const,
        data: {
          table: "embeddings",
          column: "vec",
          totalRows: 100,
          stats: {
            nonNullCount: 100,
            nullCount: 0,
            dimensions: {
              consistent: true,
              min: 1536,
              max: 1536
            }
          }
        }
      };
      expect(VectorStatsResponseSchema.parse(valid)).toEqual(valid);
      
      // stats can be nullable
      const validNullable = {
        success: true as const,
        data: {
          table: "embeddings",
          column: "vec",
          totalRows: 0,
          stats: null
        }
      };
      expect(VectorStatsResponseSchema.parse(validNullable)).toEqual(validNullable);
    });

    it("VectorCreateIndexResponseSchema validates correctly", () => {
      const valid = {
        success: true as const,
        data: {
          created: true,
          table: "embeddings",
          column: "vec",
          indexName: "idx_vec",
          metric: "cosine"
        }
      };
      expect(VectorCreateIndexResponseSchema.parse(valid)).toEqual(valid);
      
      expect(() => VectorCreateIndexResponseSchema.parse({ success: true, data: { created: true } })).toThrow();
    });

    it("VectorOptimizeResponseSchema validates correctly", () => {
      const valid = {
        success: true as const,
        data: {
          optimized: true,
          table: "embeddings",
        }
      };
      expect(VectorOptimizeResponseSchema.parse(valid)).toEqual(valid);
      
      expect(() => VectorOptimizeResponseSchema.parse({ success: true, data: { optimized: true } })).toThrow();
    });
  });
});
