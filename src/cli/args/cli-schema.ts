/**
 * Zod boundary schema for validated CLI arguments.
 *
 * Coerces raw string values from `util.parseArgs` into their
 * typed equivalents. Only validates shape and type — deeper
 * business logic lives in the config loaders.
 */
import { z } from "zod/v4";

const transportSchema = z.enum(["stdio", "http", "sse"]);

const logLevelSchema = z.enum(["debug", "info", "warning", "error"]);

/**
 * Raw CLI args schema — all fields optional because every flag is opt-in.
 */
const cliArgsSchema = z
  .object({
    // Connection
    mysql: z.array(z.string()).optional(),
    "mysql-host": z.string().optional(),
    "mysql-port": z.coerce.number().int().positive().optional(),
    "mysql-user": z.string().optional(),
    "mysql-password": z.string().optional(),
    "mysql-database": z.string().optional(),

    // Pool
    "pool-size": z.coerce.number().int().positive().optional(),
    "pool-timeout": z.coerce.number().int().nonnegative().optional(),
    "pool-queue-limit": z.coerce.number().int().nonnegative().optional(),

    // Server
    config: z.string().optional(),
    "dump-config": z.boolean().optional(),
    transport: transportSchema.optional(),
    port: z.coerce.number().int().positive().optional(),
    "server-host": z.string().optional(),
    "tool-filter": z.string().optional(),
    name: z.string().optional(),

    // OAuth
    "oauth-enabled": z.boolean().optional(),
    "oauth-issuer": z.string().optional(),
    "oauth-audience": z.string().optional(),
    "oauth-jwks-uri": z.string().optional(),
    "oauth-clock-tolerance": z.coerce.number().int().nonnegative().optional(),

    // Security
    "auth-token": z.string().optional(),
    stateless: z.boolean().optional(),
    "enable-hsts": z.boolean().optional(),
    "trust-proxy": z.boolean().optional(),
    "log-level": logLevelSchema.optional(),
    "metrics-export": z.string().optional(),

    // Audit
    "audit-log": z.string().optional(),
    "audit-redact": z.boolean().optional(),
    "audit-reads": z.boolean().optional(),
    "audit-log-max-size": z.coerce.number().int().nonnegative().optional(),
    "audit-backup": z.boolean().optional(),
    "audit-backup-data": z.boolean().optional(),
    "audit-backup-max-size": z.coerce.number().int().nonnegative().optional(),

    // I/O
    "allowed-io-roots": z.string().optional(),

    // Other
    version: z.boolean().optional(),
    help: z.boolean().optional(),
    json: z.boolean().optional(),
  })
  .partial();

/** Validated CLI args with coerced types. */
export type ValidatedCliArgs = z.infer<typeof cliArgsSchema>;

/**
 * Validate and coerce raw `util.parseArgs` values.
 *
 * @param values - The `values` object returned by `util.parseArgs`.
 * @returns Typed, validated CLI arguments.
 * @throws {z.ZodError} on validation failure.
 */
export function validateCliArgs(
  values: Record<string, string | boolean | string[] | undefined>,
): ValidatedCliArgs {
  // Normalise "warn" → "warning" before Zod sees the value
  const raw = { ...values };
  if (typeof raw["log-level"] === "string" && raw["log-level"].toLowerCase() === "warn") {
    raw["log-level"] = "warning";
  }

  // Normalise transport to lowercase
  if (typeof raw["transport"] === "string") {
    raw["transport"] = raw["transport"].toLowerCase();
  }

  return cliArgsSchema.parse(raw);
}
