import { z } from "zod";
import { preprocessAdminTableParams } from "./preprocess-utils.js";

// =============================================================================
// Admin Schemas
// =============================================================================

// --- OptimizeTable ---
export const OptimizeTableSchemaBase = z.object({
  tables: z.unknown().optional().describe("Table names to optimize"),
  table: z.unknown().optional().describe("Single table name (alias for tables)"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  local: z.unknown().optional().describe("Write to binlog using LOCAL"),
  no_write_to_binlog: z.unknown().optional().describe("Alias for local"),
});

export const OptimizeTableSchema = z
  .preprocess(
    (obj: unknown) => {
      const data = preprocessAdminTableParams(obj);
      if (typeof data === "object" && data !== null) {
        const record = data as Record<string, unknown>;
        if (typeof record["local"] === "string") {
          if (record["local"] === "true" || record["local"] === "1") record["local"] = true;
          else if (record["local"] === "false" || record["local"] === "0") record["local"] = false;
        }
        if (typeof record["local"] === "number") record["local"] = record["local"] === 1;
        if (typeof record["no_write_to_binlog"] === "string") {
          if (record["no_write_to_binlog"] === "true" || record["no_write_to_binlog"] === "1") record["no_write_to_binlog"] = true;
          else if (record["no_write_to_binlog"] === "false" || record["no_write_to_binlog"] === "0") record["no_write_to_binlog"] = false;
        }
        if (typeof record["no_write_to_binlog"] === "number") record["no_write_to_binlog"] = record["no_write_to_binlog"] === 1;
      }
      return data;
    },
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      local: z.boolean().optional(),
      no_write_to_binlog: z.boolean().optional(),
    }),
  )
  .transform((data) => ({
    tables: (data.tables ?? []).filter(t => t.trim().length > 0),
    local: data.local ?? data.no_write_to_binlog,
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- AnalyzeTable ---
export const AnalyzeTableSchemaBase = z.object({
  tables: z.unknown().optional().describe("Table names to analyze"),
  table: z.unknown().optional().describe("Single table name (alias for tables)"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  local: z.unknown().optional().describe("Write to binlog using LOCAL"),
  no_write_to_binlog: z.unknown().optional().describe("Alias for local"),
  update_histograms: z.unknown().optional().describe("Update histograms instead of index statistics"),
});

export const AnalyzeTableSchema = z
  .preprocess(
    (obj: unknown) => {
      const data = preprocessAdminTableParams(obj);
      if (typeof data === "object" && data !== null) {
        const record = data as Record<string, unknown>;
        if (typeof record["local"] === "string") {
          if (record["local"] === "true" || record["local"] === "1") record["local"] = true;
          else if (record["local"] === "false" || record["local"] === "0") record["local"] = false;
        }
        if (typeof record["local"] === "number") record["local"] = record["local"] === 1;
        if (typeof record["no_write_to_binlog"] === "string") {
          if (record["no_write_to_binlog"] === "true" || record["no_write_to_binlog"] === "1") record["no_write_to_binlog"] = true;
          else if (record["no_write_to_binlog"] === "false" || record["no_write_to_binlog"] === "0") record["no_write_to_binlog"] = false;
        }
        if (typeof record["no_write_to_binlog"] === "number") record["no_write_to_binlog"] = record["no_write_to_binlog"] === 1;
        if (typeof record["update_histograms"] === "string") {
          if (record["update_histograms"] === "true" || record["update_histograms"] === "1") record["update_histograms"] = true;
          else if (record["update_histograms"] === "false" || record["update_histograms"] === "0") record["update_histograms"] = false;
        }
        if (typeof record["update_histograms"] === "number") record["update_histograms"] = record["update_histograms"] === 1;
      }
      return data;
    },
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      local: z.boolean().optional(),
      no_write_to_binlog: z.boolean().optional(),
      update_histograms: z.boolean().optional(),
    }),
  )
  .transform((data) => ({
    tables: (data.tables ?? []).filter(t => t.trim().length > 0),
    local: data.local ?? data.no_write_to_binlog,
    update_histograms: data.update_histograms,
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- CheckTable ---
export const CheckTableSchemaBase = z.object({
  tables: z.unknown().optional().describe("Table names to check"),
  table: z.unknown().optional().describe("Single table name (alias for tables)"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  option: z.unknown().optional().describe("Check option (e.g. QUICK, FAST, MEDIUM, EXTENDED, CHANGED)"),
});

export const CheckTableSchema = z
  .preprocess(
    (obj: unknown) => {
      const data = preprocessAdminTableParams(obj);
      if (typeof data === "object" && data !== null) {
        const record = data as Record<string, unknown>;
        if (typeof record["option"] === "string") {
          record["option"] = record["option"].toUpperCase().trim();
        }
      }
      return data;
    },
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      option: z
        .enum(["QUICK", "FAST", "MEDIUM", "EXTENDED", "CHANGED"])
        .optional(),
    }),
  )
  .transform((data) => ({
    tables: (data.tables ?? []).filter(t => t.trim().length > 0),
    option: data.option,
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- RepairTable ---
export const RepairTableSchemaBase = z.object({
  tables: z.unknown().optional().describe("Table names to repair"),
  table: z.unknown().optional().describe("Single table name (alias for tables)"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  quick: z
    .unknown()
    .optional()
    .describe("Quick repair (MyISAM only)"),
});

export const RepairTableSchema = z
  .preprocess(
    (obj: unknown) => {
      const data = preprocessAdminTableParams(obj);
      if (typeof data === "object" && data !== null) {
        const record = data as Record<string, unknown>;
        if (typeof record["quick"] === "string") {
          if (record["quick"] === "true" || record["quick"] === "1") record["quick"] = true;
          else if (record["quick"] === "false" || record["quick"] === "0") record["quick"] = false;
        }
        if (typeof record["quick"] === "number") {
          record["quick"] = record["quick"] === 1;
        }
      }
      return data;
    },
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      quick: z.boolean().optional().default(false),
    }),
  )
  .transform((data) => ({
    tables: (data.tables ?? []).filter(t => t.trim().length > 0),
    quick: data.quick,
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- FlushTables ---
export const FlushTablesSchemaBase = z.object({
  tables: z.unknown().optional().describe("Specific tables to flush (empty for all)"),
  table: z.unknown().optional().describe("Single table name (alias for tables)"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  withReadLock: z.unknown().optional().describe("Acquire read lock (WITH READ LOCK)"),
  forExport: z.unknown().optional().describe("Flush for export (FOR EXPORT)"),
});

export const FlushTablesSchema = z
  .preprocess(
    (obj: unknown) => {
      const data = preprocessAdminTableParams(obj);
      if (typeof data === "object" && data !== null) {
        const record = data as Record<string, unknown>;
        if (typeof record["withReadLock"] === "string") {
          if (record["withReadLock"] === "true" || record["withReadLock"] === "1") record["withReadLock"] = true;
          else if (record["withReadLock"] === "false" || record["withReadLock"] === "0") record["withReadLock"] = false;
        }
        if (typeof record["withReadLock"] === "number") record["withReadLock"] = record["withReadLock"] === 1;
        if (typeof record["forExport"] === "string") {
          if (record["forExport"] === "true" || record["forExport"] === "1") record["forExport"] = true;
          else if (record["forExport"] === "false" || record["forExport"] === "0") record["forExport"] = false;
        }
        if (typeof record["forExport"] === "number") record["forExport"] = record["forExport"] === 1;
      }
      return data;
    },
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      withReadLock: z.boolean().optional(),
      forExport: z.boolean().optional(),
    }),
  )
  .transform((data) => ({
    tables: data.tables ? data.tables.filter(t => t.trim().length > 0) : undefined,
    withReadLock: data.withReadLock ?? false,
    forExport: data.forExport ?? false,
  }))
  .refine((data) => !(data.withReadLock && data.forExport), {
    message: "Cannot specify both withReadLock and forExport",
  })
  .refine((data) => data.tables === undefined || data.tables.length > 0, {
    message: "If tables array is provided, it must not be empty",
  })
  .refine((data) => !data.forExport || (data.tables && data.tables.length > 0), {
    message: "FOR EXPORT requires at least one table to be specified",
  });

export const KillQuerySchemaBase = z.object({
  processId: z.unknown().optional().describe("Process ID to kill"),
  id: z.unknown().optional().describe("Alias for process ID to kill"),
  connectionId: z.unknown().optional().describe("Alias for process ID to kill"),
  connection: z.unknown().optional().describe("Kill connection instead of query"),
});

export const KillQuerySchema = z
  .preprocess(
    (obj: unknown) => {
      if (typeof obj === "object" && obj !== null) {
        const data = obj as Record<string, unknown>;
        if (typeof data["connection"] === "string") {
          if (data["connection"] === "true" || data["connection"] === "1") data["connection"] = true;
          else if (data["connection"] === "false" || data["connection"] === "0") data["connection"] = false;
        }
        if (typeof data["connection"] === "number") {
          data["connection"] = data["connection"] === 1;
        }
        return data;
      }
      return obj;
    },
    z.object({
      processId: z.unknown().optional(),
      id: z.unknown().optional(),
      connectionId: z.unknown().optional(),
      connection: z.boolean().optional().default(false),
    })
  )
  .transform((data) => ({
    processId: data.processId ?? data.id ?? data.connectionId,
    connection: data.connection,
  }))
  .refine(
    (data) =>
      data.processId !== undefined &&
      data.processId !== null &&
      (typeof data.processId === "number" || (typeof data.processId === "string" && data.processId.trim() !== "")) &&
      !Number.isNaN(Number(data.processId)) &&
      Number.isInteger(Number(data.processId)) &&
      Number(data.processId) > 0,
    {
      message: "processId (or id alias) is required and must be a valid positive integer",
    },
  )
  .transform((data) => ({
    processId: Number(data.processId),
    connection: data.connection,
  }));

export const ShowProcesslistSchemaBase = z.object({
  full: z.boolean().optional().default(false).describe("Show full query text"),
  all: z.boolean().optional().describe("Alias for full"),
  verbose: z.boolean().optional().describe("Alias for full"),
  complete: z.boolean().optional().describe("Alias for full"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum number of processes to return (default: 10). Set higher to see all.",
    ),
  summary: z.boolean().optional().describe("Return only summarized counts"),
}).strict();

export const ShowProcesslistSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const data = obj as Record<string, unknown>;
      const { all, verbose, complete, full, ...rest } = data;
      const result: Record<string, unknown> = {
        ...rest,
        full: full ?? all ?? verbose ?? complete,
      };
      
      if (typeof result["full"] === "string") result["full"] = result["full"] === "true" || result["full"] === "1";
      if (typeof result["full"] === "number") result["full"] = result["full"] === 1;
      if (typeof result["summary"] === "string") result["summary"] = result["summary"] === "true" || result["summary"] === "1";
      if (typeof result["summary"] === "number") result["summary"] = result["summary"] === 1;
      
      return result;
    }
    return obj;
  },
  ShowProcesslistSchemaBase
  .transform((data) => ({
    full: data.full,
    limit: data.limit !== undefined ? Number(data.limit) : 10,
    summary: data.summary ?? false,
  }))
  .refine(
    (data) =>
      data.limit === undefined || (Number.isInteger(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  )
);

export const ShowStatusSchemaBase = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern (alias: pattern, search, filter)"),
  pattern: z.string().optional().describe("Alias for like"),
  search: z.string().optional().describe("Alias for like"),
  filter: z.string().optional().describe("Alias for like"),
  name: z.string().optional().describe("Alias for like"),
  query: z.string().optional().describe("Alias for like"),
  sql: z.string().optional().describe("Alias for like"),
  variable: z.string().optional().describe("Alias for like"),
  variableName: z.string().optional().describe("Alias for like"),
  variable_name: z.string().optional().describe("Alias for like"),
  search_pattern: z.string().optional().describe("Alias for like"),
  searchPattern: z.string().optional().describe("Alias for like"),
  var: z.string().optional().describe("Alias for like"),
  varName: z.string().optional().describe("Alias for like"),
  global: z.boolean().optional().default(true).describe("Show global status"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum number of variables to return (default: 10). Set higher to see all.",
    ),
  summary: z.boolean().optional().describe("Return key metrics only"),
}).strict();

export const ShowStatusSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const data = obj as Record<string, unknown>;
      const { pattern, search, filter, name, query, sql, variable, variableName, variable_name, search_pattern, searchPattern, var: varAlias, varName, like, ...rest } = data;
      const result: Record<string, unknown> = {
        ...rest,
        like: like ?? pattern ?? search ?? filter ?? name ?? query ?? sql ?? variable ?? variableName ?? variable_name ?? search_pattern ?? searchPattern ?? varAlias ?? varName,
      };
      
      if (typeof result["global"] === "string") result["global"] = result["global"] === "true" || result["global"] === "1";
      if (typeof result["global"] === "number") result["global"] = result["global"] === 1;
      if (typeof result["summary"] === "string") result["summary"] = result["summary"] === "true" || result["summary"] === "1";
      if (typeof result["summary"] === "number") result["summary"] = result["summary"] === 1;
      
      return result;
    }
    return obj;
  },
  ShowStatusSchemaBase
    .transform((data) => ({
      like: data.like,
      global: data.global,
      limit: data.limit !== undefined ? Number(data.limit) : 10,
      summary: data.summary ?? false,
    }))
    .refine(
      (data) =>
        data.limit === undefined || (Number.isInteger(data.limit) && data.limit > 0),
      { message: "limit must be a positive integer" },
    )
);

export const ShowVariablesSchemaBase = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern (alias: pattern, search, filter)"),
  pattern: z.string().optional().describe("Alias for like"),
  search: z.string().optional().describe("Alias for like"),
  filter: z.string().optional().describe("Alias for like"),
  name: z.string().optional().describe("Alias for like"),
  query: z.string().optional().describe("Alias for like"),
  sql: z.string().optional().describe("Alias for like"),
  variable: z.string().optional().describe("Alias for like"),
  variableName: z.string().optional().describe("Alias for like"),
  variable_name: z.string().optional().describe("Alias for like"),
  search_pattern: z.string().optional().describe("Alias for like"),
  searchPattern: z.string().optional().describe("Alias for like"),
  var: z.string().optional().describe("Alias for like"),
  varName: z.string().optional().describe("Alias for like"),
  global: z
    .boolean()
    .optional()
    .default(true)
    .describe("Show global variables"),
  limit: z
    .number()
    .int()
    .positive({ message: "limit must be a positive integer" })
    .optional()
    .describe(
      "Maximum number of variables to return (default: 10). Set higher to see all.",
    ),
  summary: z.boolean().optional().describe("Return key metrics only"),
}).strict();

