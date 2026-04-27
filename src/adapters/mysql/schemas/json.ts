import { z } from "zod";
import { preprocessJsonColumnParams } from "./preprocess-utils.js";

// =============================================================================
// JSON Schemas
// =============================================================================

// --- JsonExtract ---
export const JsonExtractSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path (e.g., $.name or $[0])"),
  where: z.string().optional().describe("WHERE clause for filtering rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonExtractSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonSet ---
export const JsonSetSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to set"),
  value: z.unknown().describe("Value to set"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonSetSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonContains ---
export const JsonContainsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  value: z.unknown().optional().describe("Value to search for"),
  contains: z.unknown().optional().describe("Alias for value"),
  path: z.string().optional().describe("Optional JSON path to search within"),
});

export const JsonContainsSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      value: z.unknown().optional(),
      contains: z.unknown().optional(),
      path: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    value: data.value ?? data.contains,
    path: data.path,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.value !== undefined, {
    message: "value (or contains alias) is required",
  });

// --- JsonKeys ---
export const JsonKeysSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().optional().describe("Optional JSON path (defaults to root)"),
});

export const JsonKeysSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonSearch ---
export const JsonSearchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  searchValue: z.string().describe("String value to search for"),
  mode: z
    .enum(["one", "all"])
    .optional()
    .default("one")
    .describe("Search mode"),
});

export const JsonSearchSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      searchValue: z.string(),
      mode: z.enum(["one", "all"]).optional().default("one"),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    searchValue: data.searchValue,
    mode: data.mode,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonInsert ---
export const JsonInsertSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to insert at"),
  value: z.unknown().describe("Value to insert"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonInsertSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonReplace ---
export const JsonReplaceSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to replace"),
  value: z.unknown().describe("Replacement value"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonReplaceSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonRemove ---
export const JsonRemoveSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  paths: z.array(z.string()).optional().describe("JSON paths to remove"),
  path: z.string().optional().describe("Alias for single path to remove"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonRemoveSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      paths: z.array(z.string()).optional(),
      path: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    paths: data.paths ?? (data.path ? [data.path] : []),
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.paths.length > 0, {
    message:
      "paths (or path alias) is required and must contain at least one element",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonArrayAppend ---
export const JsonArrayAppendSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to array"),
  value: z.unknown().describe("Value to append"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonArrayAppendSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonGet ---
export const JsonGetSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to extract"),
  id: z.union([z.string(), z.number()]).describe("Row ID"),
  idColumn: z.string().default("id").describe("ID column name"),
});

export const JsonGetSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      id: z.union([z.string(), z.number()]),
      idColumn: z.string().default("id"),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    id: data.id,
    idColumn: data.idColumn,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonUpdate ---
export const JsonUpdateSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to update"),
  value: z.unknown().describe("New value"),
  id: z.union([z.string(), z.number()]).describe("Row ID"),
  idColumn: z.string().default("id").describe("ID column name"),
});

export const JsonUpdateSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      id: z.union([z.string(), z.number()]),
      idColumn: z.string().default("id"),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    id: data.id,
    idColumn: data.idColumn,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonNormalize ---
export const JsonNormalizeSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  where: z.string().optional().describe("WHERE clause"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.number().default(100).describe("Maximum rows to process"),
});

export const JsonNormalizeSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.number().default(100),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonStats ---
export const JsonStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  where: z.string().optional().describe("Optional WHERE clause"),
  filter: z.string().optional().describe("Alias for where"),
  sampleSize: z.number().default(1000).describe("Sample size for statistics"),
});

export const JsonStatsSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      sampleSize: z.number().default(1000),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    where: data.where ?? data.filter,
    sampleSize: data.sampleSize,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonIndexSuggest ---
export const JsonIndexSuggestSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  sampleSize: z.number().default(100).describe("Sample size to analyze"),
});

export const JsonIndexSuggestSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      sampleSize: z.number().default(100),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    sampleSize: data.sampleSize,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonValidate (no table/column — no aliases needed) ---
export const JsonValidateSchema = z.object({
  value: z.string().describe("JSON string to validate"),
});
