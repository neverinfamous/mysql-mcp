import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { InnodbStatusOutputSchema } from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { z } from "zod";

/**
 * Parse InnoDB status output into key metrics summary
 */
function parseInnodbStatusSummary(rawStatus: string): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  // Buffer Pool section
  const bufferPoolMatch = /Buffer pool size\s+(\d+)/.exec(rawStatus);
  const freeBuffersMatch = /Free buffers\s+(\d+)/.exec(rawStatus);
  const hitRateMatch = /Buffer pool hit rate\s+(\d+)\s*\/\s*(\d+)/.exec(
    rawStatus,
  );

  if (bufferPoolMatch ?? freeBuffersMatch ?? hitRateMatch) {
    summary["bufferPool"] = {
      size: bufferPoolMatch
        ? parseInt(bufferPoolMatch[1] ?? "0", 10)
        : undefined,
      freeBuffers: freeBuffersMatch
        ? parseInt(freeBuffersMatch[1] ?? "0", 10)
        : undefined,
      hitRate: hitRateMatch
        ? `${hitRateMatch[1] ?? "0"}/${hitRateMatch[2] ?? "0"}`
        : undefined,
    };
  }

  // Row Operations section
  const rowOpsMatch =
    /(\d+(?:\.\d+)?)\s+inserts\/s,\s*(\d+(?:\.\d+)?)\s+updates\/s,\s*(\d+(?:\.\d+)?)\s+deletes\/s,\s*(\d+(?:\.\d+)?)\s+reads\/s/.exec(
      rawStatus,
    );
  if (rowOpsMatch) {
    summary["rowOperations"] = {
      insertsPerSec: parseFloat(rowOpsMatch[1] ?? "0"),
      updatesPerSec: parseFloat(rowOpsMatch[2] ?? "0"),
      deletesPerSec: parseFloat(rowOpsMatch[3] ?? "0"),
      readsPerSec: parseFloat(rowOpsMatch[4] ?? "0"),
    };
  }

  // Log section
  const logSeqMatch = /Log sequence number\s+(\d+)/.exec(rawStatus);
  const checkpointMatch = /Last checkpoint at\s+(\d+)/.exec(rawStatus);
  if (logSeqMatch ?? checkpointMatch) {
    summary["log"] = {
      sequenceNumber: logSeqMatch
        ? parseInt(logSeqMatch[1] ?? "0", 10)
        : undefined,
      lastCheckpoint: checkpointMatch
        ? parseInt(checkpointMatch[1] ?? "0", 10)
        : undefined,
    };
  }

  // Transactions section
  const historyListMatch = /History list length\s+(\d+)/.exec(rawStatus);
  const trxCountMatch = /Trx id counter\s+(\d+)/.exec(rawStatus);
  if (historyListMatch ?? trxCountMatch) {
    summary["transactions"] = {
      historyListLength: historyListMatch
        ? parseInt(historyListMatch[1] ?? "0", 10)
        : undefined,
      trxIdCounter: trxCountMatch
        ? parseInt(trxCountMatch[1] ?? "0", 10)
        : undefined,
    };
  }

  // Semaphores section
  const osWaitsMatch = /OS WAIT ARRAY INFO: reservation count (\d+)/.exec(
    rawStatus,
  );
  if (osWaitsMatch) {
    summary["semaphores"] = {
      osWaitReservations: parseInt(osWaitsMatch[1] ?? "0", 10),
    };
  }

  return summary;
}

const InnodbStatusSchema = z.object({
  summary: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Return parsed summary with key metrics. Set to true for parsed output, false for raw string output.",
    ),
});

export function createInnodbStatusTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_innodb_status",
    title: "MySQL InnoDB Status",
    description:
      "Get detailed InnoDB engine status. Defaults to parsed summary. Use summary=false for raw output.",
    group: "monitoring",
    inputSchema: InnodbStatusSchema,
    outputSchema: InnodbStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { summary } = InnodbStatusSchema.parse(params);
        const result = await adapter.executeQuery("SHOW ENGINE INNODB STATUS");
        const rawRow = result.rows?.[0];
        const rawStatus =
          typeof rawRow?.["Status"] === "string" ? rawRow["Status"] :
          typeof rawRow?.["STATUS"] === "string" ? rawRow["STATUS"] :
          "";

        if (summary) {
          const data = { summary: parseInnodbStatusSummary(rawStatus) };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify({ success: true, data }), "utf8") / 4,
          );
          return { success: true, data, metrics: { tokenEstimate } };
        }

        const maxRawLength = 1000;
        const statusStr =
          rawStatus.length > maxRawLength
            ? rawStatus.substring(0, maxRawLength) + "\n... (truncated)"
            : rawStatus;

        const data = {
          status: statusStr,
          ...(rawStatus.length > maxRawLength && { truncated: true }),
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify({ success: true, data }), "utf8") / 4,
        );
        return { success: true, data, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
