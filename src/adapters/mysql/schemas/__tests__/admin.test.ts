import { describe, it, expect } from "vitest";
import {
  OptimizeTableSchema,
  AnalyzeTableSchema,
  CheckTableSchema,
  RepairTableSchema,
  FlushTablesSchema,
  KillQuerySchema,
  ShowProcesslistSchema,
  ShowStatusSchema,
  ShowVariablesSchema,
  InnodbStatusSchema,
  ReplicationStatusSchema,
  ServerConfigSchema,
  AuditSearchSchema,
  AppendInsightSchema,
  AuditListBackupsSchema,
  AuditRestoreBackupSchema,
  AuditDiffBackupSchema,
} from "../admin.js";

describe("Admin Schemas", () => {
  describe("OptimizeTableSchema", () => {
    it("should parse valid input", () => {
      const result = OptimizeTableSchema.parse({ tables: ["t1", "t2"] });
      expect(result).toMatchObject({ tables: ["t1", "t2"] });
    });
    it("should handle single table aliases", () => {
      expect(OptimizeTableSchema.parse({ table: "t1" })).toMatchObject({ tables: ["t1"] });
      expect(OptimizeTableSchema.parse({ tableName: "t2" })).toMatchObject({ tables: ["t2"] });
      expect(OptimizeTableSchema.parse({ name: "t3" })).toMatchObject({ tables: ["t3"] });
      expect(OptimizeTableSchema.parse({ table: "t1,t2" })).toMatchObject({ tables: ["t1,t2"] });
    });
    it("should fail if no tables provided", () => {
      expect(() => OptimizeTableSchema.parse({})).toThrow("tables");
    });
  });

  describe("AnalyzeTableSchema", () => {
    it("should handle valid tables", () => {
      expect(AnalyzeTableSchema.parse({ tables: ["t1"] })).toMatchObject({ tables: ["t1"] });
    });
  });

  describe("CheckTableSchema", () => {
    it("should handle valid tables and options", () => {
      expect(CheckTableSchema.parse({ tables: ["t1"], option: "QUICK" })).toMatchObject({ tables: ["t1"], option: "QUICK" });
    });
  });

  describe("RepairTableSchema", () => {
    it("should handle valid tables and quick option", () => {
      expect(RepairTableSchema.parse({ tables: ["t1"], quick: true })).toMatchObject({ tables: ["t1"], quick: true });
    });
    it("should default quick to false", () => {
      expect(RepairTableSchema.parse({ tables: ["t1"] })).toMatchObject({ tables: ["t1"], quick: false });
    });
  });

  describe("FlushTablesSchema", () => {
    it("should handle tables", () => {
      expect(FlushTablesSchema.parse({ tables: ["t1"] })).toMatchObject({ tables: ["t1"] });
    });
    it("should handle missing tables", () => {
      expect(FlushTablesSchema.parse({})).toMatchObject({ tables: undefined });
    });
  });

  describe("KillQuerySchema", () => {
    it("should parse valid processId", () => {
      expect(KillQuerySchema.parse({ processId: 123 })).toMatchObject({ processId: 123, connection: false });
      expect(KillQuerySchema.parse({ processId: "123" })).toMatchObject({ processId: 123, connection: false });
    });
    it("should handle aliases", () => {
      expect(KillQuerySchema.parse({ id: 124 })).toMatchObject({ processId: 124, connection: false });
      expect(KillQuerySchema.parse({ connectionId: 125 })).toMatchObject({ processId: 125, connection: false });
    });
    it("should handle connection flag", () => {
      expect(KillQuerySchema.parse({ processId: 123, connection: true })).toMatchObject({ processId: 123, connection: true });
    });
    it("should fail on missing processId", () => {
      expect(() => KillQuerySchema.parse({})).toThrow();
    });
  });

  describe("ShowProcesslistSchema", () => {
    it("should default correctly", () => {
      expect(ShowProcesslistSchema.parse({})).toMatchObject({ full: false, limit: 10 });
    });
    it("should handle aliases for full", () => {
      expect(ShowProcesslistSchema.parse({ all: true })).toMatchObject({ full: true, limit: 10 });
      expect(ShowProcesslistSchema.parse({ verbose: true })).toMatchObject({ full: true, limit: 10 });
      expect(ShowProcesslistSchema.parse({ complete: true })).toMatchObject({ full: true, limit: 10 });
    });
    it("should handle limit", () => {
      expect(ShowProcesslistSchema.parse({ limit: "50" })).toMatchObject({ full: false, limit: 50 });
    });
  });

  describe("ShowStatusSchema", () => {
    it("should default correctly", () => {
      expect(ShowStatusSchema.parse({})).toMatchObject({ like: undefined, global: true, limit: 10 });
    });
    it("should handle aliases for like", () => {
      expect(ShowStatusSchema.parse({ pattern: "abc%" })).toMatchObject({ like: "abc%", global: true, limit: 10 });
      expect(ShowStatusSchema.parse({ search: "def" })).toMatchObject({ like: "def", global: true, limit: 10 });
      expect(ShowStatusSchema.parse({ filter: "ghi" })).toMatchObject({ like: "ghi", global: true, limit: 10 });
      expect(ShowStatusSchema.parse({ variableName: "xyz" })).toMatchObject({ like: "xyz", global: true, limit: 10 });
    });
  });

  describe("ShowVariablesSchema", () => {
    it("should default correctly", () => {
      expect(ShowVariablesSchema.parse({})).toMatchObject({ like: undefined, global: true, limit: 10 });
    });
    it("should handle aliases for like", () => {
      expect(ShowVariablesSchema.parse({ pattern: "abc%" })).toMatchObject({ like: "abc%", global: true, limit: 10 });
    });
  });

  describe("InnodbStatusSchema", () => {
    it("should default to summary=true", () => {
      expect(InnodbStatusSchema.parse({})).toMatchObject({ summary: true });
    });
    it("should handle aliases to disable summary", () => {
      expect(InnodbStatusSchema.parse({ format: "raw" })).toMatchObject({ summary: false });
      expect(InnodbStatusSchema.parse({ format: "full" })).toMatchObject({ summary: false });
      expect(InnodbStatusSchema.parse({ raw: true })).toMatchObject({ summary: false });
    });
  });

  describe("ReplicationStatusSchema", () => {
    it("should default to summary=false", () => {
      expect(ReplicationStatusSchema.parse({})).toMatchObject({ summary: false });
    });
    it("should handle string booleans", () => {
      expect(ReplicationStatusSchema.parse({ summary: "true" })).toMatchObject({ summary: true });
    });
    it("should handle aliases", () => {
      expect(ReplicationStatusSchema.parse({ raw: true })).toMatchObject({ summary: false });
    });
  });

  describe("ServerConfigSchema", () => {
    it("should default action to get", () => {
      expect(ServerConfigSchema.parse({})).toMatchObject({ action: "get" });
    });
    it("should parse get action", () => {
      expect(ServerConfigSchema.parse({ action: "get", setting: "logLevel" })).toMatchObject({ action: "get", setting: "logLevel" });
      expect(ServerConfigSchema.parse({ key: "logLevel" })).toMatchObject({ action: "get", setting: "logLevel" });
    });
    it("should fail set action if setting or value missing", () => {
      expect(() => ServerConfigSchema.parse({ action: "set" })).toThrow();
      expect(() => ServerConfigSchema.parse({ action: "set", setting: "logLevel" })).toThrow();
    });
    it("should handle set action aliases", () => {
      expect(ServerConfigSchema.parse({ action: "set", key: "logLevel", val: "debug" })).toMatchObject({ action: "set", setting: "logLevel", value: "debug" });
    });
  });

  describe("AuditSearchSchema", () => {
    it("should default pagination", () => {
      expect(AuditSearchSchema.parse({})).toMatchObject({ limit: 5, offset: 0 });
    });
    it("should handle aliases for search", () => {
      expect(AuditSearchSchema.parse({ query: "abc" })).toMatchObject({ search: "abc" });
      expect(AuditSearchSchema.parse({ sql: "xyz" })).toMatchObject({ search: "xyz" });
    });
    it("should parse string limits", () => {
      expect(AuditSearchSchema.parse({ limit: "10", offset: "20" })).toMatchObject({ limit: 10, offset: 20 });
    });
  });

  describe("AppendInsightSchema", () => {
    it("should parse insight", () => {
      expect(AppendInsightSchema.parse({ insight: "abc" })).toMatchObject({ insight: "abc" });
    });
    it("should handle aliases", () => {
      expect(AppendInsightSchema.parse({ text: "abc" })).toMatchObject({ insight: "abc" });
      expect(AppendInsightSchema.parse({ message: "def" })).toMatchObject({ insight: "def" });
    });
    it("should fail if empty", () => {
      expect(() => AppendInsightSchema.parse({})).toThrow();
    });
  });

  describe("AuditListBackupsSchema", () => {
    it("should default limit", () => {
      expect(AuditListBackupsSchema.parse({})).toMatchObject({ limit: 5 });
    });
    it("should handle target aliases", () => {
      expect(AuditListBackupsSchema.parse({ name: "tbl" })).toMatchObject({ limit: 5, target: "tbl" });
      expect(AuditListBackupsSchema.parse({ tableName: "tbl" })).toMatchObject({ limit: 5, target: "tbl" });
    });
  });

  describe("AuditRestoreBackupSchema", () => {
    it("should handle filename", () => {
      expect(AuditRestoreBackupSchema.parse({ filename: "backup.sql" })).toMatchObject({ filename: "backup.sql", includeData: false, dryRun: false });
    });
    it("should handle aliases", () => {
      expect(AuditRestoreBackupSchema.parse({ id: "backup.sql" })).toMatchObject({ filename: "backup.sql", includeData: false, dryRun: false });
      expect(AuditRestoreBackupSchema.parse({ query: "backup.sql" })).toMatchObject({ filename: "backup.sql", includeData: false, dryRun: false });
    });
    it("should fail if no filename", () => {
      expect(() => AuditRestoreBackupSchema.parse({})).toThrow();
    });
  });

  describe("AuditDiffBackupSchema", () => {
    it("should handle filename aliases", () => {
      expect(AuditDiffBackupSchema.parse({ file: "backup.sql" })).toMatchObject({ filename: "backup.sql" });
    });
    it("should fail if no filename", () => {
      expect(() => AuditDiffBackupSchema.parse({})).toThrow();
    });
  });
});
