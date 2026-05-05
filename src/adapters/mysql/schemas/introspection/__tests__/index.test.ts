import { describe, it, expect } from "vitest";
import {
  DependencyGraphSchema,
  CascadeSimulatorSchema,
  SchemaSnapshotSchema,
  ConstraintAnalysisSchema,
  MigrationRisksSchema,
} from "../index.js";

describe("Introspection Schemas", () => {
  describe("DependencyGraphSchema", () => {
    it("should parse valid input", () => {
      const result = DependencyGraphSchema.safeParse({ schema: "testdb" });
      expect(result.success).toBe(true);
    });

    it("should coerce string limits and maxDepth to numbers", () => {
      const result = DependencyGraphSchema.safeParse({
        schema: "testdb",
        limit: "50",
        maxDepth: "3"
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.maxDepth).toBe(3);
      }
    });
  });

  describe("CascadeSimulatorSchema", () => {
    it("should extract schema from schema.table format", () => {
      const result = CascadeSimulatorSchema.safeParse({ table: "db1.users" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schema).toBe("db1");
        expect(result.data.table).toBe("users");
      }
    });

    it("should support string input", () => {
      const result = CascadeSimulatorSchema.safeParse("users");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.table).toBe("users");
      }
    });
  });

  describe("SchemaSnapshotSchema", () => {
    it("should provide default values", () => {
      const result = SchemaSnapshotSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.compact).toBe(true);
        expect(result.data.limit).toBe(100);
      }
    });

    it("should coerce string limit to number", () => {
      const result = SchemaSnapshotSchema.safeParse({ limit: "50" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });
  });

  describe("ConstraintAnalysisSchema", () => {
    it("should extract schema from schema.table format", () => {
      const result = ConstraintAnalysisSchema.safeParse({ table: "db1.users" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schema).toBe("db1");
        expect(result.data.table).toBe("users");
      }
    });

    it("should support string input", () => {
      const result = ConstraintAnalysisSchema.safeParse("users");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.table).toBe("users");
      }
    });
  });

  describe("MigrationRisksSchema", () => {
    it("should map statement alias to statements array", () => {
      const result = MigrationRisksSchema.safeParse({ statement: "DROP TABLE users" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.statements).toEqual(["DROP TABLE users"]);
      }
    });

    it("should map sql alias to statements array", () => {
      const result = MigrationRisksSchema.safeParse({ sql: "DROP TABLE users" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.statements).toEqual(["DROP TABLE users"]);
      }
    });

    it("should map ddlQuery alias to statements array", () => {
      const result = MigrationRisksSchema.safeParse({ ddlQuery: "DROP TABLE users" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.statements).toEqual(["DROP TABLE users"]);
      }
    });

    it("should require statements", () => {
      const result = MigrationRisksSchema.safeParse({ schema: "db1" });
      expect(result.success).toBe(false);
    });
  });
});
