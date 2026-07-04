import { describe, it, expect } from "vitest";
import {
  ShellDumpInstanceInputSchema,
  ShellDumpSchemasInputSchema,
  ShellDumpTablesInputSchema,
} from "../backup.js";

describe("Shell Backup Schemas", () => {
  describe("ShellDumpInstanceInputSchema", () => {
    it("should parse valid input", () => {
      const result = ShellDumpInstanceInputSchema.parse({
        outputDir: "/tmp/dump",
        threads: 4,
      });
      expect(result).toMatchObject({
        outputDir: "/tmp/dump",
        threads: 4,
        compression: "zstd",
        dryRun: false,
        consistent: true,
        users: true,
      });
    });

    it("should resolve outputDir aliases", () => {
      expect(ShellDumpInstanceInputSchema.parse({ url: "/tmp/url" })).toMatchObject({ outputDir: "/tmp/url" });
      expect(ShellDumpInstanceInputSchema.parse({ path: "/tmp/path" })).toMatchObject({ outputDir: "/tmp/path" });
      expect(ShellDumpInstanceInputSchema.parse({ filepath: "/tmp/filepath" })).toMatchObject({ outputDir: "/tmp/filepath" });
      expect(ShellDumpInstanceInputSchema.parse({ dir: "/tmp/dir" })).toMatchObject({ outputDir: "/tmp/dir" });
      expect(ShellDumpInstanceInputSchema.parse({ directory: "/tmp/dir" })).toMatchObject({ outputDir: "/tmp/dir" });
    });
  });

  describe("ShellDumpSchemasInputSchema", () => {
    it("should parse valid input", () => {
      const result = ShellDumpSchemasInputSchema.parse({
        schemas: ["db1"],
        outputDir: "/tmp/dump",
      });
      expect(result).toMatchObject({
        schemas: ["db1"],
        outputDir: "/tmp/dump",
      });
    });

    it("should resolve schemas aliases and convert strings to arrays", () => {
      expect(ShellDumpSchemasInputSchema.parse({ schema: "db1" })).toMatchObject({ schemas: ["db1"] });
      expect(ShellDumpSchemasInputSchema.parse({ name: "db1" })).toMatchObject({ schemas: ["db1"] });
      expect(ShellDumpSchemasInputSchema.parse({ database: "db1" })).toMatchObject({ schemas: ["db1"] });
    });

    it("should resolve includeTables and excludeTables aliases and arrays", () => {
      const result = ShellDumpSchemasInputSchema.parse({
        schemas: ["db1"],
        includeTable: "t1",
        excludeTable: ["t2", "t3"],
      });
      expect(result).toMatchObject({
        schemas: ["db1"],
        includeTables: ["t1"],
        excludeTables: ["t2", "t3"],
      });
    });

    it("should fail if no schemas provided", () => {
      expect(() => ShellDumpSchemasInputSchema.parse({})).toThrow("At least one schema name is required");
    });
  });

  describe("ShellDumpTablesInputSchema", () => {
    it("should parse valid input", () => {
      const result = ShellDumpTablesInputSchema.parse({
        schema: "db1",
        tables: ["t1", "t2"],
        outputDir: "/tmp/dump",
      });
      expect(result).toMatchObject({
        schema: "db1",
        tables: ["t1", "t2"],
        outputDir: "/tmp/dump",
      });
    });

    it("should resolve schema aliases", () => {
      expect(ShellDumpTablesInputSchema.parse({ schemaName: "db1", tables: ["t1"] })).toMatchObject({ schema: "db1" });
      expect(ShellDumpTablesInputSchema.parse({ database: "db1", tables: ["t1"] })).toMatchObject({ schema: "db1" });
    });

    it("should resolve tables aliases and single strings", () => {
      expect(ShellDumpTablesInputSchema.parse({ schema: "db1", tableNames: "t1" })).toMatchObject({ tables: ["t1"] });
      expect(ShellDumpTablesInputSchema.parse({ schema: "db1", table: "t1" })).toMatchObject({ tables: ["t1"] });
      expect(ShellDumpTablesInputSchema.parse({ schema: "db1", name: "t1" })).toMatchObject({ tables: ["t1"] });
    });

    it("should resolve where aliases", () => {
      expect(ShellDumpTablesInputSchema.parse({ schema: "db1", tables: ["t1"], filter: { t1: "id=1" } })).toMatchObject({ where: { t1: "id=1" } });
    });

    it("should convert string where to object for each table", () => {
      expect(ShellDumpTablesInputSchema.parse({ schema: "db1", tables: ["t1", "t2"], where: "id=1" })).toMatchObject({ where: { t1: "id=1", t2: "id=1" } });
    });

    it("should fail if no schema provided", () => {
      expect(() => ShellDumpTablesInputSchema.parse({ tables: ["t1"] })).toThrow("schema must not be empty");
    });

    it("should fail if no tables provided", () => {
      expect(() => ShellDumpTablesInputSchema.parse({ schema: "db1" })).toThrow("At least one table name is required");
    });
  });
});