export const ShowVariablesSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const data = obj as Record<string, unknown>;
      const { pattern, search, filter, name, query, sql, variable, variableName, variable_name, search_pattern, searchPattern, var: varAlias, varName, like, ...rest } = data;
      const result: Record<string, unknown> = {
        ...rest,
        like: like ?? pattern ?? search ?? filter ?? name ?? query ?? sql ?? variable ?? variableName ?? variable_name ?? search_pattern ?? searchPattern ?? varAlias ?? varName,
      };
      
      if (typeof result["global"] === "string") result["global"] = result["global"] === "true" || result["global"] === "1";
      if (typeof result["global"] === "number") result["global"] = result["global"] === 1;
      if (typeof result["summary"] === "string") result["summary"] = result["summary"] === "true" || result["summary"] === "1";
      if (typeof result["summary"] === "number") result["summary"] = result["summary"] === 1;
      
      if (typeof result["limit"] === "string") {
        const parsedLimit = parseInt(result["limit"], 10);
        if (!isNaN(parsedLimit)) result["limit"] = parsedLimit;
      }
      
      return result;
    }
    return obj;
  },
  ShowVariablesSchemaBase
    .transform((data) => ({
      like: data.like,
      global: data.global,
      limit: data.limit ?? 10,
      summary: data.summary ?? false,
    }))
);

