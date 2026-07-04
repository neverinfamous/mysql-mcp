import { describe, it, expect } from "vitest";
import {
  PartitionInfoSchema,
  AddPartitionSchema,
  DropPartitionSchema,
  ReorganizePartitionSchema,
} from "../partitioning.js";

describe("Partitioning Schemas", () => {
  describe("PartitionInfoSchema", () => {
    it("should parse standard table name", () => {
      const result = PartitionInfoSchema.parse({ table: "users", database: "test_db", summary: false });
      expect(result).toEqual({ table: "users", database: "test_db", summary: false });
    });

    it("should resolve aliases for table (tableName, name)", () => {
      const result1 = PartitionInfoSchema.parse({ tableName: "users1" });
      expect(result1.table).toBe("users1");
      
      const result2 = PartitionInfoSchema.parse({ name: "users2" });
      expect(result2.table).toBe("users2");
    });

    it("should set summary to true by default", () => {
      const result = PartitionInfoSchema.parse({ table: "users" });
      expect(result.summary).toBe(true);
    });

    it("should fail if table is missing", () => {
      expect(() => PartitionInfoSchema.parse({ database: "test_db" })).toThrow();
      expect(() => PartitionInfoSchema.parse({ table: "" })).toThrow();
    });
  });

  describe("AddPartitionSchema", () => {
    it("should handle standard fields", () => {
      const result = AddPartitionSchema.parse({
        table: "users",
        partitionName: "p0",
        partitionType: "RANGE",
        value: "2024",
      });
      expect(result).toEqual({
        table: "users",
        database: undefined,
        partitionName: "p0",
        partitionType: "RANGE",
        value: "2024",
      });
    });

    it("should handle aliases for partitionName, partitionType and value", () => {
      const result = AddPartitionSchema.parse({
        name: "users",
        partition: "p1",
        type: "list",
        expression: "1,2,3",
      });
      expect(result.partitionName).toBe("p1");
      expect(result.partitionType).toBe("LIST");
      expect(result.value).toBe("1,2,3");

      const result2 = AddPartitionSchema.parse({
        table: "users",
        partitionName: "p2",
        type: "hash",
        sql: "4",
      });
      expect(result2.partitionType).toBe("HASH");
      expect(result2.value).toBe("4");
      
      const result3 = AddPartitionSchema.parse({
        table: "users",
        partitionName: "p2",
        definition: "5",
      });
      expect(result3.value).toBe("5");
    });

    it("should default partitionType to RANGE", () => {
      const result = AddPartitionSchema.parse({
        table: "users",
        partitionName: "p1",
        value: "2025",
      });
      expect(result.partitionType).toBe("RANGE");
    });

    it("should fail if required fields are missing", () => {
      expect(() => AddPartitionSchema.parse({ table: "users", value: "2024" })).toThrow("partitionName");
      expect(() => AddPartitionSchema.parse({ table: "users", partitionName: "p0" })).toThrow("value");
    });
  });

  describe("DropPartitionSchema", () => {
    it("should parse standard fields", () => {
      const result = DropPartitionSchema.parse({
        table: "users",
        partitionName: "p0",
      });
      expect(result).toEqual({
        table: "users",
        database: undefined,
        partitionName: "p0",
      });
    });

    it("should handle aliases", () => {
      const result = DropPartitionSchema.parse({
        table: "users",
        partition: "p1",
      });
      expect(result.partitionName).toBe("p1");

      const result2 = DropPartitionSchema.parse({
        table: "users",
        partitions: "p2",
      });
      expect(result2.partitionName).toBe("p2");
      
      const result3 = DropPartitionSchema.parse({
        table: "users",
        name: "p3",
      });
      expect(result3.partitionName).toBe("p3");
    });

    it("should fail if missing required fields", () => {
      expect(() => DropPartitionSchema.parse({ table: "users" })).toThrow("partitionName");
    });
  });

  describe("ReorganizePartitionSchema", () => {
    it("should parse standard fields", () => {
      const result = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p0", "p1"],
        partitionType: "RANGE",
        toPartitions: [{ name: "p0_new", value: "2024" }, { name: "p1_new", value: "2025" }],
      });
      
      expect(result.table).toBe("users");
      expect(result.fromPartitions).toEqual(["p0", "p1"]);
      expect(result.partitionType).toBe("RANGE");
      expect(result.toPartitions).toEqual([
        { name: "p0_new", value: "2024" },
        { name: "p1_new", value: "2025" }
      ]);
    });

    it("should convert fromPartitions string to array", () => {
      const result = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: "p0, p1",
        toPartitions: [{ name: "p_new", value: "2025" }],
      });
      expect(result.fromPartitions).toEqual(["p0", "p1"]);
      
      // JSON string array
      const result2 = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: '["p2", "p3"]',
        toPartitions: [{ name: "p_new", value: "2025" }],
      });
      expect(result2.fromPartitions).toEqual(["p2", "p3"]);
    });

    it("should handle aliases for fromPartitions", () => {
      const result = ReorganizePartitionSchema.parse({
        table: "users",
        partitions: ["p1"],
        toPartitions: [{ name: "p_new", value: "2025" }],
      });
      expect(result.fromPartitions).toEqual(["p1"]);
      
      const result2 = ReorganizePartitionSchema.parse({
        table: "users",
        from: ["p2"],
        toPartitions: [{ name: "p_new", value: "2025" }],
      });
      expect(result2.fromPartitions).toEqual(["p2"]);

      const result3 = ReorganizePartitionSchema.parse({
        table: "users",
        sourcePartitions: ["p3"],
        toPartitions: [{ name: "p_new", value: "2025" }],
      });
      expect(result3.fromPartitions).toEqual(["p3"]);
    });

    it("should handle single object toPartitions or JSON strings", () => {
      const result = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
        toPartitions: { name: "p_new", value: "2025" }, // Not an array
      });
      expect(result.toPartitions).toEqual([{ name: "p_new", value: "2025" }]);
      
      const result2 = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
        toPartitions: '[{"name": "p_new2", "value": "2026"}]', // JSON string
      });
      expect(result2.toPartitions).toEqual([{ name: "p_new2", value: "2026" }]);
      
      expect(() => ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
        toPartitions: "p_new3", // plain string fallback
      })).toThrow("Each partition in toPartitions must be an object with a non-empty 'name' and 'value'");
    });

    it("should handle aliases for toPartitions", () => {
      const result = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
        into: [{ name: "p_new", value: "2025" }],
      });
      expect(result.toPartitions).toEqual([{ name: "p_new", value: "2025" }]);
      
      const result2 = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
        intoPartitions: [{ name: "p_new", value: "2025" }],
      });
      expect(result2.toPartitions).toEqual([{ name: "p_new", value: "2025" }]);
      
      const result3 = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
        newPartitions: [{ name: "p_new", value: "2025" }],
      });
      expect(result3.toPartitions).toEqual([{ name: "p_new", value: "2025" }]);
      
      const result4 = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
        to: [{ name: "p_new", value: "2025" }],
      });
      expect(result4.toPartitions).toEqual([{ name: "p_new", value: "2025" }]);
    });

    it("should handle alias for partitionType (type)", () => {
      const result = ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
        type: "list",
        toPartitions: [{ name: "p_new", value: "2025" }],
      });
      expect(result.partitionType).toBe("LIST");
    });

    it("should fail if required fields missing or empty", () => {
      expect(() => ReorganizePartitionSchema.parse({
        table: "users",
        toPartitions: [{ name: "p_new", value: "2025" }],
      })).toThrow("fromPartitions");
      
      expect(() => ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
      })).toThrow("toPartitions");
      
      // Empty value in toPartitions
      expect(() => ReorganizePartitionSchema.parse({
        table: "users",
        fromPartitions: ["p1"],
        toPartitions: "p_new3", // this falls back to {name: "p_new3", value: ""}
      })).toThrow("Each partition in toPartitions must be an object with a non-empty 'name' and 'value'");
    });
  });
});
