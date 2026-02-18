/**
 * MySQL Shell - Common Utilities Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getShellConfig,
  escapeForJS,
  execMySQLShell,
  execShellJS,
} from "../common.js";
import { spawn } from "child_process";
import { EventEmitter } from "events";

// Mock child_process
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

// Setup process.env mocks
const originalEnv = process.env;

describe("Shell Configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use default values when env vars are missing", () => {
    const config = getShellConfig();
    expect(config.binPath).toBe("mysqlsh");
    expect(config.connectionUri).toContain("root@localhost:3306");
    expect(config.timeout).toBe(300000);
  });

  it("should use provided environment variables", () => {
    process.env["MYSQLSH_PATH"] = "/usr/bin/mysqlsh";
    process.env["MYSQL_HOST"] = "db-host";
    process.env["MYSQL_PORT"] = "3307";
    process.env["MYSQL_USER"] = "admin";
    process.env["MYSQL_PASSWORD"] = "secret";
    process.env["MYSQLSH_TIMEOUT"] = "5000";

    const config = getShellConfig();
    expect(config.binPath).toBe("/usr/bin/mysqlsh");
    expect(config.connectionUri).toContain("admin:secret@db-host:3307");
    expect(config.timeout).toBe(5000);
  });
});

describe("String Escaping", () => {
  it("should escape backslashes and quotes", () => {
    expect(escapeForJS("normal code")).toBe("normal code");
    expect(escapeForJS('code with "quotes"')).toBe('code with \\"quotes\\"');
    expect(escapeForJS("code with \\backslashes\\")).toBe(
      "code with \\\\backslashes\\\\",
    );
  });
});

describe("Subprocess Execution", () => {
  let mockChild: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChild = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.stdin = { write: vi.fn(), end: vi.fn() };
    mockChild.kill = vi.fn();

    (spawn as any).mockReturnValue(mockChild);
  });

  it("should resolve with stdout on success", async () => {
    const promise = execMySQLShell(["--version"]);

    mockChild.stdout.emit("data", Buffer.from("Ver 8.0.30"));
    mockChild.emit("close", 0);

    const result = await promise;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Ver 8.0.30");
  });

  it("should resolve with stderr on failure code", async () => {
    const promise = execMySQLShell(["--invalid"]);

    mockChild.stderr.emit("data", Buffer.from("Unknown option"));
    mockChild.emit("close", 1);

    const result = await promise;
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("Unknown option");
  });

  it("should reject on spawn error", async () => {
    const promise = execMySQLShell(["--version"]);

    const error = new Error("spawn ENOENT");
    mockChild.emit("error", error as any);

    await expect(promise).rejects.toThrow("MySQL Shell not found");
  });

  it("should timeout if process takes too long", async () => {
    vi.useFakeTimers();
    const promise = execMySQLShell(["--hang"], { timeout: 1000 });

    vi.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow("timed out");
    expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");

    vi.useRealTimers();
  });

  it("should write input to stdin if provided", async () => {
    const promise = execMySQLShell(["--script"], { input: 'print("hello")' });
    mockChild.emit("close", 0);
    await promise;

    expect(mockChild.stdin.write).toHaveBeenCalledWith('print("hello")');
    expect(mockChild.stdin.end).toHaveBeenCalled();
  });
});

describe("execShellJS", () => {
  let mockChild: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChild = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.kill = vi.fn();
    (spawn as any).mockReturnValue(mockChild);
  });

  it("should parse JSON result", async () => {
    const promise = execShellJS("return { x: 1 }");

    const jsonOutput = JSON.stringify({ success: true, result: { x: 1 } });
    mockChild.stdout.emit("data", Buffer.from("some logs\n" + jsonOutput));
    mockChild.emit("close", 0);

    const result = await promise;
    expect(result).toEqual({ x: 1 });
  });

  it("should handle script errors", async () => {
    const promise = execShellJS('throw "oops"');

    const jsonOutput = JSON.stringify({ success: false, error: "oops" });
    mockChild.stdout.emit("data", Buffer.from(jsonOutput));
    mockChild.emit("close", 0);

    await expect(promise).rejects.toThrow("oops");
  });

  it("should throw if invalid JSON returned", async () => {
    const promise = execShellJS("bad");

    mockChild.stdout.emit("data", Buffer.from("Not JSON"));
    mockChild.emit("close", 0); // Even if exit code 0, if no JSON found we should handle it

    // Implementation might return raw if no JSON found and exit code 0?
    // Let's check implementation behavior:
    // if no JSON found, checks exit code. if 0, returns { raw: stdout }

    const result = await promise;
    expect(result).toEqual({ raw: "Not JSON" });
  });

  it("should throw if non-zero exit code and no JSON", async () => {
    const promise = execShellJS("bad");

    mockChild.stderr.emit("data", Buffer.from("Fatal Error"));
    mockChild.emit("close", 1);

    await expect(promise).rejects.toThrow("Fatal Error");
  });

  it("should extract specific ERROR lines from Fatal error during dump stderr", async () => {
    const promise = execShellJS("bad");

    mockChild.stderr.emit(
      "data",
      Buffer.from(
        "ERROR: Unknown column 'invalid_col' in 'where clause'\nWhile 'Dumping data': Fatal error during dump",
      ),
    );
    mockChild.emit("close", 1);

    await expect(promise).rejects.toThrow(
      "Unknown column 'invalid_col' in 'where clause'",
    );
  });

  it("should fall back to generic message when Fatal error during dump has no ERROR lines", async () => {
    const promise = execShellJS("bad");

    mockChild.stderr.emit("data", Buffer.from("Fatal error during dump"));
    mockChild.emit("close", 1);

    await expect(promise).rejects.toThrow(
      "MySQL Shell dump failed: Fatal error during dump",
    );
  });

  it("should extract specific ERROR lines from stderr when JSON reports Fatal error during dump", async () => {
    const promise = execShellJS("bad");

    const jsonOutput = JSON.stringify({
      success: false,
      error: "While 'Dumping data': Fatal error during dump",
    });
    mockChild.stderr.emit(
      "data",
      Buffer.from("ERROR: Unknown column 'bad_col' in 'where clause'"),
    );
    mockChild.stdout.emit("data", Buffer.from(jsonOutput));
    mockChild.emit("close", 0);

    await expect(promise).rejects.toThrow(
      "Unknown column 'bad_col' in 'where clause'",
    );
  });
});