export const InnodbStatusSchemaBase = z.object({
  summary: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Return parsed summary with key metrics instead of full raw output (recommended). Defaults to true. Use raw=true for full text.",
    ),
  format: z.enum(["raw", "full", "summary"]).optional().describe("Alias for summary (use 'raw' or 'full' for false)"),
  raw: z.boolean().optional().describe("Alias for summary (set to true for false)"),
  verbose: z.boolean().optional().describe("Alias for raw (set to true for raw)"),
  extended: z.boolean().optional().describe("Alias for raw (set to true for raw)"),
  detailed: z.boolean().optional().describe("Alias for raw (set to true for raw)"),
  json: z.boolean().optional().describe("Ignored alias"),
}).strict();

export const InnodbStatusSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const data = { ...(obj as Record<string, unknown>) };
      
      // Alias handling for format and raw
      if (
        data["format"] === "raw" || 
        data["format"] === "full" || 
        data["raw"] === true || 
        data["raw"] === "true" ||
        data["raw"] === 1 ||
        data["raw"] === "1" ||
        data["verbose"] === true ||
        data["verbose"] === "true" ||
        data["verbose"] === 1 ||
        data["verbose"] === "1" ||
        data["extended"] === true ||
        data["extended"] === "true" ||
        data["extended"] === 1 ||
        data["extended"] === "1" ||
        data["detailed"] === true ||
        data["detailed"] === "true" ||
        data["detailed"] === 1 ||
        data["detailed"] === "1"
      ) {
        data["summary"] = false;
      }
      
      delete data["verbose"];
      delete data["extended"];
      delete data["detailed"];
      delete data["json"];

      if (typeof data["summary"] === "string") {
        if (data["summary"] === "true" || data["summary"] === "1") data["summary"] = true;
        else if (data["summary"] === "false" || data["summary"] === "0") data["summary"] = false;
      }
      if (typeof data["summary"] === "number") data["summary"] = data["summary"] === 1;
      
      if (typeof data["raw"] === "string") {
        if (data["raw"] === "true" || data["raw"] === "1") data["raw"] = true;
        else if (data["raw"] === "false" || data["raw"] === "0") data["raw"] = false;
      }
      if (typeof data["raw"] === "number") data["raw"] = data["raw"] === 1;
      return data;
    }
    return obj ?? {};
  },
  InnodbStatusSchemaBase
);

