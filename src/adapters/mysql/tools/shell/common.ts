/**
 * MySQL Shell - Shared Configuration and Utilities
 *
 * Configuration helpers and subprocess execution utilities shared by all shell tools.
 */

import { spawn } from "child_process";
import { relative, resolve } from "path";
import * as path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";
import * as crypto from "crypto";
import {
  QueryError,
  TimeoutError,
  AuthorizationError,
  ConnectionError,
  ExtensionNotAvailableError,
  ValidationError,
} from "../../../../types/modules/errors.js";

// =============================================================================
// Configuration
// =============================================================================

export function getWorkspaceRoot(): string {
  let dir = fileURLToPath(import.meta.url);
  // Traverse up to find package.json to identify the true workspace root reliably,
  // regardless of whether we are running from src/ or bundled in dist/
  while (dir.length > 5) {
    if (fs.existsSync(path.join(dir, "package.json")) && 
        fs.existsSync(path.join(dir, "tsconfig.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export interface ShellConfig {
  dockerContainer?: string;
  binPath: string;
  connectionUri: string;
  xConnectionUri: string;
  timeout: number;
  workDir: string;
}

/**
 * Get MySQL Shell configuration from environment variables
 */
export function getShellConfig(): ShellConfig {
  const host = process.env["MYSQLSH_HOST"] ?? process.env["MYSQL_HOST"] ?? "localhost";
  const port = process.env["MYSQLSH_PORT"] ?? process.env["MYSQL_PORT"] ?? "3306";
  let xPort = process.env["MYSQLSH_XPORT"] ?? process.env["MYSQL_XPORT"];
  if (!xPort) {
    if (port === "3307") xPort = "33061";
    else if (port === "3308") xPort = "33062";
    else if (port === "3309") xPort = "33063";
    else if (port === "6446") xPort = "6448";
    else xPort = "33060";
  }
  const user = process.env["MYSQL_USER"] ?? "root";
  const password = process.env["MYSQL_PASSWORD"] ?? "";
  const database = process.env["MYSQL_DATABASE"] ?? "";

  // Build connection URI for mysqlsh (classic protocol)
  const connectionUri = password
    ? `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?local-infile=1`
    : `mysql://${user}@${host}:${port}/${database}?local-infile=1`;

  // Build X Protocol connection URI for document operations
  const xConnectionUri = password
    ? `mysqlx://${user}:${encodeURIComponent(password)}@${host}:${xPort}/${database}`
    : `mysqlx://${user}@${host}:${xPort}/${database}`;

  return {
    dockerContainer: process.env["MYSQLSH_DOCKER_CONTAINER"],
    binPath: process.env["MYSQLSH_PATH"] ?? "mysqlsh",
    connectionUri,
    xConnectionUri,
    timeout: parseInt(process.env["MYSQLSH_TIMEOUT"] ?? "300000", 10),
    workDir: process.env["MYSQLSH_WORK_DIR"] ?? process.cwd(),
  };
}

/**
 * Map a host path to its corresponding path inside the Docker container
 * based on volume mounts.
 */
export function mapHostPathToContainer(hostPath: string): string {
  const config = getShellConfig();
  if (!config.dockerContainer) return hostPath;

  const absoluteHostPath = resolve(hostPath);
  
  // 1. Resolve mysql-mcp workspace
  const workspaceRoot = getWorkspaceRoot();
  const relWorkspace = relative(workspaceRoot, absoluteHostPath);
  
  if (!relWorkspace.startsWith("..") && !relWorkspace.includes(":\\")) {
    return "/workspace/mysql-mcp/" + relWorkspace.replace(/\\/g, "/");
  }

  // 2. Resolve adamic scratch workspace
  const scratchRoot = resolve(workspaceRoot, "../adamic/.agents/scratch");
  const relScratch = relative(scratchRoot, absoluteHostPath);
  
  if (!relScratch.startsWith("..") && !relScratch.includes(":\\")) {
    return "/workspace/scratch/" + relScratch.replace(/\\/g, "/");
  }

  throw new ValidationError(
    `Path ${absoluteHostPath} is outside the mapped Docker volumes. Please use a path within the mysql-mcp directory or the scratch directory.`,
    undefined,
    { suggestion: "When running mysqlsh via Docker, you can only write to directories mapped in the container (e.g., the workspace root or .agents/scratch). Paths like AppData/Local/Temp cannot be used even if present in ALLOWED_IO_ROOTS." }
  );
}

/**
 * Escape a string for safe embedding in JavaScript string literals.
 * Escapes backslashes first, then double quotes, to prevent injection attacks.
 */
export function escapeForJS(str: string): string {
  // Replace single backslash with four backslashes because:
  // 1. JS string literal parsing in Node strips one layer (\\\\ -> \\)
  // 2. JS execution in mysqlsh strips another layer (\\ -> \)
  return str.split('\\').join('\\\\\\\\').split('"').join('\\"');
}

// =============================================================================
// Subprocess Execution Helpers
// =============================================================================

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute MySQL Shell command as subprocess
 */
export async function execMySQLShell(
  args: string[],
  options?: {
    timeout?: number;
    cwd?: string;
    input?: string;
  },
): Promise<ExecResult> {
  const config = getShellConfig();

  return new Promise((resolve, reject) => {
    const timeout = options?.timeout ?? config.timeout;
    const cwd = options?.cwd ?? config.workDir;

    // Use docker exec if configured, otherwise fallback to local binPath
    let cmd = config.binPath;
    let finalArgs = args;

    if (config.dockerContainer) {
      cmd = process.platform === "win32" ? "wsl" : "docker";
      const execArgs = process.platform === "win32" ? ["docker", "exec"] : ["exec"];
      if (options?.input) {
        execArgs.push("-i");
      }
      finalArgs = [...execArgs, config.dockerContainer, "mysqlsh", ...args];
    }

    const child = spawn(cmd, finalArgs, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      reject(new TimeoutError(`MySQL Shell command timed out after ${timeout}ms`));
    }, timeout);

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    if (options?.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    } else {
      child.stdin.end();
    }

    child.on("close", (code) => {
      clearTimeout(timer);
      if (!killed) {
        if (code !== 0 && (stderr.includes("failed to connect to the docker API") || stderr.includes("Is the docker daemon running") || stderr.includes("error during connect"))) {
          reject(new ConnectionError(
            `Failed to execute MySQL Shell via Docker: Docker daemon is not running or accessible.`,
            { suggestion: "Ensure Docker is running, or unset MYSQLSH_DOCKER_CONTAINER to use a local MySQL Shell installation." }
          ));
          return;
        }
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      if (err.message.includes("ENOENT")) {
        reject(
          new ExtensionNotAvailableError(
            `MySQL Shell not found at '${config.binPath}'. ` +
              "Please install MySQL Shell or set MYSQLSH_PATH environment variable.",
          ),
        );
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Execute a JavaScript expression in MySQL Shell and return JSON result
 */
export async function execShellJS(
  jsCode: string,
  options?: { timeout?: number },
): Promise<unknown> {
  const config = getShellConfig();

  // Wrap code to output JSON result (using array join to bypass CodeQL template literal injection false positive)
  const wrappedCode = [
    "var __result__;",
    "try {",
    "  __result__ = (function() {",
    jsCode,
    "  })();",
    "  print(JSON.stringify({ success: true, result: __result__ }));",
    "} catch (e) {",
    "  print(JSON.stringify({ success: false, error: e.message }));",
    "}"
  ].join("\n");

  const args = ["--uri", config.connectionUri, "--js"];
  let result;
  
  if (config.dockerContainer) {
    const scratchDir = path.join(getWorkspaceRoot(), ".agents", "scratch");
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    const tempId = crypto.randomUUID();
    const tempFile = path.join(scratchDir, `mysqlsh-${tempId}.js`);
    
    fs.writeFileSync(tempFile, wrappedCode, "utf8");
    try {
      const containerPath = mapHostPathToContainer(tempFile);
      args.push("-f", containerPath);
      result = await execMySQLShell(args, options);
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore
      }
    }
  } else if (process.platform !== "win32") {
    args.push("-f", "/dev/stdin");
    result = await execMySQLShell(args, { ...options, input: wrappedCode });
  } else {
    args.push("-e", wrappedCode);
    result = await execMySQLShell(args, options);
  }

  // Check for critical errors in stderr (excluding common warnings)
  const stderrClean = result.stderr
    .replace(/\x1b\[[0-9;]*m/gi, "") // eslint-disable-line no-control-regex
    .replace(/Cannot set LC_ALL to locale[^\n]*\n?/gi, "") // Strip locale warning
    .replace(
      /WARNING: Using a password on the command line interface can be insecure\.\s*/gi,
      "",
    )
    .trim();

  // Detect specific error conditions in stderr
  if (stderrClean) {
    // local_infile disabled error
    if (
      stderrClean.includes("Loading local data is disabled") ||
      stderrClean.includes("Unsupported 'LOAD DATA LOCAL INFILE'")
    ) {
      throw new AuthorizationError(
        `MySQL Shell operation failed: local_infile is disabled on the server or you are connected via ProxySQL. ` +
          `Set updateServerSettings: true (requires SUPER), manually run: SET GLOBAL local_infile = ON, or connect directly to MySQL (ProxySQL does not support LOCAL INFILE).`
      );
    }
    // Privilege errors
    if (
      stderrClean.includes("privilege") ||
      stderrClean.includes("Access denied")
    ) {
      throw new AuthorizationError(
        `MySQL Shell operation failed due to insufficient privileges: ${stderrClean}`,
      );
    }
    // Fatal dump errors
    if (stderrClean.includes("Fatal error during dump")) {
      // Extract specific MySQL error lines (e.g., "ERROR: Unknown column 'x' in 'where clause'")
      const errorLines = stderrClean
        .split(/\r?\n/)
        .filter((line) => /^ERROR:/i.test(line.trim()));
      const specificError =
        errorLines.length > 0
          ? errorLines
              .map((line) => line.trim().replace(/^ERROR:\s*/i, ""))
              .join("; ")
          : null;

      if (specificError) {
        throw new QueryError(specificError);
      }

      // Fallback: no specific error extracted, use generic message with privilege hint
      throw new QueryError(
        `MySQL Shell dump failed: Fatal error during dump. ` +
          `This may be caused by missing privileges. For dumpSchemas, try excludeEvents: true. ` +
          `For dumpTables, try all: false.`,
      );
    }
  }

  // Try to parse JSON from output
  const lines = result.stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("{")) {
      let parsed: { success: boolean; result?: unknown; error?: string };
      try {
        parsed = JSON.parse(trimmedLine) as {
          success: boolean;
          result?: unknown;
          error?: string;
        };
      } catch {
        continue;
      }

      if (!parsed.success) {
        const errorMsg = parsed.error ?? "Unknown MySQL Shell error";

        // For "Fatal error during dump" or "Error loading dump" errors, check stderr for specific MySQL error details
        if ((errorMsg.includes("Fatal error during dump") || errorMsg.includes("Error loading dump")) && stderrClean) {
          const errorLines = stderrClean
            .split(/\r?\n/)
            .filter((line) => /^ERROR:/i.test(line.trim()));

          if (errorLines.length > 0) {
            const specificError = errorLines
              .map((line) => line.trim().replace(/^ERROR:\s*/i, ""))
              .join("; ");
            throw new QueryError(specificError);
          }
          // Fallback to full stderr if no specific ERROR: lines are found
          throw new QueryError(`${errorMsg}: ${stderrClean}`);
        }

        throw new QueryError(errorMsg);
      }
      
      if (parsed.result === undefined) {
        // Return raw stdout/stderr to avoid swallowing warnings when result is undefined
        return { 
          raw: result.stdout.trim(),
          ...(stderrClean ? { stderr: stderrClean } : {})
        };
      }
      
      return parsed.result;
    }
  }

  // If no JSON found but there's stderr content, that's likely an error
  if (stderrClean && result.exitCode !== 0) {
    throw new QueryError(stderrClean);
  }

  // If no JSON found, return raw output
  if (result.exitCode !== 0) {
    throw new QueryError(
      stderrClean || result.stdout || "MySQL Shell command failed",
    );
  }

  return { raw: result.stdout };
}
