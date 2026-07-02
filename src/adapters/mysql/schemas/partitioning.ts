import { z } from "zod";
import { preprocessTableParams } from "./preprocess-utils.js";
import { BaseOutputSchema } from "./output-schemas.js";

// =============================================================================
// Partitioning Schemas
// =============================================================================

// --- PartitionInfo ---
export const PartitionInfoSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  database: z.string().optional().describe("Database name"),
  summary: z
    .boolean()
    .optional()
    .describe(
      "If true, returns a lighter payload without column details (default: true)",
    ),
});

export const PartitionInfoSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      database: z.string().optional(),
      summary: z.boolean().optional().default(true),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    database: data.database,
    summary: data.summary,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- AddPartition ---
export const AddPartitionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  database: z.string().optional().describe("Database name"),
  partitionName: z.string().optional().describe("New partition name"),
  partitionType: z
    .enum(["RANGE", "LIST", "HASH", "KEY", "RANGE COLUMNS", "LIST COLUMNS"])
    .optional()
    .describe("Partition type"),
  value: z
    .string()
    .optional()
    .describe(
      'Partition boundary value only - e.g., "2024" for RANGE, "1,2,3" for LIST, "4" for HASH/KEY partitions count. Do NOT include "LESS THAN" or "VALUES IN" keywords.',
    ),
});

export const AddPartitionSchema = z
  .preprocess(
    (val) => {
      const v = preprocessTableParams(val);
      if (typeof v === "object" && v !== null) {
        const obj = v as Record<string, unknown>;
        if (typeof obj["partitionType"] === "string") {
          obj["partitionType"] = obj["partitionType"].toUpperCase();
        } else if (obj["partitionType"] === undefined && typeof obj["type"] === "string") {
          obj["partitionType"] = obj["type"].toUpperCase();
        }
        
        if (obj["partitionName"] === undefined) {
          if (obj["partition"] !== undefined) obj["partitionName"] = obj["partition"];
        }
      }
      return v;
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      database: z.string().optional(),
      partitionName: z.string().optional(),
      partitionType: z
        .enum(["RANGE", "LIST", "HASH", "KEY", "RANGE COLUMNS", "LIST COLUMNS"])
        .optional(),
      value: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    database: data.database,
    partitionName: data.partitionName ?? "",
    partitionType: data.partitionType ? data.partitionType : "RANGE",
    value: data.value ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.partitionName !== "", {
    message: "partitionName is required",
  })
  .refine((data) => data.value !== "", {
    message: "value is required",
  });

// --- DropPartition ---
export const DropPartitionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  database: z.string().optional().describe("Database name"),
  partitionName: z.string().optional().describe("Partition name to drop"),
  partition: z.string().optional().describe("Alias for partitionName"),
});

export const DropPartitionSchema = z
  .preprocess(
    (val) => {
      const v = preprocessTableParams(val);
      if (typeof v === "object" && v !== null) {
        const obj = v as Record<string, unknown>;
        if (
          obj["partitionName"] === undefined
        ) {
          if (obj["partition"] !== undefined) obj["partitionName"] = obj["partition"];
          else if (obj["name"] !== undefined && obj["table"] !== obj["name"]) obj["partitionName"] = obj["name"];
        }
      }
      return v;
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      database: z.string().optional(),
      partitionName: z.string().optional(),
      partition: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    database: data.database,
    partitionName: data.partitionName ?? data.partition ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.partitionName !== "", {
    message: "partitionName (or partition alias) is required",
  });

// --- ReorganizePartition ---
export const ReorganizePartitionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  database: z.string().optional().describe("Database name"),
  fromPartitions: z
    .array(z.string())
    .optional()
    .describe("Source partition names"),
  partitionType: z
    .enum(["RANGE", "LIST", "HASH", "KEY", "RANGE COLUMNS", "LIST COLUMNS"])
    .optional()
    .describe(
      "Partition type (RANGE, LIST, RANGE COLUMNS, LIST COLUMNS). HASH/KEY partitions cannot be reorganized.",
    ),
  toPartitions: z
    .array(
      z.object({
        name: z.string().describe("New partition name"),
        value: z
          .string()
          .describe(
            'Partition boundary value only - e.g., "2024" for RANGE, "1,2,3" for LIST. Do NOT include "LESS THAN" or "VALUES IN" keywords.',
          ),
      }),
    )
    .optional()
    .describe("New partition definitions"),
});

export const ReorganizePartitionSchema = z
  .preprocess(
    (val) => {
      const v = preprocessTableParams(val);
      if (typeof v === "object" && v !== null) {
        const obj = v as Record<string, unknown>;
        if (typeof obj["partitionType"] === "string") {
          obj["partitionType"] = obj["partitionType"].toUpperCase();
        } else if (obj["partitionType"] === undefined && typeof obj["type"] === "string") {
          obj["partitionType"] = obj["type"].toUpperCase();
        }
        
        if (obj["fromPartitions"] === undefined) {
          if (obj["partitions"] !== undefined) obj["fromPartitions"] = obj["partitions"];
          else if (obj["from"] !== undefined) obj["fromPartitions"] = obj["from"];
          else if (obj["sourcePartitions"] !== undefined) obj["fromPartitions"] = obj["sourcePartitions"];
        }
        
        if (obj["toPartitions"] === undefined) {
          if (obj["into"] !== undefined) obj["toPartitions"] = obj["into"];
          else if (obj["intoPartitions"] !== undefined) obj["toPartitions"] = obj["intoPartitions"];
          else if (obj["newPartitions"] !== undefined) obj["toPartitions"] = obj["newPartitions"];
          else if (obj["to"] !== undefined) obj["toPartitions"] = obj["to"];
        }
        
        if (typeof obj["toPartitions"] === "object" && obj["toPartitions"] !== null && !Array.isArray(obj["toPartitions"])) {
          obj["toPartitions"] = [obj["toPartitions"]];
        }
        
        if (typeof obj["fromPartitions"] === "string") {
          obj["fromPartitions"] = [obj["fromPartitions"]];
        }
      }
      return v;
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      database: z.string().optional(),
      fromPartitions: z.array(z.string()).optional(),
      partitionType: z
        .enum(["RANGE", "LIST", "RANGE COLUMNS", "LIST COLUMNS"])
        .optional(),
      toPartitions: z
        .array(
          z.object({
            name: z.string(),
            value: z.string(),
          }),
        )
        .optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    database: data.database,
    fromPartitions: data.fromPartitions ?? [],
    partitionType: data.partitionType ? data.partitionType : "RANGE",
    toPartitions: data.toPartitions ?? [],
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.fromPartitions.length > 0, {
    message: "fromPartitions is required",
  })
  .refine((data) => data.toPartitions.length > 0, {
    message: "toPartitions is required",
  });

export const PartitionInfoOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    partitioned: z.boolean(),
    method: z.unknown().optional(),
    expression: z.unknown().optional(),
    partitions: z.array(z.record(z.string(), z.unknown())).optional(),
  }).loose().optional(),
});

export const AddPartitionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string(),
    partitionName: z.string(),
  }).loose().optional(),
});

export const DropPartitionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string(),
    partitionName: z.string(),
    warning: z.string().optional(),
  }).loose().optional(),
});

export const ReorganizePartitionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string(),
    fromPartitions: z.array(z.string()),
    toPartitions: z.array(z.string()),
  }).loose().optional(),
});