export const ReplicationStatusSchemaBase = z.object({
  summary: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Return key replication metrics only instead of full 50+ field output (recommended)",
    ),
  format: z.enum(["raw", "full", "summary"]).optional().describe("Alias for summary (use 'raw' or 'full' for false)"),
  raw: z.boolean().optional().describe("Alias for summary (set to true for false)"),
  verbose: z.boolean().optional().describe("Anti-Hallucination Alias for raw=true"),
  extended: z.boolean().optional().describe("Anti-Hallucination Alias for raw=true"),
  detailed: z.boolean().optional().describe("Anti-Hallucination Alias for raw=true"),
}).strict();

export const ReplicationStatusSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const dataObj = { ...obj };
      let summaryVal: unknown = undefined;
      let formatVal: unknown = undefined;
      let rawVal: unknown = undefined;
      let verboseVal: unknown = undefined;
      let detailedVal: unknown = undefined;
      let extendedVal: unknown = undefined;

      if ("summary" in dataObj) summaryVal = (dataObj as { summary?: unknown }).summary;
      if ("format" in dataObj) formatVal = (dataObj as { format?: unknown }).format;
      if ("raw" in dataObj) rawVal = (dataObj as { raw?: unknown }).raw;
      if ("verbose" in dataObj) verboseVal = (dataObj as { verbose?: unknown }).verbose;
      if ("detailed" in dataObj) detailedVal = (dataObj as { detailed?: unknown }).detailed;
      if ("extended" in dataObj) extendedVal = (dataObj as { extended?: unknown }).extended;

      if (verboseVal === true || verboseVal === "true" || verboseVal === 1 || verboseVal === "1") rawVal = true;
      if (detailedVal === true || detailedVal === "true" || detailedVal === 1 || detailedVal === "1") rawVal = true;
      if (extendedVal === true || extendedVal === "true" || extendedVal === 1 || extendedVal === "1") rawVal = true;

      // Alias handling for format and raw
      if (formatVal === "raw" || formatVal === "full" || rawVal === true || rawVal === "true" || rawVal === 1 || rawVal === "1") {
        summaryVal = false;
      }
      
      if (typeof summaryVal === "string") {
        if (summaryVal === "true" || summaryVal === "1") summaryVal = true;
        else if (summaryVal === "false" || summaryVal === "0") summaryVal = false;
      }
      if (typeof summaryVal === "number") summaryVal = summaryVal === 1;

      if (typeof rawVal === "string") {
        if (rawVal === "true" || rawVal === "1") rawVal = true;
        else if (rawVal === "false" || rawVal === "0") rawVal = false;
      }
      if (typeof rawVal === "number") rawVal = rawVal === 1;
      
      if (summaryVal !== undefined) Object.assign(dataObj, { summary: summaryVal });
      if (formatVal !== undefined) Object.assign(dataObj, { format: formatVal });
      if (rawVal !== undefined) Object.assign(dataObj, { raw: rawVal });
      
      delete (dataObj as Record<string, unknown>)["verbose"];
      delete (dataObj as Record<string, unknown>)["detailed"];
      delete (dataObj as Record<string, unknown>)["extended"];
      
      return dataObj;
    }
    return obj ?? {};
  },
  ReplicationStatusSchemaBase
);

export const PoolStatsSchemaBase = z.object({
  summary: z
    .boolean()
    .optional()
    .default(true)
    .describe("Return key metrics only"),
  format: z.enum(["raw", "full", "summary"]).optional().describe("Alias for summary (use 'raw' or 'full' for false)"),
  raw: z.boolean().optional().describe("Alias for summary (set to true for false)"),
  verbose: z.boolean().optional().describe("Anti-Hallucination Alias for raw=true"),
  extended: z.boolean().optional().describe("Anti-Hallucination Alias for raw=true"),
  detailed: z.boolean().optional().describe("Anti-Hallucination Alias for raw=true"),
}).strict();

