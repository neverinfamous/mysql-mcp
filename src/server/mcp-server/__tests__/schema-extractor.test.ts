import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  extractJsonSchema,
  extractParameterSummary,
} from "../schema-extractor.js";
import { ReadQuerySchemaBase } from "../../../adapters/mysql/schemas/core.js";

describe("schema-extractor", () => {
  describe("extractJsonSchema", () => {
    it("should return null for non-Standard-Schema inputs", () => {
      expect(extractJsonSchema(null)).toBeNull();
      expect(extractJsonSchema(undefined)).toBeNull();
      expect(extractJsonSchema("string")).toBeNull();
      expect(extractJsonSchema({})).toBeNull();
      expect(extractJsonSchema({ "~standard": {} })).toBeNull();
    });

    it("should safely extract schema from simple z.object", () => {
      const schema = z.object({
        name: z.string().describe("User name"),
        age: z.number().optional(),
      });

      const result = extractJsonSchema(schema);
      expect(result).not.toBeNull();
      expect(result).toEqual({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          name: { type: "string", description: "User name" },
          age: { type: "number" },
        },
        required: ["name"],
      });
    });

    it("should safely extract schema from complex preprocessed schemas", () => {
      // Simulate mysql-mcp's base schema pattern
      const schema = z.preprocess(
        (v) => v,
        z.object({
          mode: z.enum(["read", "write"]).describe("Operation mode"),
          config: z.record(z.string(), z.unknown()).optional(),
        })
      );

      const result = extractJsonSchema(schema);
      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        type: "object",
        properties: {
          mode: { type: "string", enum: ["read", "write"] },
          config: { type: "object" },
        },
        required: ["mode"],
      });
    });

    it("should extract schema from actual mysql-mcp tool schemas", () => {
      const result = extractJsonSchema(ReadQuerySchemaBase);
      expect(result).not.toBeNull();
      // It should have query, sql, params, cursor, etc.
      const properties = result?.["properties"] as Record<string, unknown>;
      expect(properties).toHaveProperty("query");
      expect(properties).toHaveProperty("params");
      expect(properties).toHaveProperty("transactionId");
    });
  });

  describe("extractParameterSummary", () => {
    it("should convert JSON schema to ParameterSummary array", () => {
      const schema = z.object({
        name: z.string().describe("User name"),
        age: z.number().optional(),
        mode: z.enum(["read", "write"]).describe("Mode"),
        data: z.record(z.string(), z.unknown()),
      });

      const jsonSchema = extractJsonSchema(schema)!;
      const result = extractParameterSummary(jsonSchema);

      expect(result).toHaveLength(4);
      expect(result).toEqual(
        expect.arrayContaining([
          {
            name: "name",
            type: "string",
            required: true,
            description: "User name",
          },
          { name: "age", type: "number", required: false },
          {
            name: "mode",
            type: "enum",
            required: true,
            description: "Mode",
          },
          { name: "data", type: "object", required: true },
        ])
      );
    });

    it("should handle missing properties gracefully", () => {
      expect(extractParameterSummary({})).toEqual([]);
      expect(extractParameterSummary({ type: "string" })).toEqual([]);
    });

    it("should handle edge case type resolutions", () => {
      const jsonSchema = {
        properties: {
          unionVal: { anyOf: [{ type: "string" }, { type: "number" }] },
          literalVal: { type: "string", const: "admin" },
          unknownVal: {},
        },
      };

      const result = extractParameterSummary(jsonSchema);
      expect(result).toEqual(
        expect.arrayContaining([
          { name: "unionVal", type: "union", required: false },
          { name: "literalVal", type: "literal", required: false },
          { name: "unknownVal", type: "unknown", required: false },
        ])
      );
    });
  });
});
