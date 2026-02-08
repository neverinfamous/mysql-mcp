/**
 * mysql-mcp - Shell Types Unit Tests
 *
 * Tests for shell-types.ts boolean coercion and schema validation.
 */

import { describe, it, expect } from "vitest";
import {
  ShellImportTableInputSchema,
  ShellDumpInstanceInputSchema,
  ShellDumpSchemasInputSchema,
  ShellDumpTablesInputSchema,
  ShellLoadDumpInputSchema,
  ShellImportJSONInputSchema,
} from "../shell-types.js";

describe("Shell Types - Boolean Coercion", () => {
  describe("ShellImportTableInputSchema", () => {
    it('should coerce string "true" to boolean true', () => {
      const result = ShellImportTableInputSchema.parse({
        inputPath: "/path/to/file",
        schema: "test",
        table: "users",
        updateServerSettings: "true",
      });
      expect(result.updateServerSettings).toBe(true);
    });

    it('should coerce string "false" to boolean false', () => {
      const result = ShellImportTableInputSchema.parse({
        inputPath: "/path/to/file",
        schema: "test",
        table: "users",
        updateServerSettings: "false",
      });
      expect(result.updateServerSettings).toBe(false);
    });

    it('should coerce string "TRUE" (uppercase) to boolean true', () => {
      const result = ShellImportTableInputSchema.parse({
        inputPath: "/path/to/file",
        schema: "test",
        table: "users",
        updateServerSettings: "TRUE",
      });
      expect(result.updateServerSettings).toBe(true);
    });

    it('should coerce string "FALSE" (uppercase) to boolean false', () => {
      const result = ShellImportTableInputSchema.parse({
        inputPath: "/path/to/file",
        schema: "test",
        table: "users",
        updateServerSettings: "FALSE",
      });
      expect(result.updateServerSettings).toBe(false);
    });

    it("should pass through boolean true unchanged", () => {
      const result = ShellImportTableInputSchema.parse({
        inputPath: "/path/to/file",
        schema: "test",
        table: "users",
        updateServerSettings: true,
      });
      expect(result.updateServerSettings).toBe(true);
    });

    it("should pass through boolean false unchanged", () => {
      const result = ShellImportTableInputSchema.parse({
        inputPath: "/path/to/file",
        schema: "test",
        table: "users",
        updateServerSettings: false,
      });
      expect(result.updateServerSettings).toBe(false);
    });

    it("should reject invalid string values", () => {
      expect(() =>
        ShellImportTableInputSchema.parse({
          inputPath: "/path/to/file",
          schema: "test",
          table: "users",
          updateServerSettings: "yes",
        }),
      ).toThrow();
    });
  });

  describe("ShellDumpInstanceInputSchema", () => {
    it("should coerce dryRun string to boolean", () => {
      const result = ShellDumpInstanceInputSchema.parse({
        outputDir: "/backup",
        dryRun: "true",
      });
      expect(result.dryRun).toBe(true);
    });

    it("should coerce consistent string to boolean", () => {
      const result = ShellDumpInstanceInputSchema.parse({
        outputDir: "/backup",
        consistent: "false",
      });
      expect(result.consistent).toBe(false);
    });

    it("should coerce users string to boolean", () => {
      const result = ShellDumpInstanceInputSchema.parse({
        outputDir: "/backup",
        users: "true",
      });
      expect(result.users).toBe(true);
    });
  });

  describe("ShellDumpSchemasInputSchema", () => {
    it("should coerce dryRun string to boolean", () => {
      const result = ShellDumpSchemasInputSchema.parse({
        schemas: ["db1"],
        outputDir: "/backup",
        dryRun: "true",
      });
      expect(result.dryRun).toBe(true);
    });

    it("should coerce ddlOnly string to boolean", () => {
      const result = ShellDumpSchemasInputSchema.parse({
        schemas: ["db1"],
        outputDir: "/backup",
        ddlOnly: "true",
      });
      expect(result.ddlOnly).toBe(true);
    });
  });

  describe("ShellDumpTablesInputSchema", () => {
    it("should coerce all string to boolean", () => {
      const result = ShellDumpTablesInputSchema.parse({
        schema: "db1",
        tables: ["t1"],
        outputDir: "/backup",
        all: "true",
      });
      expect(result.all).toBe(true);
    });
  });

  describe("ShellLoadDumpInputSchema", () => {
    it("should coerce dryRun string to boolean", () => {
      const result = ShellLoadDumpInputSchema.parse({
        inputDir: "/backup",
        dryRun: "true",
      });
      expect(result.dryRun).toBe(true);
    });

    it("should coerce ignoreExistingObjects string to boolean", () => {
      const result = ShellLoadDumpInputSchema.parse({
        inputDir: "/backup",
        ignoreExistingObjects: "true",
      });
      expect(result.ignoreExistingObjects).toBe(true);
    });

    it("should coerce ignoreVersion string to boolean", () => {
      const result = ShellLoadDumpInputSchema.parse({
        inputDir: "/backup",
        ignoreVersion: "true",
      });
      expect(result.ignoreVersion).toBe(true);
    });

    it("should coerce resetProgress string to boolean", () => {
      const result = ShellLoadDumpInputSchema.parse({
        inputDir: "/backup",
        resetProgress: "true",
      });
      expect(result.resetProgress).toBe(true);
    });

    it("should coerce updateServerSettings string to boolean", () => {
      const result = ShellLoadDumpInputSchema.parse({
        inputDir: "/backup",
        updateServerSettings: "true",
      });
      expect(result.updateServerSettings).toBe(true);
    });
  });

  describe("ShellImportJSONInputSchema", () => {
    it("should coerce convertBsonTypes string to boolean", () => {
      const result = ShellImportJSONInputSchema.parse({
        inputPath: "/data.json",
        schema: "test",
        collection: "docs",
        convertBsonTypes: "true",
      });
      expect(result.convertBsonTypes).toBe(true);
    });

    it("should coerce convertBsonTypes string false to boolean", () => {
      const result = ShellImportJSONInputSchema.parse({
        inputPath: "/data.json",
        schema: "test",
        collection: "docs",
        convertBsonTypes: "false",
      });
      expect(result.convertBsonTypes).toBe(false);
    });
  });
});
