import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as child_process from "child_process";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";
import {
  createShellDumpInstanceTool,
  createShellDumpSchemasTool,
  createShellDumpTablesTool,
} from "../backup.js";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("Shell Backup Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;
  let mockSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
    mockSpawn = child_process.spawn as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupMockSpawn(stdout = "", stderr = "", exitCode = 0) {
    const mockChild = {
      stdout: {
        on: vi.fn().mockImplementation((event, cb) => {
          if (event === "data") cb(Buffer.from(stdout));
        }),
      },
      stderr: {
        on: vi.fn().mockImplementation((event, cb) => {
          if (event === "data") cb(Buffer.from(stderr));
        }),
      },
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      },
      on: vi.fn().mockImplementation((event, cb) => {
        if (event === "close") cb(exitCode);
      }),
      kill: vi.fn(),
    };
    mockSpawn.mockReturnValue(mockChild);
    return mockChild;
  }

  describe("mysqlsh_dump_instance", () => {
    it("should dump instance with options", async () => {
      const successJson = JSON.stringify({
        success: true,
        result: { status: "Completed" },
      });
      setupMockSpawn(successJson);

      const tool = createShellDumpInstanceTool();
      const result = (await tool.handler(
        {
          outputDir: "/backup/full",
          dryRun: true,
          threads: 8,
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);

      const jsArg = mockSpawn.mock.calls[0][1][4];
      expect(jsArg).toContain('util.dumpInstance("/backup/full"');
      expect(jsArg).toContain("dryRun: true");
      expect(jsArg).toContain("threads: 8");
    });

    it("should dump instance with all options", async () => {
      const successJson = JSON.stringify({
        success: true,
        result: { status: "Completed" },
      });
      setupMockSpawn(successJson);

      const tool = createShellDumpInstanceTool();
      await tool.handler(
        {
          outputDir: "/backup/full",
          compression: "gzip",
          includeSchemas: ["s1"],
          excludeSchemas: ["s2"],
          consistent: false,
          users: false,
        },
        mockContext,
      );

      const jsArg = mockSpawn.mock.calls[0][1][4];
      expect(jsArg).toContain('compression: "gzip"');
      expect(jsArg).toContain('includeSchemas: ["s1"]');
      expect(jsArg).toContain('excludeSchemas: ["s2"]');
      expect(jsArg).toContain("consistent: false");
      expect(jsArg).toContain("users: false");
    });

    it("should return structured error for privilege errors", async () => {
      setupMockSpawn("", "Access denied for user", 1);

      const tool = createShellDumpInstanceTool();
      const result = (await tool.handler(
        { outputDir: "/backup/full" },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing privileges");
      expect(result.hint).toContain("mysqlsh_dump_schemas");
    });

    it("should return structured error for Fatal error during dump", async () => {
      setupMockSpawn("", "Fatal error during dump: Writing schema metadata", 1);

      const tool = createShellDumpInstanceTool();
      const result = (await tool.handler(
        { outputDir: "/backup/full" },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Fatal error during dump");
      expect(result.hint).toContain("mysqlsh_dump_schemas");
    });

    it("should return structured error for non-privilege errors", async () => {
      setupMockSpawn("", "Connection refused", 1);

      const tool = createShellDumpInstanceTool();
      const result = (await tool.handler(
        { outputDir: "/backup/full" },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection refused");
    });
  });

  describe("mysqlsh_dump_schemas", () => {
    it("should dump schemas with options", async () => {
      const successJson = JSON.stringify({
        success: true,
        result: { status: "Completed" },
      });
      setupMockSpawn(successJson);

      const tool = createShellDumpSchemasTool();
      const result = (await tool.handler(
        {
          schemas: ["db1", "db2"],
          outputDir: "/backup/schemas",
          threads: 4,
          compression: "gzip",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.schemas).toEqual(["db1", "db2"]);

      const jsArg = mockSpawn.mock.calls[0][1][4];
      expect(jsArg).toContain(
        'util.dumpSchemas(["db1","db2"], "/backup/schemas"',
      );
      expect(jsArg).toContain("threads: 4");
      expect(jsArg).toContain('compression: "gzip"');
    });

    it("should support all optional parameters", async () => {
      const successJson = JSON.stringify({
        success: true,
        result: { status: "Completed" },
      });
      setupMockSpawn(successJson);

      const tool = createShellDumpSchemasTool();
      await tool.handler(
        {
          schemas: ["db1"],
          outputDir: "/out",
          dryRun: true,
          includeTables: ["t1"],
          excludeTables: ["t2"],
        },
        mockContext,
      );

      const jsArg = mockSpawn.mock.calls[0][1][4];
      expect(jsArg).toContain("dryRun: true");
      expect(jsArg).toContain('includeTables: ["t1"]');
      expect(jsArg).toContain('excludeTables: ["t2"]');
    });

    it("should support ddlOnly mode disabling events, triggers, routines", async () => {
      const successJson = JSON.stringify({
        success: true,
        result: { status: "Completed" },
      });
      setupMockSpawn(successJson);

      const tool = createShellDumpSchemasTool();
      const result = (await tool.handler(
        {
          schemas: ["db1"],
          outputDir: "/backup/ddl",
          ddlOnly: true,
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.ddlOnly).toBe(true);

      const jsArg = mockSpawn.mock.calls[0][1][4];
      expect(jsArg).toContain("events: false");
      expect(jsArg).toContain("triggers: false");
      expect(jsArg).toContain("routines: false");
    });

    it("should return structured error for EVENT privilege errors", async () => {
      setupMockSpawn("", "You do not have the EVENT privilege", 1);

      const tool = createShellDumpSchemasTool();
      const result = (await tool.handler(
        {
          schemas: ["db1"],
          outputDir: "/backup",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing privileges");
      expect(result.hint).toContain("ddlOnly: true");
    });

    it("should return structured error for TRIGGER privilege errors", async () => {
      setupMockSpawn("", "TRIGGER privilege required", 1);

      const tool = createShellDumpSchemasTool();
      const result = (await tool.handler(
        {
          schemas: ["db1"],
          outputDir: "/backup",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing privileges");
      expect(result.hint).toContain("ddlOnly: true");
    });

    it("should return structured error for generic privilege errors", async () => {
      setupMockSpawn("", "Access denied - privilege required", 1);

      const tool = createShellDumpSchemasTool();
      const result = (await tool.handler(
        {
          schemas: ["db1"],
          outputDir: "/backup",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing privileges");
      expect(result.hint).toContain("ddlOnly: true");
    });

    it("should return structured error for non-privilege errors", async () => {
      setupMockSpawn("", "Table not found", 1);

      const tool = createShellDumpSchemasTool();
      const result = (await tool.handler(
        {
          schemas: ["db1"],
          outputDir: "/backup",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Table not found");
    });

    it("should return structured error for empty schemas array", async () => {
      const tool = createShellDumpSchemasTool();
      const result = (await tool.handler(
        {
          schemas: [],
          outputDir: "/backup",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("At least one schema name is required");
    });
  });

  describe("mysqlsh_dump_tables", () => {
    it("should dump tables with options", async () => {
      const successJson = JSON.stringify({
        success: true,
        result: { status: "Completed" },
      });
      setupMockSpawn(successJson);

      const tool = createShellDumpTablesTool();
      const result = (await tool.handler(
        {
          schema: "db1",
          tables: ["t1"],
          outputDir: "/backup/tables",
          where: { t1: "id > 100" },
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(true);

      const jsArg = mockSpawn.mock.calls[0][1][4];
      expect(jsArg).toContain(
        'util.dumpTables("db1", ["t1"], "/backup/tables"',
      );
      expect(jsArg).toContain('where: { "t1": "id > 100" }');
    });

    it("should support compression option", async () => {
      setupMockSpawn(JSON.stringify({ success: true }));
      const tool = createShellDumpTablesTool();
      await tool.handler(
        {
          schema: "s",
          tables: ["t"],
          outputDir: "/o",
          compression: "none",
        },
        mockContext,
      );

      const jsArg = mockSpawn.mock.calls[0][1][4];
      expect(jsArg).toContain('compression: "none"');
    });

    it("should disable triggers when all=false (default)", async () => {
      setupMockSpawn(JSON.stringify({ success: true }));
      const tool = createShellDumpTablesTool();
      const result = (await tool.handler(
        {
          schema: "s",
          tables: ["t"],
          outputDir: "/o",
        },
        mockContext,
      )) as any;

      expect(result.triggersExcluded).toBe(true);

      const jsArg = mockSpawn.mock.calls[0][1][4];
      expect(jsArg).toContain("triggers: false");
    });

    it("should include triggers when all=true", async () => {
      setupMockSpawn(JSON.stringify({ success: true }));
      const tool = createShellDumpTablesTool();
      const result = (await tool.handler(
        {
          schema: "s",
          tables: ["t"],
          outputDir: "/o",
          all: true,
        },
        mockContext,
      )) as any;

      expect(result.triggersExcluded).toBe(false);

      const jsArg = mockSpawn.mock.calls[0][1][4];
      expect(jsArg).not.toContain("triggers: false");
    });

    it("should return structured error for privilege errors", async () => {
      setupMockSpawn("", "Access denied - privilege required", 1);

      const tool = createShellDumpTablesTool();
      const result = (await tool.handler(
        {
          schema: "s",
          tables: ["t"],
          outputDir: "/o",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing privileges");
      expect(result.hint).toContain("all: false");
    });

    it("should return structured error for TRIGGER privilege errors", async () => {
      setupMockSpawn("", "TRIGGER privilege required", 1);

      const tool = createShellDumpTablesTool();
      const result = (await tool.handler(
        {
          schema: "s",
          tables: ["t"],
          outputDir: "/o",
          all: true,
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing privileges");
      expect(result.hint).toContain("all: false");
    });

    it("should return structured error for Fatal error during dump", async () => {
      setupMockSpawn("", "Fatal error during dump occurred", 1);

      const tool = createShellDumpTablesTool();
      const result = (await tool.handler(
        {
          schema: "s",
          tables: ["t"],
          outputDir: "/o",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Fatal error during dump");
      expect(result.hint).toContain("all: false");
    });

    it("should return structured error for non-privilege errors", async () => {
      setupMockSpawn("", "Connection timeout", 1);

      const tool = createShellDumpTablesTool();
      const result = (await tool.handler(
        {
          schema: "s",
          tables: ["t"],
          outputDir: "/o",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection timeout");
    });

    it("should return structured error for empty tables array", async () => {
      const tool = createShellDumpTablesTool();
      const result = (await tool.handler(
        {
          schema: "s",
          tables: [],
          outputDir: "/o",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("At least one table name is required");
    });
  });
});
