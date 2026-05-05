import { describe, it, expect } from "vitest";
import {
  MigrationRecordSchema,
  MigrationApplySchema,
  MigrationRollbackSchema,
  MigrationHistorySchema,
} from "../index.js";

describe("Migration Schemas", () => {
  describe("MigrationRecordSchema / MigrationApplySchema", () => {
    it("should accept migrationSql", () => {
      const result = MigrationRecordSchema.safeParse({ version: "1.0", migrationSql: "CREATE TABLE a (id INT)" });
      expect(result.success).toBe(true);
    });

    it("should map sql alias to migrationSql", () => {
      const result = MigrationRecordSchema.safeParse({ version: "1.0", sql: "CREATE TABLE a (id INT)" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.migrationSql).toBe("CREATE TABLE a (id INT)");
      }
    });

    it("should map query alias to migrationSql", () => {
      const result = MigrationApplySchema.safeParse({ version: "1.0", query: "CREATE TABLE a (id INT)" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.migrationSql).toBe("CREATE TABLE a (id INT)");
      }
    });

    it("should require version and migrationSql", () => {
      const result = MigrationRecordSchema.safeParse({ description: "Test" });
      expect(result.success).toBe(false);
    });
  });

  describe("MigrationRollbackSchema", () => {
    it("should coerce string id to number", () => {
      const result = MigrationRollbackSchema.safeParse({ id: "10" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(10);
      }
    });

    it("should accept version", () => {
      const result = MigrationRollbackSchema.safeParse({ version: "1.0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe("1.0");
      }
    });
  });

  describe("MigrationHistorySchema", () => {
    it("should coerce limit and offset strings to numbers", () => {
      const result = MigrationHistorySchema.safeParse({ limit: "20", offset: "10" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(10);
      }
    });

    it("should validate status enum", () => {
      const valid = MigrationHistorySchema.safeParse({ status: "applied" });
      expect(valid.success).toBe(true);
      
      const invalid = MigrationHistorySchema.safeParse({ status: "unknown" });
      expect(invalid.success).toBe(false);
    });
  });
});