export const PoolStatsSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const dataObj = { ...obj };
      let summaryVal: unknown = undefined;
      let formatVal: unknown = undefined;
      let rawVal: unknown = undefined;
      let verboseVal: unknown = undefined;
      let detailedVal: unknown = undefined;
      let extendedVal: unknown = undefined;

      if ("summary" in dataObj) summaryVal = (dataObj as { summary?: unknown }).summary;
      if ("format" in dataObj) formatVal = (dataObj as { format?: unknown }).format;
      if ("raw" in dataObj) rawVal = (dataObj as { raw?: unknown }).raw;
      if ("verbose" in dataObj) verboseVal = (dataObj as { verbose?: unknown }).verbose;
      if ("detailed" in dataObj) detailedVal = (dataObj as { detailed?: unknown }).detailed;
      if ("extended" in dataObj) extendedVal = (dataObj as { extended?: unknown }).extended;

      if (verboseVal === true || verboseVal === "true" || verboseVal === 1 || verboseVal === "1") rawVal = true;
      if (detailedVal === true || detailedVal === "true" || detailedVal === 1 || detailedVal === "1") rawVal = true;
      if (extendedVal === true || extendedVal === "true" || extendedVal === 1 || extendedVal === "1") rawVal = true;

      // Alias handling for format and raw
      if (formatVal === "raw" || formatVal === "full" || rawVal === true || rawVal === "true" || rawVal === 1 || rawVal === "1") {
        summaryVal = false;
      }
      
      if (typeof summaryVal === "string") {
        if (summaryVal === "true" || summaryVal === "1") summaryVal = true;
        else if (summaryVal === "false" || summaryVal === "0") summaryVal = false;
      }
      if (typeof summaryVal === "number") summaryVal = summaryVal === 1;

      if (typeof rawVal === "string") {
        if (rawVal === "true" || rawVal === "1") rawVal = true;
        else if (rawVal === "false" || rawVal === "0") rawVal = false;
      }
      if (typeof rawVal === "number") rawVal = rawVal === 1;
      
      if (summaryVal !== undefined) Object.assign(dataObj, { summary: summaryVal });
      if (formatVal !== undefined) Object.assign(dataObj, { format: formatVal });
      if (rawVal !== undefined) Object.assign(dataObj, { raw: rawVal });
      
      delete (dataObj as Record<string, unknown>)["verbose"];
      delete (dataObj as Record<string, unknown>)["detailed"];
      delete (dataObj as Record<string, unknown>)["extended"];
      
      return dataObj;
    }
    return obj ?? {};
  },
  PoolStatsSchemaBase
);

export const ServerHealthSchemaBase = z.object({
  summary: z.boolean().optional().describe("Return key metrics only"),
  format: z.enum(["raw", "full", "summary"]).optional().describe("Controls detail level (raw, full, summary)"),
  raw: z.boolean().optional().describe("Alias for format='raw' (returns full metrics)"),
  verbose: z.boolean().optional().describe("Anti-Hallucination Alias for raw=true"),
  detailed: z.boolean().optional().describe("Anti-Hallucination Alias for raw=true"),
}).strict();

export const ServerHealthSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const dataObj = { ...obj };
      let summaryVal: unknown = undefined;
      let formatVal: unknown = undefined;
      let rawVal: unknown = undefined;
      let verboseVal: unknown = undefined;
      let detailedVal: unknown = undefined;
      
      if ("summary" in dataObj) summaryVal = (dataObj as { summary?: unknown }).summary;
      if ("format" in dataObj) formatVal = (dataObj as { format?: unknown }).format;
      if ("raw" in dataObj) rawVal = (dataObj as { raw?: unknown }).raw;
      if ("verbose" in dataObj) verboseVal = (dataObj as { verbose?: unknown }).verbose;
      if ("detailed" in dataObj) detailedVal = (dataObj as { detailed?: unknown }).detailed;
      
      if (verboseVal === true || verboseVal === "true" || verboseVal === 1 || verboseVal === "1") rawVal = true;
      if (detailedVal === true || detailedVal === "true" || detailedVal === 1 || detailedVal === "1") rawVal = true;
      
      if (formatVal === "raw" || formatVal === "full" || rawVal === true || rawVal === "true" || rawVal === 1 || rawVal === "1") summaryVal = false;
      else if (formatVal === "summary") summaryVal = true;
      if (typeof summaryVal === "string") {
        if (summaryVal === "true" || summaryVal === "1") summaryVal = true;
        else if (summaryVal === "false" || summaryVal === "0") summaryVal = false;
      }
      if (typeof summaryVal === "number") summaryVal = summaryVal === 1;
      
      if (typeof rawVal === "string") {
        if (rawVal === "true" || rawVal === "1") rawVal = true;
        else if (rawVal === "false" || rawVal === "0") rawVal = false;
      }
      if (typeof rawVal === "number") rawVal = rawVal === 1;
      
      if (summaryVal !== undefined) Object.assign(dataObj, { summary: summaryVal });
      if (formatVal !== undefined) Object.assign(dataObj, { format: formatVal });
      if (rawVal !== undefined) Object.assign(dataObj, { raw: rawVal });
      
      delete (dataObj as Record<string, unknown>)["verbose"];
      delete (dataObj as Record<string, unknown>)["detailed"];
      
      return dataObj;
    }
    return obj ?? {};
  },
  ServerHealthSchemaBase
);


// --- ServerConfig ---
export const ServerConfigSchemaBase = z.object({
  action: z
    .unknown()
    .optional()
    .describe("Whether to get or set the configuration value (get or set)."),
  setting: z
    .unknown()
    .optional()
    .describe("The setting to modify (e.g. logLevel)"),
  key: z.unknown().optional().describe("Alias for setting"),
  value: z
    .unknown()
    .optional()
    .describe("The new value for the setting (e.g., 'debug', 'info', 'warning')"),
  val: z.unknown().optional().describe("Alias for value"),
  config: z.unknown().optional().describe("Alias for setting/value pair"),
});

