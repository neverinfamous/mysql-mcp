/**
 * CLI output helpers — coloured stderr output via picocolors.
 *
 * All functions write to stderr so that stdout remains clean
 * for MCP stdio transport.
 */
import pc from "picocolors";

/** Print a red error message with an optional hint on the next line. */
export function cliError(message: string, hint?: string): void {
  process.stderr.write(`${pc.red("✖")} ${pc.red(pc.bold(message))}\n`);
  if (hint) {
    process.stderr.write(`  ${pc.dim(hint)}\n`);
  }
}

/** Print a yellow warning message. */
export function cliWarn(message: string): void {
  process.stderr.write(`${pc.yellow("⚠")} ${pc.yellow(message)}\n`);
}

/** Print a dim informational message. */
export function cliInfo(message: string): void {
  process.stderr.write(`${pc.dim(message)}\n`);
}

/** Print the server version string. */
export function cliVersion(version: string): void {
  process.stderr.write(`mysql-mcp ${pc.green(pc.bold(`v${version}`))}\n`);
}

/**
 * Print a fatal error and exit the process.
 *
 * Optionally includes the underlying error details if provided.
 */
export function cliFatal(message: string, error?: unknown): never {
  cliError(message);
  if (error instanceof Error) {
    process.stderr.write(`  ${pc.dim(error.message)}\n`);
  } else if (typeof error === "string" || typeof error === "number") {
    process.stderr.write(`  ${pc.dim(String(error))}\n`);
  }
  process.exit(1);
}
