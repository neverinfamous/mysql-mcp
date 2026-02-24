/**
 * MySQL Security - Encryption and SSL Tools
 *
 * Tools for SSL/TLS monitoring, encryption status, and password validation.
 */

import { z, ZodError } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

// =============================================================================
// Helpers
// =============================================================================

/** Extract human-readable messages from a ZodError instead of raw JSON array */
function formatZodError(error: ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}

/** Strip verbose adapter prefixes from error messages */
function stripErrorPrefix(msg: string): string {
  return msg
    .replace(/^Query failed:\s*/i, "")
    .replace(/^Execute failed:\s*/i, "")
    .trim();
}

// =============================================================================
// Zod Schemas
// =============================================================================

const PasswordValidateSchema = z.object({
  password: z.string().describe("Password to validate"),
});

// =============================================================================
// Tool Creation Functions
// =============================================================================

/**
 * Get SSL/TLS connection status
 */
export function createSecuritySSLStatusTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_security_ssl_status",
    title: "MySQL SSL Status",
    description: "Get SSL/TLS connection and certificate status.",
    group: "security",
    inputSchema: z.object({}),
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        // Get SSL status
        const statusResult = await adapter.executeQuery(
          "SHOW STATUS LIKE 'Ssl%'",
        );

        const status: Record<string, unknown> = Object.fromEntries(
          (statusResult.rows ?? []).map((r) => {
            const record = r;
            const varName =
              typeof record["Variable_name"] === "string"
                ? record["Variable_name"]
                : "";
            return [varName, record["Value"]];
          }),
        );

        // Get SSL variables
        const varsResult = await adapter.executeQuery(
          "SHOW VARIABLES LIKE '%ssl%'",
        );

        const variables: Record<string, unknown> = Object.fromEntries(
          (varsResult.rows ?? []).map((r) => {
            const record = r;
            const varName =
              typeof record["Variable_name"] === "string"
                ? record["Variable_name"]
                : "";
            return [varName, record["Value"]];
          }),
        );

        // Helper to safely extract string values
        const str = (val: unknown, defaultVal = ""): string =>
          typeof val === "string" ? val : defaultVal;

        return {
          sslEnabled: str(status["Ssl_cipher"]) !== "",
          currentCipher: str(status["Ssl_cipher"], "None"),
          sslVersion: str(status["Ssl_version"], "N/A"),
          serverCertVerification: false, // Unknown in recent versions via variables
          configuration: {
            sslCa: str(variables["ssl_ca"]),
            sslCert: str(variables["ssl_cert"]),
            sslKey: str(variables["ssl_key"]),
            requireSecureTransport: str(
              variables["require_secure_transport"],
              "OFF",
            ),
          },
          sessionStats: {
            acceptedConnects: str(status["Ssl_accepts"], "0"),
            finishedConnects: str(status["Ssl_finished_accepts"], "0"),
          },
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: stripErrorPrefix(message) };
      }
    },
  };
}

/**
 * Check encryption status
 */
export function createSecurityEncryptionStatusTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_security_encryption_status",
    title: "MySQL Encryption Status",
    description: "Get Transparent Data Encryption (TDE) and keyring status.",
    group: "security",
    inputSchema: z.object({}),
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        // Check for keyring plugins
        const keyringResult = await adapter.executeQuery(`
                SELECT PLUGIN_NAME, PLUGIN_STATUS
                FROM information_schema.PLUGINS
                WHERE PLUGIN_NAME LIKE 'keyring%'
            `);

        // Check encrypted tablespaces
        const tablespaceResult = await adapter.executeQuery(`
                SELECT 
                    NAME,
                    ENCRYPTION
                FROM information_schema.INNODB_TABLESPACES
                WHERE ENCRYPTION = 'Y'
            `);

        // Check encryption variables
        const varsResult = await adapter.executeQuery(
          "SHOW VARIABLES LIKE '%encrypt%'",
        );

        const variables: Record<string, unknown> = Object.fromEntries(
          (varsResult.rows ?? []).map((r) => {
            const record = r;
            const varName =
              typeof record["Variable_name"] === "string"
                ? record["Variable_name"]
                : "";
            return [varName, record["Value"]];
          }),
        );

        // Check redo/undo log encryption
        const innodbVarsResult = await adapter.executeQuery(
          "SHOW VARIABLES LIKE 'innodb_%encrypt%'",
        );

        const innodbVars: Record<string, unknown> = Object.fromEntries(
          (innodbVarsResult.rows ?? []).map((r) => {
            const record = r;
            const varName =
              typeof record["Variable_name"] === "string"
                ? record["Variable_name"]
                : "";
            return [varName, record["Value"]];
          }),
        );

        return {
          keyringPlugins: keyringResult.rows ?? [],
          keyringInstalled: (keyringResult.rows?.length ?? 0) > 0,
          encryptedTablespaces: tablespaceResult.rows ?? [],
          encryptedTablespaceCount: tablespaceResult.rows?.length ?? 0,
          encryptionSettings: {
            ...variables,
            ...innodbVars,
          },
          tdeAvailable: (keyringResult.rows?.length ?? 0) > 0,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: stripErrorPrefix(message) };
      }
    },
  };
}

/**
 * Validate password strength
 */
export function createSecurityPasswordValidateTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_security_password_validate",
    title: "MySQL Password Validation",
    description:
      "Validate password strength using MySQL validate_password component.",
    group: "security",
    inputSchema: PasswordValidateSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { password } = PasswordValidateSchema.parse(params);

        // First check if validate_password component is installed
        // by checking for its variables
        const policyResult = await adapter.executeQuery(
          "SHOW VARIABLES LIKE 'validate_password%'",
        );

        const policy: Record<string, unknown> = Object.fromEntries(
          (policyResult.rows ?? []).map((r) => {
            const record = r;
            const varName =
              typeof record["Variable_name"] === "string"
                ? record["Variable_name"]
                : "";
            return [varName, record["Value"]];
          }),
        );

        // If no validate_password variables exist, component is not installed
        if (Object.keys(policy).length === 0) {
          return {
            available: false,
            message: "Password validation component not installed",
            suggestion:
              'Install with: INSTALL COMPONENT "file://component_validate_password"',
          };
        }

        // Use validate_password function
        const result = await adapter.executeQuery(
          "SELECT VALIDATE_PASSWORD_STRENGTH(?) as strength",
          [password],
        );

        const row = result.rows?.[0];
        const strength = (row?.["strength"] as number) ?? 0;

        let interpretation: string;
        if (strength >= 100) interpretation = "Very Strong";
        else if (strength >= 75) interpretation = "Strong";
        else if (strength >= 50) interpretation = "Medium";
        else if (strength >= 25) interpretation = "Weak";
        else interpretation = "Very Weak";

        return {
          strength,
          interpretation,
          meetsPolicy: strength >= 50, // General guideline
          policy,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        const message = error instanceof Error ? error.message : String(error);
        // Check for known component-not-installed errors
        const lower = message.toLowerCase();
        if (
          lower.includes("validate_password_strength") ||
          lower.includes("function")
        ) {
          return {
            available: false,
            message: "Password validation function failed",
            suggestion:
              'Reinstall with: INSTALL COMPONENT "file://component_validate_password"',
          };
        }
        return { success: false, error: stripErrorPrefix(message) };
      }
    },
  };
}
