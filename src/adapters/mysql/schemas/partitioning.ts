import { z } from "zod";
import { preprocessTableParams } from "./preprocess-utils.js";

// =============================================================================
// Partitioning Schemas
// =============================================================================

// --- PartitionInfo ---
export const PartitionInfoSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  summary: z.boolean().optional().describe("If true, returns a lighter payload without column details (default: true)"),
});

export const PartitionInfoSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      summary: z.boolean().optional().default(true),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
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
  partitionName: z.string().describe("New partition name"),
  partitionType: z
    .enum(["RANGE", "LIST", "HASH", "KEY"])
    .describe("Partition type"),
  value: z
    .string()
    .describe(
      'Partition boundary value only - e.g., "2024" for RANGE, "1,2,3" for LIST, "4" for HASH/KEY partitions count. Do NOT include "LESS THAN" or "VALUES IN" keywords.',
    ),
});

export const AddPartitionSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      partitionName: z.string(),
      partitionType: z.enum(["RANGE", "LIST", "HASH", "KEY"]),
      value: z.string(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    partitionName: data.partitionName,
    partitionType: data.partitionType,
    value: data.value,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- DropPartition ---
export const DropPartitionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  partitionName: z.string().optional().describe("Partition name to drop"),
  partition: z.string().optional().describe("Alias for partitionName"),
});

export const DropPartitionSchema = z
  .preprocess(
    (val) => {
      const v = preprocessTableParams(val);
      if (typeof v === "object" && v !== null) {
        const obj = v as Record<string, unknown>;
        if (obj["partitionName"] === undefined && obj["partition"] !== undefined) {
          obj["partitionName"] = obj["partition"];
        }
      }
      return v;
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      partitionName: z.string().optional(),
      partition: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
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
  fromPartitions: z.array(z.string()).describe("Source partition names"),
  partitionType: z
    .enum(["RANGE", "LIST", "HASH", "KEY"])
    .describe(
      "Partition type (RANGE or LIST). HASH/KEY partitions cannot be reorganized.",
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
    .describe("New partition definitions"),
});

export const ReorganizePartitionSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      fromPartitions: z.array(z.string()),
      partitionType: z.enum(["RANGE", "LIST"]),
      toPartitions: z.array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      ),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    fromPartitions: data.fromPartitions,
    partitionType: data.partitionType,
    toPartitions: data.toPartitions,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

