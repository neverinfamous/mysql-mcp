/**
 * MySQL Shell - Backup Tools
 *
 * Tools for creating database dumps using MySQL Shell.
 */

import { ZodError } from "zod";
import * as path from "path";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { assertSafeIoPath } from "../../../../utils/security-utils.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import {
  ShellDumpInstanceInputSchema,
  ShellDumpSchemasInputSchema,
  ShellDumpSchemasInputSchemaBase,
  ShellDumpTablesInputSchema,
  ShellDumpTablesInputSchemaBase,
  ShellDumpInstanceOutputSchema,
  ShellDumpSchemasOutputSchema,
  ShellDumpTablesOutputSchema,
} from "../../schemas/shell/index.js";
import { escapeForJS, execShellJS } from "./common.js";

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
    inputSchema: ShellDumpInstanceInputSchema,
    outputSchema: ShellDumpInstanceOutputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
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
          return withTokenEstimate({
            success: false,
            error: "Validation error: outputDir or outputUrl is required",
          });
        }

        assertSafeIoPath(finalOutputDir, adapter.getAllowedIoRoots(), false);

        const resolvedPath = path.resolve(finalOutputDir);
        const escapedPath = resolvedPath.replace(/\\/g, "\\\\");

        const options: string[] = [];
        if (threads) {
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
          return withTokenEstimate({
            success: false,
            error: `Dump failed due to missing privileges: ${errorMessage}.`,
            suggestion:
              "Instance dumps require broad privileges (SELECT, RELOAD, REPLICATION CLIENT, etc.). Use mysqlsh_dump_schemas or mysqlsh_dump_tables for more targeted dumps with fewer privilege requirements.",
          });
        }
        if (errorMessage.includes("Fatal error during dump")) {
          return withTokenEstimate({
            success: false,
            error: `Dump failed: ${errorMessage}.`,
            suggestion:
              "This may be caused by missing privileges. Use mysqlsh_dump_schemas with ddlOnly: true or mysqlsh_dump_tables with all: false for fewer privilege requirements.",
          });
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
          return withTokenEstimate({
            success: false,
            error: "At least one schema name is required",
          });
        }

        const finalOutputDir = outputDir ?? outputUrl;
        if (!finalOutputDir) {
          return withTokenEstimate({
            success: false,
            error: "Validation error: outputDir or outputUrl is required",
          });
        }

        assertSafeIoPath(finalOutputDir, adapter.getAllowedIoRoots(), false);

        const resolvedPath = path.resolve(finalOutputDir);
        const escapedPath = resolvedPath.replace(/\\/g, "\\\\");

        const options: string[] = [];
        if (threads) {
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
        // ddlOnly mode disables all metadata that requires extra privileges
        if (ddlOnly) {
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
          return withTokenEstimate({
            success: false,
            error: `Dump failed due to missing privileges: ${errorMessage}.`,
            suggestion:
              "Set ddlOnly: true to skip events, triggers, and routines.",
          });
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
          return withTokenEstimate({
            success: false,
            error: "At least one table name is required",
          });
        }

        const finalOutputDir = outputDir ?? outputUrl;
        if (!finalOutputDir) {
          return withTokenEstimate({
            success: false,
            error: "Validation error: outputDir or outputUrl is required",
          });
        }

        assertSafeIoPath(finalOutputDir, adapter.getAllowedIoRoots(), false);

        const resolvedPath = path.resolve(finalOutputDir);
        const escapedPath = resolvedPath.replace(/\\/g, "\\\\");

        const options: string[] = [];
        if (threads) {
          options.push(`threads: ${threads}`);
        }
        if (compression && compression !== "zstd") {
          options.push(`compression: "${compression}"`);
        }
        if (dryRun) {
          options.push("dryRun: true");
        }
        if (where && Object.keys(where).length > 0) {
          const whereEntries = Object.entries(where)
            .map(
              ([tbl, cond]) => `"${escapeForJS(tbl)}": "${escapeForJS(cond)}"`,
            )
            .join(", ");
          options.push(`where: { ${whereEntries} }`);
        }
        // When all is explicitly false, disable triggers/routines dumping
        if (!all) {
          options.push("triggers: false");
        }

        const optionsStr =
          options.length > 0 ? `, { ${options.join(", ")} }` : "";
        const jsCode = `return util.dumpTables("${schema}", ${JSON.stringify(tables)}, "${escapedPath}"${optionsStr});`;

        const result = await execShellJS(jsCode, { timeout: 3600000 });
        return withTokenEstimate({
          success: true,
          data: {
            schema,
            tables,
            outputDir: finalOutputDir,
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

          return withTokenEstimate({
            success: false,
            error: `Dump failed due to missing privileges: ${errorMessage}.`,
            suggestion:
              specificPrivilege === "EVENT" || specificPrivilege === "TRIGGER"
                ? `Set all: false to skip ${specificPrivilege.toLowerCase()}s.`
                : "Set all: false to skip metadata that requires extra privileges.",
          });
        }

        // Generic fatal error - provide actionable guidance
        if (errorMessage.includes("Fatal error during dump")) {
          return withTokenEstimate({
            success: false,
            error: errorMessage.includes("Writing schema metadata")
              ? `Dump failed while writing schema metadata: ${errorMessage}.`
              : `Dump failed: ${errorMessage}.`,
            suggestion:
              "Set all: false to skip metadata that requires extra privileges.",
          });
        }

        return formatHandlerErrorResponse(error);
      }
    },
  };
}
