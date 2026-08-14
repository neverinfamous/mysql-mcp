/**
 * MySQL Shell - Backup Tools
 *
 * Tools for creating database dumps using MySQL Shell.
 */

import { ZodError } from "zod";

import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  ValidationError,
  MySQLMcpError,
  ErrorCategory,
  type ToolDefinition,
  type RequestContext,
} from "../../../../types/index.js";
import { assertSafeIoPath } from "../../../../utils/security-utils.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import {
  ShellDumpInstanceInputSchema,
  ShellDumpInstanceInputSchemaBase,
  ShellDumpSchemasInputSchema,
  ShellDumpSchemasInputSchemaBase,
  ShellDumpTablesInputSchema,
  ShellDumpTablesInputSchemaBase,
  ShellDumpInstanceOutputSchema,
  ShellDumpSchemasOutputSchema,
  ShellDumpTablesOutputSchema,
} from "../../schemas/shell/index.js";
import { escapeForJS, execShellJS, mapHostPathToContainer } from "./common.js";

/**
 * Dump entire MySQL instance
 */
export function createShellDumpInstanceTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysqlsh_dump_instance",
    title: "MySQL Shell Dump Instance",
    description:
      "Dump entire MySQL instance using util.dumpInstance(). Creates a compressed, parallel dump of all schemas (excluding system schemas). Ideal for full backups and migrations.",
    group: "shell",
    inputSchema: ShellDumpInstanceInputSchemaBase,
    outputSchema: ShellDumpInstanceOutputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          outputDir,
          outputUrl,
          threads,
          compression,
          dryRun,
          includeSchemas,
          excludeSchemas,
          consistent,
          users,
        } = ShellDumpInstanceInputSchema.parse(params);

        const finalOutputDir = outputDir ?? outputUrl;
        if (!finalOutputDir) {
          throw new ValidationError("outputDir or outputUrl is required");
        }

        assertSafeIoPath(finalOutputDir, adapter.getAllowedIoRoots(), false);

        const resolvedPath = mapHostPathToContainer(finalOutputDir).replace(/\\/g, "/");
        const escapedPath = escapeForJS(resolvedPath);

        const options: string[] = [];
        if (threads !== undefined) {
          options.push(`threads: ${threads}`);
        }
        if (compression && compression !== "zstd") {
          options.push(`compression: "${compression}"`);
        }
        if (dryRun) {
          options.push("dryRun: true");
        }
        if (includeSchemas && includeSchemas.length > 0) {
          options.push(`includeSchemas: ${JSON.stringify(includeSchemas)}`);
        }
        if (excludeSchemas && excludeSchemas.length > 0) {
          options.push(`excludeSchemas: ${JSON.stringify(excludeSchemas)}`);
        }
        if (consistent !== undefined && !consistent) {
          options.push("consistent: false");
        }
        if (users !== undefined && !users) {
          options.push("users: false");
        }

        const optionsStr =
          options.length > 0 ? `, { ${options.join(", ")} }` : "";
        const jsCode = `return util.dumpInstance("${escapedPath}"${optionsStr});`;

        const result = await execShellJS(jsCode, { timeout: 3600000 }); // 1 hour timeout

        return withTokenEstimate({
          success: true,
          data: {
            outputDir: finalOutputDir,
            dryRun: dryRun ?? false,
            result,
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("privilege") ||
          errorMessage.includes("Access denied")
        ) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Dump failed due to missing privileges: ${errorMessage}.`,
              "AUTHORIZATION_ERROR",
              ErrorCategory.AUTHORIZATION,
              {
                suggestion:
                  "Instance dumps require broad privileges (SELECT, RELOAD, REPLICATION CLIENT, etc.). Use mysqlsh_dump_schemas or mysqlsh_dump_tables for more targeted dumps with fewer privilege requirements.",
              }
            )
          );
        }
        if (errorMessage.includes("already exists")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "The specified output directory already exists and is not empty. Please provide a new directory or remove the existing one." }
            )
          );
        }
        if (errorMessage.includes("Could not create directory") && errorMessage.includes("File exists")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "The specified output path is an existing file, but a directory is required." }
            )
          );
        }
        if (errorMessage.includes("No such file or directory") || errorMessage.includes("Could not create directory")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "The parent directory for the output path does not exist. Ensure the directory path is correct and exists." }
            )
          );
        }
        if (errorMessage.includes("unexpected input near ;") || errorMessage.includes("ProxySQL")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Dump failed: Administrative command rejected.`,
              "PROXY_COMPATIBILITY_ERROR",
              ErrorCategory.QUERY,
              { suggestion: "This error often occurs when connecting through ProxySQL, which does not support the administrative commands (like FLUSH TABLES) required by util.dumpInstance(). Connect directly to the MySQL cluster node instead." }
            )
          );
        }
        if (errorMessage.includes("Fatal error during dump")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Dump failed: ${errorMessage}.`,
              "QUERY_ERROR",
              ErrorCategory.QUERY,
              {
                suggestion:
                  "This may be caused by missing privileges. Use mysqlsh_dump_schemas with ddlOnly: true or mysqlsh_dump_tables with all: false for fewer privilege requirements.",
              }
            )
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Dump selected schemas
 */
export function createShellDumpSchemasTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysqlsh_dump_schemas",
    title: "MySQL Shell Dump Schemas",
    description:
      "Dump selected schemas using util.dumpSchemas(). Creates a compressed, parallel dump of specified schemas. Use for partial backups.",
    group: "shell",
    inputSchema: ShellDumpSchemasInputSchemaBase,
    outputSchema: ShellDumpSchemasOutputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          schemas,
          outputDir,
          outputUrl,
          threads,
          compression,
          dryRun,
          includeTables,
          excludeTables,
          ddlOnly,
        } = ShellDumpSchemasInputSchema.parse(params);

        if (schemas.length === 0) {
          throw new ValidationError("At least one schema name is required");
        }

        const finalOutputDir = outputDir ?? outputUrl;
        if (!finalOutputDir) {
          throw new ValidationError("outputDir or outputUrl is required");
        }

        assertSafeIoPath(finalOutputDir, adapter.getAllowedIoRoots(), false);

        const resolvedPath = mapHostPathToContainer(finalOutputDir).replace(/\\/g, "/");
        const escapedPath = escapeForJS(resolvedPath);

        const options: string[] = [];
        if (threads !== undefined) {
          options.push(`threads: ${threads}`);
        }
        if (compression && compression !== "zstd") {
          options.push(`compression: "${compression}"`);
        }
        if (dryRun) {
          options.push("dryRun: true");
        }
        if (includeTables && includeTables.length > 0) {
          options.push(`includeTables: ${JSON.stringify(includeTables)}`);
        }
        if (excludeTables && excludeTables.length > 0) {
          options.push(`excludeTables: ${JSON.stringify(excludeTables)}`);
        }
        // ddlOnly mode disables data and all metadata that requires extra privileges
        if (ddlOnly) {
          options.push("ddlOnly: true");
          options.push("events: false");
          options.push("triggers: false");
          options.push("routines: false");
        }

        const optionsStr =
          options.length > 0 ? `, { ${options.join(", ")} }` : "";
        const jsCode = `return util.dumpSchemas(${JSON.stringify(schemas)}, "${escapedPath}"${optionsStr});`;

        const result = await execShellJS(jsCode, { timeout: 3600000 });
        return withTokenEstimate({
          success: true,
          data: {
            schemas,
            outputDir: finalOutputDir,
            dryRun: dryRun ?? false,
            ddlOnly: ddlOnly ?? false,
            result,
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("EVENT") ||
          errorMessage.includes("TRIGGER") ||
          errorMessage.includes("privilege")
        ) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Dump failed due to missing privileges: ${errorMessage}.`,
              "AUTHORIZATION_ERROR",
              ErrorCategory.AUTHORIZATION,
              {
                suggestion: "Set ddlOnly: true to skip events, triggers, and routines.",
              }
            )
          );
        }
        if (errorMessage.includes("already exists")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "The specified output directory already exists and is not empty. Please provide a new directory or remove the existing one." }
            )
          );
        }
        if (errorMessage.includes("Could not create directory") && errorMessage.includes("File exists")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "The specified output path is an existing file, but a directory is required." }
            )
          );
        }
        if (errorMessage.includes("No such file or directory") || errorMessage.includes("Could not create directory")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "The parent directory for the output path does not exist. Ensure the directory path is correct and exists." }
            )
          );
        }
        if (errorMessage.includes("unexpected input near ;") || errorMessage.includes("ProxySQL")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Dump failed: Administrative command rejected.`,
              "PROXY_COMPATIBILITY_ERROR",
              ErrorCategory.QUERY,
              { suggestion: "This error often occurs when connecting through ProxySQL, which does not support the administrative commands required by util.dumpSchemas(). Connect directly to the MySQL cluster node instead." }
            )
          );
        }
        if (errorMessage.includes("Following schemas were not found")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "SCHEMA_NOT_FOUND",
              ErrorCategory.RESOURCE
            )
          );
        }
        if (errorMessage.includes("must be in the following form: schema.table") || errorMessage.includes("table name cannot be empty")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "Tables in includeTables and excludeTables must be specified in 'schema.table' format, and cannot be empty." }
            )
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Dump specific tables
 */
export function createShellDumpTablesTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysqlsh_dump_tables",
    title: "MySQL Shell Dump Tables",
    description:
      "Dump specific tables using util.dumpTables(). Creates a compressed, parallel dump of specified tables from a schema.",
    group: "shell",
    inputSchema: ShellDumpTablesInputSchemaBase,
    outputSchema: ShellDumpTablesOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          schema,
          tables,
          outputDir,
          outputUrl,
          threads,
          compression,
          where,
          all,
          dryRun,
        } = ShellDumpTablesInputSchema.parse(params);

        if (tables.length === 0) {
          throw new ValidationError("At least one table name is required");
        }

        const finalOutputDir = outputDir ?? outputUrl;
        if (!finalOutputDir) {
          throw new ValidationError("outputDir or outputUrl is required");
        }

        assertSafeIoPath(finalOutputDir, adapter.getAllowedIoRoots(), false);

        const resolvedPath = mapHostPathToContainer(finalOutputDir).replace(/\\/g, "/");
        const escapedPath = escapeForJS(resolvedPath);

        const options: string[] = [];
        if (threads !== undefined) {
          options.push(`threads: ${threads}`);
        }
        if (compression && compression !== "zstd") {
          options.push(`compression: "${compression}"`);
        }
        if (dryRun) {
          options.push("dryRun: true");
        }
        if (where !== undefined && Object.keys(where).length > 0) {
          const whereEntries = Object.entries(where)
            .map(([tbl, cond]) => {
              const fullTblName = tbl.includes(".") ? tbl : `${schema}.${tbl}`;
              return `"${escapeForJS(fullTblName)}": "${escapeForJS(cond)}"`;
            })
            .join(", ");
          options.push(`where: { ${whereEntries} }`);
        }
        // When all is explicitly false, disable triggers/routines dumping
        if (!all) {
          options.push("triggers: false");
        }

        const optionsStr =
          options.length > 0 ? `, { ${options.join(", ")} }` : "";
        const jsCode = `return util.dumpTables("${escapeForJS(schema ?? "")}", ${JSON.stringify(tables)}, "${escapedPath}"${optionsStr});`;

        const result = await execShellJS(jsCode, { timeout: 3600000 });
        return withTokenEstimate({
          success: true,
          data: {
            schema,
            tables,
            outputDir: finalOutputDir,
            where,
            dryRun: dryRun ?? false,
            triggersExcluded: !all,
            result,
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check for specific privilege issues
        if (
          errorMessage.includes("privilege") ||
          errorMessage.includes("Access denied")
        ) {
          // Extract specific privilege if mentioned
          const privilegeRegex =
            /(?:missing|requires?|need)[^.]*?(EVENT|TRIGGER|ROUTINE|SELECT|INSERT|UPDATE|DELETE)/i;
          const privilegeMatch = privilegeRegex.exec(errorMessage);
          const specificPrivilege = privilegeMatch ? privilegeMatch[1] : null;

          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Dump failed due to missing privileges: ${errorMessage}.`,
              "AUTHORIZATION_ERROR",
              ErrorCategory.AUTHORIZATION,
              {
                suggestion:
                  specificPrivilege === "EVENT" || specificPrivilege === "TRIGGER"
                    ? `Set all: false to skip ${specificPrivilege.toLowerCase()}s.`
                    : "Set all: false to skip metadata that requires extra privileges.",
              }
            )
          );
        }

        if (errorMessage.includes("Fatal error during dump")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage.includes("Writing schema metadata")
                ? `Dump failed while writing schema metadata: ${errorMessage}.`
                : `Dump failed: ${errorMessage}.`,
              "QUERY_ERROR",
              ErrorCategory.QUERY
            )
          );
        }

        if (errorMessage.includes("already exists")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "The specified output directory already exists and is not empty. Please provide a new directory or remove the existing one." }
            )
          );
        }
        if (errorMessage.includes("Could not create directory") && errorMessage.includes("File exists")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "The specified output path is an existing file, but a directory is required." }
            )
          );
        }
        if (errorMessage.includes("No such file or directory") || errorMessage.includes("Could not create directory")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "The parent directory for the output path does not exist. Ensure the directory path is correct and exists." }
            )
          );
        }
        if (errorMessage.includes("unexpected input near ;") || errorMessage.includes("ProxySQL")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Dump failed: Administrative command rejected.`,
              "PROXY_COMPATIBILITY_ERROR",
              ErrorCategory.QUERY,
              { suggestion: "This error often occurs when connecting through ProxySQL, which does not support the administrative commands required by util.dumpTables(). Connect directly to the MySQL cluster node instead." }
            )
          );
        }

        if (errorMessage.includes("Following tables were not found")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "TABLE_NOT_FOUND",
              ErrorCategory.RESOURCE
            )
          );
        }

        if (errorMessage.includes("The requested schema") && errorMessage.includes("was not found")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "SCHEMA_NOT_FOUND",
              ErrorCategory.RESOURCE
            )
          );
        }

        return formatHandlerErrorResponse(error);
      }
    },
  };
}
