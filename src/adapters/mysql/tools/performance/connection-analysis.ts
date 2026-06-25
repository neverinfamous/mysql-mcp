/**
 * MySQL Performance Tools - Connection Analysis
 *
 * Detects unusual connection patterns: concentration by user/host,
 * idle connection buildup (Sleep command), and overall connection pressure.
 *
 * Tools:
 *   - mysql_detect_connection_spike: connection concentration detection
 */

import { z, ZodError } from "zod";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { DetectConnectionSpikeOutputSchema } from "../../schemas/index.js";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import { toNum, toStr, riskFromScore } from "./anomaly-detection.js";
import { READ_ONLY } from "../../../../utils/annotations.js";
import { ValidationError } from "../../../../types/index.js";

// =============================================================================
// Schemas
// =============================================================================

export const DetectConnectionSpikeSchemaBase = z.object({
  warningPercent: z
    .unknown()
    .optional()
    .describe("Percentage threshold for flagging concentration (default: 70)"),
  windowMinutes: z
    .unknown()
    .optional()
    .describe("Idle time window in minutes to flag connections (default: 5)"),
  thresholdPercent: z.unknown().optional().describe("Alias for warningPercent"),
});

export const DetectConnectionSpikeSchema = z.object({
  warningPercent: z.coerce
    .number()
    .min(0)
    .optional()
    .describe("Percentage threshold for flagging concentration (default: 70)"),
  windowMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Idle time window in minutes to flag connections (default: 5)"),
  thresholdPercent: z.coerce.number().min(0).optional().describe("Alias for warningPercent"),
});

// =============================================================================
// Tool Definition
// =============================================================================

interface ConnectionConcentration {
  dimension: string;
  value: string;
  count: number;
  percent: number;
}

export function createDetectConnectionSpikeTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_detect_connection_spike",
    title: "Detect Connection Spike",
    description:
      "Detects unusual connection patterns by analyzing concentration by user, host, and state. Flags when a single user monopolizes the pool or idle connections accumulate.",
    inputSchema: DetectConnectionSpikeSchemaBase,
    outputSchema: DetectConnectionSpikeOutputSchema,
    group: "performance",
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = DetectConnectionSpikeSchema.parse(params);

        const rawPercent =
          parsed.thresholdPercent ?? parsed.warningPercent ?? 70;
        if (rawPercent < 0 || rawPercent > 100) {
          throw new ValidationError("warningPercent (or thresholdPercent) must be between 0 and 100");
        }
        const warningPercent = rawPercent;
        const windowMinutes = parsed.windowMinutes ?? 5;

        if (windowMinutes < 1 || windowMinutes > 1440) {
          throw new ValidationError("windowMinutes must be between 1 and 1440");
        }
        const idleSeconds = windowMinutes * 60;

        // Gather connection data in parallel
        const [processlistResult, maxResult] = await Promise.all([
          adapter.executeQuery(`
            SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE
            FROM information_schema.PROCESSLIST
          `),
          adapter.executeQuery(`SHOW GLOBAL VARIABLES LIKE 'max_connections'`),
        ]);

        const processes = processlistResult.rows ?? [];

        // Filter out the system daemon threads (e.g., event_scheduler)
        const userProcesses = processes.filter(
          (r) => toStr(r["USER"]) !== "system user",
        );

        const totalConnections = userProcesses.length;
        const maxConnections = toNum(maxResult.rows?.[0]?.["Value"]);
        const usagePercent =
          maxConnections > 0
            ? Math.round((totalConnections / maxConnections) * 100 * 10) / 10
            : 0;

        const concentrations: ConnectionConcentration[] = [];
        const warnings: string[] = [];

        // Aggregate by state/command
        const commandCounts: Record<string, number> = {};
        const userCounts: Record<string, number> = {};
        const hostCounts: Record<string, number> = {};

        for (const p of userProcesses) {
          const cmd = toStr(p["COMMAND"], "Unknown");
          const user = toStr(p["USER"], "Unknown");
          const hostRaw = toStr(p["HOST"], "Unknown");
          const host = hostRaw.split(":")[0] ?? "Unknown"; // strip port

          commandCounts[cmd] = (commandCounts[cmd] ?? 0) + 1;
          userCounts[user] = (userCounts[user] ?? 0) + 1;
          hostCounts[host] = (hostCounts[host] ?? 0) + 1;
        }

        const byState = Object.entries(commandCounts).map(([state, count]) => ({
          state,
          count,
        }));
        byState.sort((a, b) => b.count - a.count);

        // Check user concentration
        for (const [user, count] of Object.entries(userCounts)) {
          const percent =
            totalConnections > 0
              ? Math.round((count / totalConnections) * 100 * 10) / 10
              : 0;
          if (percent >= warningPercent) {
            concentrations.push({
              dimension: "user",
              value: user,
              count,
              percent,
            });
            warnings.push(
              `User '${user}' holds ${String(percent)}% of connections (${String(count)}/${String(totalConnections)})`,
            );
          }
        }

        // Check host concentration
        for (const [host, count] of Object.entries(hostCounts)) {
          const percent =
            totalConnections > 0
              ? Math.round((count / totalConnections) * 100 * 10) / 10
              : 0;
          if (percent >= warningPercent) {
            concentrations.push({
              dimension: "host",
              value: host,
              count,
              percent,
            });
            warnings.push(
              `Host '${host}' holds ${String(percent)}% of connections (${String(count)}/${String(totalConnections)})`,
            );
          }
        }

        // Check idle (Sleep) connection buildup
        const idleRows = userProcesses.filter(
          (r) => toStr(r["COMMAND"]) === "Sleep",
        );
        if (idleRows.length > 0) {
          const longIdle = idleRows.filter(
            (r) => toNum(r["TIME"]) > idleSeconds,
          );
          if (longIdle.length > 0) {
            warnings.push(
              `${String(longIdle.length)} connection(s) sleeping for >${String(windowMinutes)} minutes — these hold resources unnecessarily`,
            );
          }
          if (
            idleRows.length >= 50 &&
            idleRows.length / totalConnections > 0.5
          ) {
            warnings.push(
              `${String(idleRows.length)} total sleeping connections — consider lowering wait_timeout`,
            );
          }
        }

        // Check overall pressure
        if (usagePercent >= 90) {
          warnings.push(
            `Critical connection pressure: ${String(usagePercent)}% of max_connections in use`,
          );
        } else if (usagePercent >= 80) {
          warnings.push(
            `High connection pressure: ${String(usagePercent)}% of max_connections in use`,
          );
        }

        // Calculate risk level
        let riskScore = 0;
        if (usagePercent >= 90) riskScore += 40;
        else if (usagePercent >= 80) riskScore += 25;
        else if (usagePercent >= 70) riskScore += 10;

        if (concentrations.length >= 2) riskScore += 30;
        else if (concentrations.length >= 1) riskScore += 15;

        if (idleRows.length >= 50) riskScore += 25;
        else if (idleRows.length >= 20) riskScore += 10;

        const riskLevel = riskFromScore(riskScore);

        const summary =
          warnings.length === 0
            ? `No connection anomalies detected (${String(totalConnections)}/${String(maxConnections)} connections, ${String(usagePercent)}% usage)`
            : `${String(warnings.length)} warning(s) detected: ${String(totalConnections)}/${String(maxConnections)} connections (${String(usagePercent)}% usage)`;

        const response = {
          success: true,
          data: {
            totalConnections,
            maxConnections,
            usagePercent,
            byState,
            concentrations,
            warnings,
            riskLevel,
            summary,
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