export const ServerConfigSchema = z.preprocess(
  (obj: unknown) => {
    if (obj === null || obj === undefined || typeof obj !== "object") return { action: "get" };
    
    const result = { ...obj };
    
    let actionVal: unknown = "action" in result ? (result as { action?: unknown }).action : undefined;
    let settingVal: unknown = "setting" in result ? (result as { setting?: unknown }).setting : undefined;
    const keyVal: unknown = "key" in result ? (result as { key?: unknown }).key : undefined;
    let valueVal: unknown = "value" in result ? (result as { value?: unknown }).value : undefined;
    const valVal: unknown = "val" in result ? (result as { val?: unknown }).val : undefined;
    const configVal: unknown = "config" in result ? (result as { config?: unknown }).config : undefined;

    if (actionVal === undefined) {
      if (settingVal !== undefined || valueVal !== undefined || configVal !== undefined) {
        actionVal = "set";
      } else {
        actionVal = "get";
      }
    }
    
    if (settingVal === undefined) {
      if (keyVal !== undefined) {
        settingVal = keyVal;
      } else if (typeof configVal === "object" && configVal !== null && "setting" in configVal) {
        settingVal = (configVal as { setting?: unknown }).setting;
      }
    }
    
    if (valueVal === undefined) {
      if (valVal !== undefined) {
        valueVal = valVal;
      } else if (typeof configVal === "object" && configVal !== null && "value" in configVal) {
        valueVal = (configVal as { value?: unknown }).value;
      }
    }
    
    if (typeof actionVal === "string") actionVal = actionVal.trim().toLowerCase();
    if (typeof settingVal === "string") settingVal = settingVal.trim();
    if (typeof valueVal === "string") valueVal = valueVal.trim();
    
    if (valueVal !== undefined && typeof valueVal !== "string") {
      valueVal = typeof valueVal === "number" || typeof valueVal === "boolean" || typeof valueVal === "bigint"
        ? String(valueVal) 
        : JSON.stringify(valueVal);
    }
    
    // Check if it's passed as config: { logLevel: "debug" }
    if (settingVal === undefined && valueVal === undefined && typeof configVal === "object" && configVal !== null) {
      const keys = Object.keys(configVal);
      const firstKey = keys[0];
      if (firstKey !== undefined) {
        settingVal = firstKey;
        const firstVal = (configVal as Record<string, unknown>)[firstKey];
        valueVal = typeof firstVal === "object" && firstVal !== null
          ? JSON.stringify(firstVal)
          : String(firstVal);
      }
    }
    
    return {
      ...result,
      action: actionVal,
      ...(settingVal !== undefined ? { setting: settingVal } : {}),
      ...(valueVal !== undefined ? { value: valueVal } : {}),
    };
  },
  z.object({
    action: z.enum(["get", "set"]),
    setting: z.enum(["logLevel"]).optional(),
    value: z.string().optional(),
  })
).refine(
  (data) => {
    if (data.action === "set") {
      return data.setting !== undefined && data.value !== undefined;
    }
    return true;
  },
  { message: "setting and value are required for 'set' action" }
);

// --- AuditSearch ---
export const AuditSearchSchemaBase = z.object({
  search: z.string().optional().describe("Fuzzy text search across tool, category, error, and args"),
  query: z.string().optional().describe("Alias for search"),
  sql: z.string().optional().describe("Alias for search"),
  tool: z.string().optional().describe("Filter by exact tool name"),
  category: z.string().optional().describe("Filter by category (e.g. read, write, admin)"),
  success: z.boolean().optional().describe("Filter by success status"),
  requestId: z.string().optional().describe("Filter by exact request ID"),
  fromTimestamp: z.iso.datetime({ offset: true, message: "Invalid date format. Must be a valid ISO 8601 string." }).optional().describe("Filter by start timestamp (ISO 8601)"),
  toTimestamp: z.iso.datetime({ offset: true, message: "Invalid date format. Must be a valid ISO 8601 string." }).optional().describe("Filter by end timestamp (ISO 8601)"),
  limit: z.number().int().min(1).max(100).default(5).describe("Max results to return"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
}).strict().refine(
  (data) => {
    return (
      data.search !== undefined ||
      data.query !== undefined ||
      data.sql !== undefined ||
      data.tool !== undefined ||
      data.category !== undefined ||
      data.success !== undefined ||
      data.requestId !== undefined ||
      data.fromTimestamp !== undefined ||
      data.toTimestamp !== undefined
    );
  },
  { message: "At least one filter is required" }
);

export const AuditSearchSchema = z.preprocess((obj: unknown) => {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  const record = obj as Record<string, unknown>;
  const result = { ...record };
  if (result["search"] === undefined && (result["query"] !== undefined || result["sql"] !== undefined)) {
    result["search"] = result["query"] ?? result["sql"];
  }
  if (typeof result["search"] === "number" || typeof result["search"] === "boolean") result["search"] = String(result["search"]);
  if (typeof result["query"] === "number" || typeof result["query"] === "boolean") result["query"] = String(result["query"]);
  if (typeof result["sql"] === "number" || typeof result["sql"] === "boolean") result["sql"] = String(result["sql"]);
  if (typeof result["tool"] === "number" || typeof result["tool"] === "boolean") result["tool"] = String(result["tool"]);
  if (typeof result["category"] === "number" || typeof result["category"] === "boolean") result["category"] = String(result["category"]);
  if (typeof result["limit"] === "string" || typeof result["limit"] === "number") {
    const num = Number(result["limit"]);
    if (Number.isNaN(num) || num < 1) {
      delete result["limit"];
    } else {
      result["limit"] = Math.min(100, Math.floor(num));
    }
  }
  if (typeof result["offset"] === "string" || typeof result["offset"] === "number") {
    const num = Number(result["offset"]);
    if (Number.isNaN(num) || num < 0) {
      delete result["offset"];
    } else {
      result["offset"] = Math.floor(num);
    }
  }
  if (typeof result["success"] === "string") {
    const s = result["success"].toLowerCase().trim();
    if (s === "true" || s === "1" || s === "yes" || s === "y") result["success"] = true;
    else if (s === "false" || s === "0" || s === "no" || s === "n") result["success"] = false;
    else delete result["success"];
  }
  if (typeof result["success"] === "number") {
    result["success"] = result["success"] > 0;
  }
  if (typeof result["fromTimestamp"] === "string" || typeof result["fromTimestamp"] === "number") {
    const d = new Date(result["fromTimestamp"]);
    if (!Number.isNaN(d.getTime())) {
      result["fromTimestamp"] = d.toISOString();
    } else if (typeof result["fromTimestamp"] === "number") {
      delete result["fromTimestamp"];
    }
  }
  if (typeof result["toTimestamp"] === "string" || typeof result["toTimestamp"] === "number") {
    const d = new Date(result["toTimestamp"]);
    if (!Number.isNaN(d.getTime())) {
      result["toTimestamp"] = d.toISOString();
    } else if (typeof result["toTimestamp"] === "number") {
      delete result["toTimestamp"];
    }
  }
  return result;
}, AuditSearchSchemaBase);

// --- AppendInsight ---
export const AppendInsightSchemaBase = z.object({
  insight: z
    .unknown()
    .optional()
    .describe(
      "Business insight text to record. Note: Pass insight, not text or message.",
    ),
  text: z.unknown().optional().describe("Alias for insight"),
  message: z.unknown().optional().describe("Alias for insight"),
});

export const AppendInsightSchema = z
  .preprocess(
    (obj: unknown) => {
      if (typeof obj === "object" && obj !== null) {
        const data = obj as Record<string, unknown>;
        let insightVal = data["insight"] ?? data["text"] ?? data["message"] ?? data["query"] ?? data["sql"] ?? data["name"] ?? data["table"];
        if (insightVal !== undefined && insightVal !== null && typeof insightVal !== "string") {
            insightVal = typeof insightVal === "number" || typeof insightVal === "boolean" || typeof insightVal === "bigint"
              ? String(insightVal) 
              : JSON.stringify(insightVal);
        }
        if (typeof insightVal === "string") {
            insightVal = insightVal.trim();
        }
        return {
          ...data,
          insight: insightVal,
        };
      }
      return obj;
    },
    z.object({
      insight: z.string().optional(),
    })
  )
  .transform((data) => ({
    insight: data.insight ?? "",
  }))
  .refine((data) => data.insight !== "", {
    message: "insight (or text/message alias) is required",
  });

// =============================================================================
// Output Schemas
// =============================================================================

import { BaseOutputSchema } from "./output-schemas.js";

// --- maintenance.ts ---
export const OptimizeTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    results: z.array(z.record(z.string(), z.unknown())),
    rowCount: z.number()
  }).optional()
});

