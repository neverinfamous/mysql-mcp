/**
 * MySQL Shell - Backup Tools
 *
 * Tools for creating database dumps using MySQL Shell.
 */

import { ZodError } from "zod";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ShellDumpInstanceInputSchema,
  ShellDumpSchemasInputSchema,
  ShellDumpTablesInputSchema,
} from "../../types/shell-types.js";
import { escapeForJS, execShellJS } from "./common.js";

/** Extract human-readable messages from a ZodError instead of raw JSON array */
function formatZodError(error: ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}

/**
 * Dump entire MySQL instance
 */
export function createShellDumpInstanceTool(): ToolDefinition {
  return {
    name: "mysqlsh_dump_instance",
    title: "MySQL Shell Dump Instance",
    description:
      "Dump entire MySQL instance using util.dumpInstance(). Creates a compressed, parallel dump of all schemas (excluding system schemas). Ideal for full backups and migrations.",
    group: "shell",
    inputSchema: ShellDumpInstanceInputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const {
        outputDir,
        threads,
        compression,
        dryRun,
        includeSchemas,
        excludeSchemas,
        consistent,
        users,
      } = ShellDumpInstanceInputSchema.parse(params);

      const escapedPath = outputDir.replace(/\\/g, "\\\\");

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

      try {
        const result = await execShellJS(jsCode, { timeout: 3600000 }); // 1 hour timeout

        return {
          success: true,
          outputDir,
          dryRun: dryRun ?? false,
          result,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("privilege") ||
          errorMessage.includes("Access denied")
        ) {
          return {
            success: false,
            outputDir,
            error: `Dump failed due to missing privileges: ${errorMessage}.`,
            hint: "Instance dumps require broad privileges (SELECT, RELOAD, REPLICATION CLIENT, etc.). Use mysqlsh_dump_schemas or mysqlsh_dump_tables for more targeted dumps with fewer privilege requirements.",
          };
        }
        if (errorMessage.includes("Fatal error during dump")) {
          return {
            success: false,
            outputDir,
            error: `Dump failed: ${errorMessage}.`,
            hint: "This may be caused by missing privileges. Use mysqlsh_dump_schemas with ddlOnly: true or mysqlsh_dump_tables with all: false for fewer privilege requirements.",
          };
        }
        return { success: false, outputDir, error: errorMessage };
      }
    },
  };
}

/**
 * Dump selected schemas
 */
export function createShellDumpSchemasTool(): ToolDefinition {
  return {
    name: "mysqlsh_dump_schemas",
    title: "MySQL Shell Dump Schemas",
    description:
      "Dump selected schemas using util.dumpSchemas(). Creates a compressed, parallel dump of specified schemas. Use for partial backups.",
    group: "shell",
    inputSchema: ShellDumpSchemasInputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          schemas,
          outputDir,
          threads,
          compression,
          dryRun,
          includeTables,
          excludeTables,
          ddlOnly,
        } = ShellDumpSchemasInputSchema.parse(params);

        if (schemas.length === 0) {
          return {
            success: false,
            error: "At least one schema name is required",
          };
        }

        const escapedPath = outputDir.replace(/\\/g, "\\\\");

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
        return {
          success: true,
          schemas,
          outputDir,
          dryRun: dryRun ?? false,
          ddlOnly: ddlOnly ?? false,
          result,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("EVENT") ||
          errorMessage.includes("TRIGGER") ||
          errorMessage.includes("privilege")
        ) {
          return {
            success: false,
            error: `Dump failed due to missing privileges: ${errorMessage}.`,
            hint: "Set ddlOnly: true to skip events, triggers, and routines.",
          };
        }
        return { success: false, error: errorMessage };
      }
    },
  };
}

/**
 * Dump specific tables
 */
export function createShellDumpTablesTool(): ToolDefinition {
  return {
    name: "mysqlsh_dump_tables",
    title: "MySQL Shell Dump Tables",
    description:
      "Dump specific tables using util.dumpTables(). Creates a compressed, parallel dump of specified tables from a schema.",
    group: "shell",
    inputSchema: ShellDumpTablesInputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { schema, tables, outputDir, threads, compression, where, all } =
          ShellDumpTablesInputSchema.parse(params);

        if (tables.length === 0) {
          return {
            success: false,
            error: "At least one table name is required",
          };
        }

        const escapedPath = outputDir.replace(/\\/g, "\\\\");

        const options: string[] = [];
        if (threads) {
          options.push(`threads: ${threads}`);
        }
        if (compression && compression !== "zstd") {
          options.push(`compression: "${compression}"`);
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
        return {
          success: true,
          schema,
          tables,
          outputDir,
          triggersExcluded: !all,
          result,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
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

          return {
            success: false,
            error: `Dump failed due to missing privileges: ${errorMessage}.`,
            hint:
              specificPrivilege === "EVENT" || specificPrivilege === "TRIGGER"
                ? `Set all: false to skip ${specificPrivilege.toLowerCase()}s.`
                : "Set all: false to skip metadata that requires extra privileges.",
          };
        }

        // Generic fatal error - provide actionable guidance
        if (errorMessage.includes("Fatal error during dump")) {
          return {
            success: false,
            error: errorMessage.includes("Writing schema metadata")
              ? `Dump failed while writing schema metadata: ${errorMessage}.`
              : `Dump failed: ${errorMessage}.`,
            hint: "Set all: false to skip metadata that requires extra privileges.",
          };
        }

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  };
}
