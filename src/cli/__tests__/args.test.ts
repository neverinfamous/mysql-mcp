import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseArgs } from "../args/index.js";
import fs from "node:fs";

vi.mock("node:fs", () => ({
  default: { readFileSync: vi.fn(), promises: { readFile: vi.fn() } }
}));
vi.mock("yaml", () => ({
  default: { parse: vi.fn() }
}));

// Mock process.exit
vi.spyOn(process, "exit").mockImplementation(
  (code?: number | string | null | undefined) => {
    throw new Error(`process.exit(${code})`);
  },
);

// Mock console.error
const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});

describe("CLI Args", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    delete process.env["MYSQL_HOST"];
    delete process.env["MYSQL_USER"];
    delete process.env["MYSQL_PASSWORD"];
    delete process.env["MYSQL_DATABASE"];
    delete process.env["MYSQL_PORT"];
    delete process.env["MYSQL_POOL_SIZE"];
    delete process.env["MYSQL_POOL_TIMEOUT"];
    delete process.env["MYSQL_POOL_QUEUE_LIMIT"];

    delete process.env["OAUTH_ENABLED"];
  });

  describe("parseArgs", () => {
    it("should parse mysql connection string flag", async () => {
      const result = await parseArgs(["--mysql", "mysql://user:pass@host:3306/db"]);
      expect(result.databases).toHaveLength(1);
      expect(result.databases[0]).toMatchObject({
        host: "host",
        username: "user",
        password: "pass",
        database: "db",
        port: 3306,
      });
    });

    it("should parse individual mysql flags", async () => {
      const result = await parseArgs([
        "--mysql-host",
        "localhost",
        "--mysql-user",
        "root",
        "--mysql-password",
        "secret",
        "--mysql-database",
        "testdb",
        "--mysql-port",
        "3307",
      ]);
      expect(result.databases).toHaveLength(1);
      expect(result.databases[0]).toMatchObject({
        host: "localhost",
        username: "root",
        password: "secret",
        database: "testdb",
        port: 3307,
      });
    });

    it("should use environment variables for fallback", async () => {
      vi.stubEnv("MYSQL_HOST", "env-host");
      vi.stubEnv("MYSQL_USER", "env-user");

      const result = await parseArgs([]);
      // Partial config won't create a database entry unless user AND database are present
      expect(result.databases).toHaveLength(0);

      vi.unstubAllEnvs();
    });

    it("should print help and exit when --help flag is used", async () => {
      const result = await parseArgs(["--help"]);
      expect(result.shouldExit).toBe(true);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Usage: mysql-mcp [options]"),
      );
    });

    it("should print help and exit when -h flag is used", async () => {
      const result = await parseArgs(["-h"]);
      expect(result.shouldExit).toBe(true);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Usage: mysql-mcp [options]"),
      );
    });

    it("should use TOOL_FILTER environment variable", async () => {
      vi.stubEnv("TOOL_FILTER", "-admin");
      const result = await parseArgs([]);
      expect(result.config.toolFilter).toBe("-admin");
      vi.unstubAllEnvs();
    });



    it("should load oauth config from environment variables", async () => {
      vi.stubEnv("OAUTH_ENABLED", "true");
      vi.stubEnv("OAUTH_ISSUER", "https://env-issuer.com");
      vi.stubEnv("OAUTH_AUDIENCE", "env-aud");
      vi.stubEnv("OAUTH_JWKS_URI", "https://jwks");
      vi.stubEnv("OAUTH_CLOCK_TOLERANCE", "120");

      const result = await parseArgs([]);

      expect(result.oauth).toBeDefined();
      expect(result.oauth?.enabled).toBe(true);
      expect(result.oauth?.issuer).toBe("https://env-issuer.com");
      expect(result.oauth?.audience).toBe("env-aud");
      expect(result.oauth?.jwksUri).toBe("https://jwks");
      expect(result.oauth?.clockTolerance).toBe(120);

      vi.unstubAllEnvs();
    });

    it("should build database config from environment variables if no arguments provided", async () => {
      vi.stubEnv("MYSQL_HOST", "env-host");
      vi.stubEnv("MYSQL_USER", "env-user");
      vi.stubEnv("MYSQL_PASSWORD", "env-pass");
      vi.stubEnv("MYSQL_DATABASE", "env-db");
      vi.stubEnv("MYSQL_PORT", "3307");
      vi.stubEnv("MYSQL_POOL_SIZE", "20");

      const result = await parseArgs([]);
      expect(result.databases).toHaveLength(1);
      expect(result.databases[0]).toEqual(
        expect.objectContaining({
          host: "env-host",
          username: "env-user",
          port: 3307,
          database: "env-db",
        }),
      );
      expect(result.databases[0].pool?.connectionLimit).toBe(20);

      vi.unstubAllEnvs();
    });

    it("should parse transport flags", async () => {
      const result = await parseArgs(["--transport", "sse", "--port", "8080"]);
      expect(result.config.transport).toBe("sse");
      expect(result.config.port).toBe(8080);

      const resultShort = await parseArgs(["-t", "http", "-p", "9090"]);
      expect(resultShort.config.transport).toBe("http");
      expect(resultShort.config.port).toBe(9090);
    });

    it("should parse pool config flags", async () => {
      vi.stubEnv("MYSQL_HOST", "localhost");
      vi.stubEnv("MYSQL_USER", "user");
      vi.stubEnv("MYSQL_DATABASE", "db");

      const resultEnv = await parseArgs([
        "--pool-size",
        "25",
        "--pool-timeout",
        "6000",
        "--pool-queue-limit",
        "150",
      ]);

      expect(resultEnv.databases[0].pool?.connectionLimit).toBe(25);
      expect(resultEnv.databases[0].pool?.acquireTimeout).toBe(6000);
      expect(resultEnv.databases[0].pool?.queueLimit).toBe(150);

      vi.unstubAllEnvs();
    });

    it("should parse OAuth flags", async () => {
      const result = await parseArgs([
        "--oauth-enabled",
        "--oauth-issuer",
        "https://auth.com",
        "--oauth-audience",
        "api",
        "--oauth-jwks-uri",
        "https://jwks",
        "--oauth-clock-tolerance",
        "30",
      ]);

      expect(result.oauth).toBeDefined();
      expect(result.oauth?.enabled).toBe(true);
      expect(result.oauth?.issuer).toBe("https://auth.com");
      expect(result.oauth?.audience).toBe("api");
      expect(result.oauth?.jwksUri).toBe("https://jwks");
      expect(result.oauth?.clockTolerance).toBe(30);
    });

    it("should exit error if value argument looks like a flag", async () => {
      // Case: --mysql-user -flag
      await expect(parseArgs(["--mysql-user", "-flag"])).rejects.toThrow(
        "process.exit(1)",
      );
    });

    it("should NOT add database if required fields are missing despite some being present", async () => {
      // Case: Host provided, but User missing in both CLI and Env
      vi.stubEnv("MYSQL_DATABASE", "env-db");
      // No MYSQL_USER

      const result = await parseArgs(["--mysql-host", "cli-host"]);
      expect(result.databases).toHaveLength(0);

      vi.unstubAllEnvs();
    });

    it("should fallback to localhost if MYSQL_HOST is missing but others are present", async () => {
      vi.stubEnv("MYSQL_USER", "env-user");
      vi.stubEnv("MYSQL_DATABASE", "env-db");
      // No MYSQL_HOST

      const result = await parseArgs(["--mysql-user", "cli-user"]);

      expect(result.databases[0].host).toBe("localhost");
      expect(result.databases[0].username).toBe("cli-user");

      vi.unstubAllEnvs();
    });

    it("should parse --version flag", async () => {
      const result = await parseArgs(["--version"]);
      expect(result.shouldExit).toBe(true);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("mysql-mcp version"),
      );
    });

    it("should print help when --help flag is used", async () => {
      const result = await parseArgs(["--help"]);
      expect(result.shouldExit).toBe(true);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Usage: mysql-mcp [options]"),
      );
    });

    it("should parse server options", async () => {
      const result = await parseArgs([
        "--server-host",
        "0.0.0.0",
        "--name",
        "custom-server",
        "--auth-token",
        "secret-token",
        "--stateless",
        "--enable-hsts",
        "--trust-proxy",
      ]);
      expect(result.config.host).toBe("0.0.0.0");
      expect(result.config.name).toBe("custom-server");
      expect(result.config.authToken).toBe("secret-token");
      expect(result.config.stateless).toBe(true);
      expect(result.config.enableHSTS).toBe(true);
      expect(result.config.trustProxy).toBe(true);
    });

    it("should parse log level", async () => {
      await parseArgs(["--log-level", "warn"]);
      // It sets logger internally, we just test it parses without error
      expect(true).toBe(true);
    });

    it("should parse audit options", async () => {
      const result = await parseArgs([
        "--audit-log",
        "/path/to/audit.jsonl",
        "--audit-redact",
        "--audit-reads",
        "--audit-log-max-size",
        "1024",
        "--audit-backup",
        "--audit-backup-data",
        "--audit-backup-max-size",
        "2048",
      ]);
      expect(result.config.auditConfig?.enabled).toBe(true);
      expect(result.config.auditConfig?.logPath).toBe("/path/to/audit.jsonl");
      expect(result.config.auditConfig?.redact).toBe(true);
      expect(result.config.auditConfig?.auditReads).toBe(true);
      expect(result.config.auditConfig?.maxSizeBytes).toBe(1024);
      expect(result.config.auditConfig?.backup?.enabled).toBe(true);
      expect(result.config.auditConfig?.backup?.includeData).toBe(true);
      expect(result.config.auditConfig?.backup?.maxDataSizeBytes).toBe(2048);
    });

    it("should use environment variables for remaining options", async () => {
      vi.stubEnv("MCP_HOST", "127.0.0.1");
      vi.stubEnv("MCP_AUTH_TOKEN", "env-token");
      vi.stubEnv("TRUST_PROXY", "true");
      vi.stubEnv("MCP_ENABLE_HSTS", "true");

      const result = await parseArgs([]);

      expect(result.config.host).toBe("127.0.0.1");
      expect(result.config.authToken).toBe("env-token");
      expect(result.config.trustProxy).toBe(true);
      expect(result.config.enableHSTS).toBe(true);


      vi.unstubAllEnvs();
    });

    it("should parse configuration file from --config", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        host: "file-host",
        databases: [{ type: "mysql", database: "file-db", username: "file-user" }]
      }));

      const result = await parseArgs(["--config", "config.json"]);

      expect(fs.promises.readFile).toHaveBeenCalledWith("config.json", "utf-8");
      expect(result.config.host).toBe("file-host");
      expect(result.databases).toHaveLength(1);
      expect(result.databases[0].database).toBe("file-db");
    });

    it("should parse YAML configuration file from --config", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue("host: yaml-host\n");
      const yamlParseMock = vi.mocked((await import("yaml")).default.parse).mockReturnValue({ host: "yaml-host" });

      const result = await parseArgs(["--config", "config.yaml"]);

      expect(fs.promises.readFile).toHaveBeenCalledWith("config.yaml", "utf-8");
      expect(yamlParseMock).toHaveBeenCalledWith("host: yaml-host\n");
      expect(result.config.host).toBe("yaml-host");
    });

    it("should exit when configuration file fails to load", async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValue(new Error("File not found"));

      await expect(parseArgs(["--config", "config.json"])).rejects.toThrow("process.exit(1)");
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it("should prefer CLI over ENV over FILE", async () => {
      // 1. FILE config
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        host: "file-host",
        databases: [{ type: "mysql", database: "file-db", username: "file-user" }]
      }));

      // 2. ENV config
      vi.stubEnv("MCP_HOST", "env-host");
      vi.stubEnv("MYSQL_DATABASE", "env-db");
      vi.stubEnv("MYSQL_USER", "env-user");
      vi.stubEnv("MYSQL_HOST", "localhost"); // required for db creation from env

      // 3. CLI args
      const result = await parseArgs(["--config", "config.json", "--mysql-database", "cli-db", "--mysql-user", "cli-user"]);

      // CLI should win over ENV, and ENV should win over FILE
      // For config.host: ENV is set, CLI is not, so ENV should win
      expect(result.config.host).toBe("env-host");

      // For databases: databases are not merged at the field level, but at the array level.
      // Since CLI databases are present, CLI array should be used entirely.
      expect(result.databases).toHaveLength(1);
      expect(result.databases[0].database).toBe("cli-db");
      expect(result.databases[0].username).toBe("cli-user");

      vi.unstubAllEnvs();
    });

    it("should set dumpConfig true", async () => {
      const result = await parseArgs(["--dump-config"]);
      expect(result.dumpConfig).toBe(true);
    });
  });
});
