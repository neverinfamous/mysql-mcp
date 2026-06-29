import { z } from "zod";
import { BaseOutputSchema } from "../output-schemas.js";

// =============================================================================
// Output Schemas
// =============================================================================

export const ShellStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    connected: z.boolean(),
    uri: z.string().optional(),
    user: z.string().optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string().optional(),
    ssl: z.boolean().optional(),
    sslCipher: z.string().optional(),
    serverVersion: z.string().optional(),
    shellVersion: z.string().optional(),
    uptime: z.number().optional(),
    activeSessions: z.number().optional(),
    globalVariables: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
});

export const ShellInfoOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    shellVersion: z.string(),
    serverVersion: z.string().optional(),
    clientVersion: z.string().optional(),
    os: z.string().optional(),
    architecture: z.string().optional(),
    plugins: z.array(z.string()).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
});

export const ShellVersionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    version: z.string(),
    components: z.record(z.string(), z.string()).optional(),
  }).optional(),
});

export const ShellExecuteOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    result: z.unknown().optional(),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    columns: z.array(z.string()).optional(),
    rowsAffected: z.number().optional(),
    lastInsertId: z.number().optional(),
    warnings: z.number().optional(),
    executionTimeMs: z.number().optional(),
  }).optional(),
});

export const ShellRunScriptOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    language: z.string(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
  }).loose().optional(),
});

export const ShellConnectOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    uri: z.string().optional(),
    serverVersion: z.string().optional(),
  }).optional(),
});

export const ShellCheckUpgradeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    targetVersion: z.string(),
    serverVersion: z.string().optional(),
    errorCount: z.number(),
    warningCount: z.number(),
    noticeCount: z.number(),
    checksPerformed: z.number().optional(),
    upgradeCheck: z.unknown(),
  }).loose().optional(),
});

export const ShellExportTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    schema: z.string().optional(),
    table: z.string().optional(),
    outputPath: z.string(),
    format: z.string().optional(),
    result: z.unknown().optional(),
  }).loose().optional(),
});

export const ShellImportTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    inputPath: z.string(),
    schema: z.string().optional(),
    table: z.string().optional(),
    localInfileEnabled: z.boolean().optional(),
    result: z.unknown().optional(),
  }).loose().optional(),
});

export const ShellImportJSONOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    inputPath: z.string(),
    schema: z.string().optional(),
    collection: z.string().optional(),
    protocol: z.string(),
    result: z.unknown().optional(),
  }).loose().optional(),
});

export const ShellDumpInstanceOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    outputDir: z.string(),
    dryRun: z.boolean(),
    result: z.unknown().optional(),
  }).loose().optional(),
});

export const ShellDumpSchemasOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    schemas: z.array(z.string()),
    outputDir: z.string(),
    dryRun: z.boolean(),
    ddlOnly: z.boolean(),
    result: z.unknown().optional(),
  }).loose().optional(),
});

export const ShellDumpTablesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    schema: z.string(),
    tables: z.array(z.string()),
    outputDir: z.string(),
    dryRun: z.boolean(),
    triggersExcluded: z.boolean().optional(),
    result: z.unknown().optional(),
  }).loose().optional(),
});

export const ShellLoadDumpOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    inputDir: z.string(),
    dryRun: z.boolean(),
    localInfileEnabled: z.boolean().optional(),
    result: z.unknown().optional(),
    dryRunOutput: z.string().optional(),
  }).loose().optional(),
});

export const ShellDisconnectOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    success: z.boolean(),
    message: z.string().optional(),
  }).optional(),
});
