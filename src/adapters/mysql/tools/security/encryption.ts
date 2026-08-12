/**
 * MySQL Security - Encryption and SSL Tools
 *
 * Tools for SSL/TLS monitoring, encryption status, and password validation.
 */

import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  SecuritySslStatusOutputSchema,
  SecurityEncryptionStatusOutputSchema,
  SecurityPasswordValidateOutputSchema,
} from "../../schemas/security.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";
import { ExtensionNotAvailableError } from "../../../../types/modules/errors.js";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Zod Schemas
// =============================================================================

const PasswordValidateSchemaBase = z.object({
  password: z.union([z.string(), z.number()]).optional().describe("Password to validate"),
  pass: z.union([z.string(), z.number()]).optional().describe("Alias for password"),
  pwd: z.union([z.string(), z.number()]).optional().describe("Alias for password"),
}).strict();

const PasswordValidateSchema = z.object({
  password: z.union([z.string(), z.number()]).describe("Password to validate").optional(),
  pass: z.union([z.string(), z.number()]).optional().describe("Alias for password"),
  pwd: z.union([z.string(), z.number()]).optional().describe("Alias for password"),
}).strict().transform((obj) => {
  const password = obj.password ?? obj.pass ?? obj.pwd;
  return { password: password !== undefined && password !== null ? String(password) : "" };


}).pipe(
  z.object({
    password: z.string().min(1, "Password cannot be empty")
  })
);

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
    inputSchema: z.object({}).strict().describe("Takes no arguments. Any passed arguments will be rejected."),
    outputSchema: SecuritySslStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        z.object({}).strict().parse(params);

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
          typeof val === "string" && val !== "" ? val : defaultVal;

        return withTokenEstimate({
          success: true,
          data: {
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
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err, { module: "security", tool: "mysql_security_ssl_status" });
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
    inputSchema: z.object({}).strict().describe("Takes no arguments. Any passed arguments will be rejected."),
    outputSchema: SecurityEncryptionStatusOutputSchema,
    requiredScopes: ["admin"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        z.object({}).strict().parse(params);

        // Check for keyring plugins
        const keyringResult = await adapter.executeQuery(`
                /* admin */ SELECT PLUGIN_NAME, PLUGIN_STATUS
                FROM information_schema.PLUGINS
                WHERE PLUGIN_NAME LIKE 'keyring%' AND PLUGIN_STATUS = 'ACTIVE'
            `);

        // Check encrypted tablespaces
        // Handle potentially missing ENCRYPTION column or table in some MySQL/MariaDB versions
        // and limit payload size
        let encryptedTablespaces: Record<string, unknown>[] = [];
        let encryptedTablespaceCount = 0;
        try {
          const tablespaceResult = await adapter.executeQuery(`
                  /* admin */ SELECT
                      NAME,
                      ENCRYPTION
                  FROM information_schema.INNODB_TABLESPACES
                  WHERE ENCRYPTION = 'Y'
                  LIMIT 100
              `);
          encryptedTablespaces = tablespaceResult.rows ?? [];

          const countResult = await adapter.executeQuery(`
                  /* admin */ SELECT COUNT(*) as cnt
                  FROM information_schema.INNODB_TABLESPACES
                  WHERE ENCRYPTION = 'Y'
              `);
          encryptedTablespaceCount = Number(countResult.rows?.[0]?.["cnt"] ?? encryptedTablespaces.length);
        } catch {
          // Ignore, table or column might not exist
        }

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


        return withTokenEstimate({
          success: true,
          data: {
            keyringPlugins: keyringResult.rows ?? [],
            keyringInstalled: (keyringResult.rows?.length ?? 0) > 0,
            encryptedTablespaces,
            encryptedTablespaceCount,
            encryptionSettings: variables,
            tdeAvailable: (keyringResult.rows?.length ?? 0) > 0,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err, { module: "security", tool: "mysql_security_encryption_status" });
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
      "Validate password strength using MySQL validate_password component. Note: Requires validate_password component to be installed.",
    group: "security",
    inputSchema: PasswordValidateSchemaBase,
    outputSchema: SecurityPasswordValidateOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
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

        if (Object.keys(policy).length === 0) {
          return formatHandlerErrorResponse(
            new ExtensionNotAvailableError("validate_password"),
            { module: "security", tool: "mysql_security_password_validate" }
          );
        }

        // Use validate_password function
        const result = await adapter.executeQuery(
          "/* admin */ SELECT VALIDATE_PASSWORD_STRENGTH(?) AS strength",
          [password],
        );

        const row = result.rows?.[0];
        const strength = typeof row?.["strength"] === "number" ? row["strength"] : 0;

        let interpretation: string;
        if (strength >= 100) interpretation = "Very Strong";
        else if (strength >= 75) interpretation = "Strong";
        else if (strength >= 50) interpretation = "Medium";
        else if (strength >= 25) interpretation = "Weak";
        else interpretation = "Very Weak";

        return withTokenEstimate({
          success: true,
          data: {
            strength,
            interpretation,
            meetsPolicy: strength === 100, // MySQL returns 100 when policy is fully met
            policy,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Check for known component-not-installed errors
        const lower = message.toLowerCase();
        if (
          lower.includes("validate_password_strength") ||
          lower.includes("function")
        ) {
          return formatHandlerErrorResponse(
            new ExtensionNotAvailableError("validate_password"),
            { module: "security", tool: "mysql_security_password_validate" }
          );
        }
        return formatHandlerErrorResponse(error, { module: "security", tool: "mysql_security_password_validate" });
      }
    },
  };
}