export const AnalyzeTableOutputSchema = OptimizeTableOutputSchema;
export const CheckTableOutputSchema = OptimizeTableOutputSchema;
export const RepairTableOutputSchema = OptimizeTableOutputSchema;

export const FlushTablesOutputSchema = BaseOutputSchema.extend({
  data: z.object({}).optional()
});

export const KillQueryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    killed: z.number(),
    type: z.string()
  }).optional()
});

// --- monitoring.ts ---
export const ShowProcesslistOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    processes: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
    limited: z.boolean().optional(),
    totalAvailable: z.number().optional(),
    summary: z.record(z.string(), z.unknown()).optional()
  }).optional()
});

export const ShowStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    status: z.record(z.string(), z.unknown()),
    rowCount: z.number(),
    totalAvailable: z.number(),
    limited: z.boolean().optional(),
    summary: z.record(z.string(), z.unknown()).optional()
  }).optional()
});

export const ShowVariablesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    variables: z.record(z.string(), z.unknown()),
    rowCount: z.number(),
    totalAvailable: z.number(),
    limited: z.boolean().optional(),
    summary: z.record(z.string(), z.unknown()).optional()
  }).optional()
});

export const InnodbStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    summary: z.record(z.string(), z.unknown()).optional(),
    status: z.string().optional(),
    truncated: z.boolean().optional()
  }).optional()
});

export const ReplicationStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    configured: z.boolean(),
    message: z.string().optional(),
    status: z.record(z.string(), z.unknown()).optional(),
    summary: z.boolean().optional()
  }).optional()
});

export const PoolStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    poolStats: z.record(z.string(), z.unknown()),
    summary: z.boolean().optional()
  }).optional()
});

export const ServerHealthOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    serverHealth: z.record(z.string(), z.unknown()),
    summary: z.boolean().optional()
  }).optional()
});

// --- audit-search.ts ---
export const AuditSearchOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    entries: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
    totalCount: z.number()
  }).optional()
});

// --- audit-backup.ts ---
export const AuditListBackupsSchemaBase = z.object({
  limit: z
    .unknown()
    .optional()
    .describe("Max backups to return"),
  target: z
    .unknown()
    .optional()
    .describe("Filter by exact target object name (e.g. users)"),
  name: z.unknown().optional().describe("Alias for target"),
  tableName: z.unknown().optional().describe("Alias for target"),
  table: z.unknown().optional().describe("Alias for target"),
});

export const AuditListBackupsSchema = z
  .preprocess(
    (obj: unknown) => {
      if (typeof obj === "object" && obj !== null) {
        const data = obj as Record<string, unknown>;
        const rawLimit = data["limit"];
        let parsedLimit = rawLimit;
        if (typeof rawLimit === "string") {
          const num = Number(rawLimit);
          parsedLimit = isNaN(num) ? undefined : num;
        } else if (typeof rawLimit !== "number" && rawLimit !== undefined) {
          parsedLimit = undefined;
        }
        
        let target = data["target"] ?? data["name"] ?? data["tableName"] ?? data["table"];
        if (target !== undefined && target !== null && typeof target !== "string") {
          target = typeof target === "number" || typeof target === "boolean" || typeof target === "bigint"
            ? String(target) 
            : JSON.stringify(target);
        }

        return {
          ...data,
          target,
          limit: parsedLimit,
        };
      }
      return obj;
    },
    z.object({
      limit: z.number().int().min(1).max(100).default(5),
      target: z.string().optional(),
    })
  )
  .transform((data) => ({
    limit: data.limit,
    target: data.target,
  }));


