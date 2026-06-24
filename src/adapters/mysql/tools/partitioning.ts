/**
 * MySQL Partitioning Tools
 *
 * Partition management for table partitioning.
 * 4 tools: partition_info, add_partition, drop_partition, reorganize_partition.
 */

import type { MySQLAdapter } from "../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import {
  formatMysqlError,
  formatHandlerErrorResponse,
} from "./core/error-helpers.js";
import {
  PartitionInfoSchema,
  PartitionInfoSchemaBase,
  AddPartitionSchema,
  AddPartitionSchemaBase,
  DropPartitionSchema,
  DropPartitionSchemaBase,
  ReorganizePartitionSchema,
  ReorganizePartitionSchemaBase,
  PartitionInfoOutputSchema,
  AddPartitionOutputSchema,
  DropPartitionOutputSchema,
  ReorganizePartitionOutputSchema,
} from "../schemas/partitioning.js";
import { READ_ONLY, WRITE, DESTRUCTIVE } from "../../../utils/annotations.js";

/**
 * Get partitioning tools
 */
export function getPartitioningTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createPartitionInfoTool(adapter),
    createAddPartitionTool(adapter),
    createDropPartitionTool(adapter),
    createReorganizePartitionTool(adapter),
  ];
}

function createPartitionInfoTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_partition_info",
    title: "MySQL Partition Info",
    description: "Get partition information for a table.",
    group: "partitioning",
    inputSchema: PartitionInfoSchemaBase,
    outputSchema: PartitionInfoOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, summary, database } = PartitionInfoSchema.parse(params);

        if (database) {
          const dbCheck = await adapter.executeQuery(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [database],
          );
          if (!dbCheck.rows || dbCheck.rows.length === 0) {
            const response = {
              success: false as const,
              error: `Database '${database}' does not exist`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
        }

        const dbFilter = database ? `?` : `DATABASE()`;
        const checkParams = database ? [database, table] : [table];

        // Check if table exists (P154)
        const tableCheck = await adapter.executeQuery(
          `SELECT TABLE_NAME FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = ${dbFilter} AND TABLE_NAME = ?`,
          checkParams,
        );

        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          const response = {
            success: false as const,
            error: `Table '${table}' does not exist`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        const result = await adapter.executeQuery(
          `
                SELECT
                    PARTITION_NAME,
                    PARTITION_ORDINAL_POSITION,
                    PARTITION_METHOD,
                    PARTITION_EXPRESSION,
                    PARTITION_DESCRIPTION,
                    TABLE_ROWS,
                    AVG_ROW_LENGTH,
                    DATA_LENGTH,
                    INDEX_LENGTH,
                    CREATE_TIME,
                    UPDATE_TIME
                FROM information_schema.PARTITIONS
                WHERE TABLE_SCHEMA = ${dbFilter}
                  AND TABLE_NAME = ?
                ORDER BY PARTITION_ORDINAL_POSITION
            `,
          checkParams,
        );

        // Check if table is partitioned
        const firstRow = result.rows?.[0];
        if (!firstRow || firstRow["PARTITION_NAME"] === null) {
          const response = {
            success: true as const,
            data: {
              partitioned: false,
            },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        // Map partitions according to summary mode
        const partitions = (result.rows ?? []).map((row) => {
          if (summary) {
            return {
              PARTITION_NAME: row["PARTITION_NAME"],
              PARTITION_METHOD: row["PARTITION_METHOD"],
              PARTITION_EXPRESSION: row["PARTITION_EXPRESSION"],
              PARTITION_DESCRIPTION: row["PARTITION_DESCRIPTION"],
              TABLE_ROWS: row["TABLE_ROWS"],
            };
          }
          return row;
        });

        const response = {
          success: true as const,
          data: {
            partitioned: true,
            method: firstRow["PARTITION_METHOD"],
            expression: firstRow["PARTITION_EXPRESSION"],
            partitions,
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

function createAddPartitionTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_add_partition",
    title: "MySQL Add Partition",
    description: "Add a new partition to a partitioned table.",
    group: "partitioning",
    inputSchema: AddPartitionSchemaBase,
    outputSchema: AddPartitionOutputSchema,
    requiredScopes: ["admin"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, partitionName, partitionType, value, database } =
          AddPartitionSchema.parse(params);

        if (database) {
          const dbCheck = await adapter.executeQuery(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [database],
          );
          if (!dbCheck.rows || dbCheck.rows.length === 0) {
            const response = {
              success: false as const,
              error: `Database '${database}' does not exist`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
        }

        const dbFilter = database ? `?` : `DATABASE()`;
        const checkParams = database ? [database, table] : [table];

        // P154: Check if table exists
        const tableCheck = await adapter.executeQuery(
          `SELECT TABLE_NAME FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = ${dbFilter} AND TABLE_NAME = ?`,
          checkParams,
        );
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          const response = {
            success: false as const,
            error: `Table '${table}' does not exist`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        let sql: string;
        const tableRef = database ? `\`${database}\`.\`${table}\`` : `\`${table}\``;

        switch (partitionType) {
          case "RANGE":
          case "RANGE COLUMNS":
            sql = `ALTER TABLE ${tableRef} ADD PARTITION (PARTITION \`${partitionName}\` VALUES LESS THAN (${value}))`;
            break;
          case "LIST":
          case "LIST COLUMNS":
            sql = `ALTER TABLE ${tableRef} ADD PARTITION (PARTITION \`${partitionName}\` VALUES IN (${value}))`;
            break;
          case "HASH":
          case "KEY":
            sql = `ALTER TABLE ${tableRef} ADD PARTITION PARTITIONS ${value}`;
            break;
          default: {
            const unexpectedType: never = partitionType as never;
            const response = {
              success: false as const,
              error: `Unsupported partition type: ${String(unexpectedType)}`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
        }

        try {
          await adapter.executeQuery(sql);
          adapter.clearSchemaCache();
          const response = {
            success: true as const,
            data: { table, partitionName },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);

          if (msg.includes("not partitioned")) {
            const response = {
              success: false as const,
              error: `Table '${table}' is not partitioned`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
          if (msg.includes("MAXVALUE")) {
            const response = {
              success: false as const,
              error: `Cannot add RANGE partition — existing MAXVALUE partition must be reorganized first using mysql_reorganize_partition`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
          if (msg.includes("Multiple definition")) {
            const response = {
              success: false as const,
              error: `Partition value(s) already exist in another partition`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }

          const response = {
            success: false as const,
            error: formatMysqlError(error),
            code: "UNKNOWN_ERROR",
            category: "internal",
            recoverable: false,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

function createDropPartitionTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_drop_partition",
    title: "MySQL Drop Partition",
    description:
      "Drop a partition from a partitioned table. Warning: This deletes all data in the partition!",
    group: "partitioning",
    inputSchema: DropPartitionSchemaBase,
    outputSchema: DropPartitionOutputSchema,
    requiredScopes: ["admin"],
    annotations: DESTRUCTIVE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, partitionName, database } = DropPartitionSchema.parse(params);

        if (database) {
          const dbCheck = await adapter.executeQuery(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [database],
          );
          if (!dbCheck.rows || dbCheck.rows.length === 0) {
            const response = {
              success: false as const,
              error: `Database '${database}' does not exist`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
        }

        const dbFilter = database ? `?` : `DATABASE()`;
        const checkParams = database ? [database, table] : [table];

        // P154: Check if table exists
        const tableCheck = await adapter.executeQuery(
          `SELECT TABLE_NAME FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = ${dbFilter} AND TABLE_NAME = ?`,
          checkParams,
        );
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          const response = {
            success: false as const,
            error: `Table '${table}' does not exist`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        try {
          const tableRef = database ? `\`${database}\`.\`${table}\`` : `\`${table}\``;
          await adapter.executeQuery(
            `ALTER TABLE ${tableRef} DROP PARTITION \`${partitionName}\``,
          );

          adapter.clearSchemaCache();
          const response = {
            success: true as const,
            data: {
              table,
              partitionName,
              warning: "All data in this partition has been deleted",
            },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);

          if (msg.includes("not partitioned")) {
            const response = {
              success: false as const,
              error: `Table '${table}' is not partitioned`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
          if (
            msg.includes("Error in list of partitions") ||
            msg.includes("Unknown partition")
          ) {
            const response = {
              success: false as const,
              error: `Partition '${partitionName}' does not exist on table '${table}'`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }

          const response = {
            success: false as const,
            error: formatMysqlError(error),
            code: "UNKNOWN_ERROR",
            category: "internal",
            recoverable: false,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

function createReorganizePartitionTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_reorganize_partition",
    title: "MySQL Reorganize Partition",
    description: "Reorganize partitions by splitting or merging them.",
    group: "partitioning",
    inputSchema: ReorganizePartitionSchemaBase,
    outputSchema: ReorganizePartitionOutputSchema,
    requiredScopes: ["admin"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, fromPartitions, partitionType, toPartitions, database } =
          ReorganizePartitionSchema.parse(params);

        if (database) {
          const dbCheck = await adapter.executeQuery(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [database],
          );
          if (!dbCheck.rows || dbCheck.rows.length === 0) {
            const response = {
              success: false as const,
              error: `Database '${database}' does not exist`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
        }

        const dbFilter = database ? `?` : `DATABASE()`;
        const checkParams = database ? [database, table] : [table];

        // P154: Check if table exists
        const tableCheck = await adapter.executeQuery(
          `SELECT TABLE_NAME FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = ${dbFilter} AND TABLE_NAME = ?`,
          checkParams,
        );
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          const response = {
            success: false as const,
            error: `Table '${table}' does not exist`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        const fromList = fromPartitions.map((p) => `\`${p}\``).join(", ");
        const toList = toPartitions
          .map((p) => {
            if (
              partitionType === "RANGE" ||
              partitionType === "RANGE COLUMNS"
            ) {
              return `PARTITION \`${p.name}\` VALUES LESS THAN (${p.value})`;
            } else {
              return `PARTITION \`${p.name}\` VALUES IN (${p.value})`;
            }
          })
          .join(", ");

        const tableRef = database ? `\`${database}\`.\`${table}\`` : `\`${table}\``;
        const sql = `ALTER TABLE ${tableRef} REORGANIZE PARTITION ${fromList} INTO (${toList})`;

        try {
          await adapter.executeQuery(sql);
          adapter.clearSchemaCache();
          const response = {
            success: true as const,
            data: {
              table,
              fromPartitions,
              toPartitions: toPartitions.map((p) => p.name),
            },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);

          if (msg.includes("not partitioned")) {
            const response = {
              success: false as const,
              error: `Table '${table}' is not partitioned`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
          if (msg.includes("Error in list of partitions")) {
            const response = {
              success: false as const,
              error: `One or more source partitions (${fromPartitions.join(", ")}) do not exist on table '${table}'`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: false,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }

          const response = {
            success: false as const,
            error: formatMysqlError(error),
            code: "UNKNOWN_ERROR",
            category: "internal",
            recoverable: false,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }
      } catch (err: unknown) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