export const AuditListBackupsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    backups: z.array(z.record(z.string(), z.unknown())),
    total: z.number()
  }).optional()
});

export const AuditRestoreBackupSchemaBase = z.object({
  filename: z.string().optional().describe("Snapshot filename to restore. Note: Pass filename, not table or target."),
  file: z.unknown().optional().describe("Alias for filename"),
  fileUrl: z.unknown().optional().describe("Alias for filename"),
  id: z.unknown().optional().describe("Alias for filename"),
  backupId: z.unknown().optional().describe("Alias for filename"),
  backup: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  table: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  tableName: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  target: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  sql: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  query: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  includeData: z
    .unknown()
    .optional()
    .describe("Execute INSERT data if present in snapshot"),
  withData: z.unknown().optional().describe("Alias for includeData"),
  data: z.unknown().optional().describe("Alias for includeData"),
  dryRun: z
    .unknown()
    .optional()
    .describe("Return the DDL/DML without executing it"),
});

export const AuditRestoreBackupSchema = z
  .preprocess(
    (obj: unknown) => {
      if (typeof obj === "object" && obj !== null) {
        const data = obj as Record<string, unknown>;
        const rawIncludeData = data["includeData"] ?? data["withData"] ?? data["data"];
        const parsedIncludeData = rawIncludeData === "true" || rawIncludeData === true || rawIncludeData === 1 || rawIncludeData === "1";
        
        const rawDryRun = data["dryRun"];
        const parsedDryRun = rawDryRun === "true" || rawDryRun === true || rawDryRun === 1 || rawDryRun === "1";

        let filename = data["filename"] ?? data["file"] ?? data["fileUrl"] ?? data["id"] ?? data["backupId"] ?? data["backup"] ?? data["table"] ?? data["tableName"] ?? data["target"] ?? data["sql"] ?? data["query"];
        if (filename !== undefined && filename !== null && typeof filename !== "string") {
          filename = typeof filename === "number" || typeof filename === "boolean" || typeof filename === "bigint"
            ? String(filename) 
            : JSON.stringify(filename);
        }

        return {
          ...data,
          filename,
          ...(rawIncludeData !== undefined && { includeData: parsedIncludeData }),
          ...(rawDryRun !== undefined && { dryRun: parsedDryRun }),
        };
      }
      return obj;
    },
    z.object({
      filename: z.string().optional(),
      includeData: z.boolean().default(false),
      dryRun: z.boolean().default(false),
    })
  )
  .transform((data) => ({
    filename: data.filename ?? "",
    includeData: data.includeData,
    dryRun: data.dryRun,
  }))
  .refine((data) => data.filename !== "", {
    message: "filename (or file/fileUrl alias) is required",
  })
  .refine((data) => data.filename === "" || data.filename.endsWith(".gz") || data.filename.endsWith(".json") || data.filename.endsWith(".sql") || data.filename.endsWith(".txt"), {
    message: "'filename' must be a valid snapshot file (ending in .snapshot.json.gz). You provided a target or table name. Please use mysql_audit_list_backups to get the exact filename.",
  });


export const AuditRestoreBackupOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    dryRun: z.boolean().optional(),
    sql: z.string().optional(),
    restoredFilename: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }).optional()
});

export const AuditDiffBackupSchemaBase = z.object({
  filename: z
    .unknown()
    .optional()
    .describe("Snapshot filename to compare against current schema. Note: Pass filename, not table or target."),
  file: z.unknown().optional().describe("Alias for filename"),
  fileUrl: z.unknown().optional().describe("Alias for filename"),
  id: z.unknown().optional().describe("Alias for filename"),
  backupId: z.unknown().optional().describe("Alias for filename"),
  backup: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  table: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  tableName: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  target: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  sql: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  query: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
  name: z.unknown().optional().describe("Alias for filename (anti-hallucination)"),
});

export const AuditDiffBackupSchema = z
  .preprocess(
    (obj: unknown) => {
      if (typeof obj === "object" && obj !== null) {
        const data = obj as Record<string, unknown>;
        let filename = data["filename"] ?? data["file"] ?? data["fileUrl"] ?? data["id"] ?? data["backupId"] ?? data["backup"] ?? data["table"] ?? data["tableName"] ?? data["target"] ?? data["sql"] ?? data["query"] ?? data["name"];
        
        if (typeof filename === "number" || typeof filename === "boolean") {
          filename = String(filename);
        }

        return {
          ...data,
          filename,
        };
      }
      return obj;
    },
    z.object({
      filename: z.string().optional(),
    })
  )
  .transform((data) => ({
    filename: data.filename ?? "",
  }))
  .refine((data) => data.filename !== "", {
    message: "filename (or file/fileUrl alias) is required",
  })
  .refine((data) => data.filename === "" || data.filename.endsWith(".gz") || data.filename.endsWith(".json") || data.filename.endsWith(".sql") || data.filename.endsWith(".txt"), {
    message: "'filename' must be a valid snapshot file (ending in .snapshot.json.gz). You provided a target or table name. Please use mysql_audit_list_backups to get the exact filename.",
  });


export const AuditDiffBackupOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    snapshotDdl: z.string(),
    liveDdl: z.string(),
    metadata: z.record(z.string(), z.unknown())
  }).optional()
});

// --- insights.ts ---
export const AppendInsightOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    insightCount: z.number(),
    message: z.string()
  }).optional()
});

// --- server-config.ts ---
export const ServerConfigOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    config: z.record(z.string(), z.unknown()).optional(),
    message: z.string().optional()
  }).optional()
});
