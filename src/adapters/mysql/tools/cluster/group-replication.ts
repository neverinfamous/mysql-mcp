/**
 * MySQL Group Replication Tools
 *
 * Tools for managing MySQL Group Replication.
 * 5 tools total: status, members, primary, transactions, flow control.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ExtensionNotAvailableError, MySQLMcpError, ErrorCategory } from "../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  MemberSchema,
  MemberSchemaBase,
  GRStatusOutputSchema,
  GRMembersOutputSchema,
  GRPrimaryOutputSchema,
  GRTransactionsOutputSchema,
  GRFlowControlOutputSchema,
} from "../../schemas/cluster.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

// =============================================================================
// Schemas
// =============================================================================

// Moved to schemas/cluster.ts
const EmptyArgsSchema = z.object({}).strict().describe("Takes no arguments.");

// =============================================================================
// Tool Creation Functions
// =============================================================================

/**
 * Get Group Replication status
 */
export function createGRStatusTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_gr_status",
    title: "MySQL Group Replication Status",
    description:
      "Get comprehensive Group Replication status including mode and member state.",
    group: "cluster",
    inputSchema: EmptyArgsSchema,
    outputSchema: GRStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        EmptyArgsSchema.parse(_params);
        // Check if GR is running
        const pluginResult = await adapter.executeQuery("/* readonly */ SHOW PLUGINS");
        const grPlugin = pluginResult.rows?.find((row) => row["Name"] === "group_replication");
        if (grPlugin?.["Status"] !== "ACTIVE") {
          return formatHandlerErrorResponse(
            new ExtensionNotAvailableError("Group Replication")
          );
        }

        const statusResult = await adapter.executeQuery(`/* readonly */
                SELECT 
                    @@group_replication_group_name as groupName,
                    @@group_replication_single_primary_mode as singlePrimaryMode,
                    @@group_replication_local_address as localAddress,
                    @@group_replication_group_seeds as groupSeeds,
                    @@group_replication_bootstrap_group as bootstrapGroup
            `);

        const config = statusResult.rows?.[0];

        // Get member status from performance_schema
        const memberResult = await adapter.executeQuery(`/* readonly */
                SELECT 
                    CHANNEL_NAME,
                    MEMBER_ID,
                    MEMBER_HOST,
                    MEMBER_PORT,
                    MEMBER_STATE,
                    MEMBER_ROLE,
                    MEMBER_VERSION
                FROM performance_schema.replication_group_members
            `);

        // Get local member info
        const localResult = await adapter.executeQuery(`/* readonly */
                SELECT @@server_uuid as serverUuid
            `);

        const localUuidVal = localResult.rows?.[0]?.["serverUuid"];
        const localUuid = typeof localUuidVal === "string" ? localUuidVal : "";
        const members = memberResult.rows ?? [];
        const mappedMembers = members.map((m) => {
          return {
            id: typeof m["MEMBER_ID"] === "string" ? m["MEMBER_ID"] : "",
            host: typeof m["MEMBER_HOST"] === "string" ? m["MEMBER_HOST"] : "",
            port: Number(m["MEMBER_PORT"] ?? 3306),
            state: typeof m["MEMBER_STATE"] === "string" ? m["MEMBER_STATE"] : "",
            role: typeof m["MEMBER_ROLE"] === "string" ? m["MEMBER_ROLE"] : "",
            version: typeof m["MEMBER_VERSION"] === "string" ? m["MEMBER_VERSION"] : "",
            isLocal: m["MEMBER_ID"] === localUuid,
          };
        });

        const localMemberMapped = mappedMembers.find((m) => m.isLocal) ?? null;

        const data = {
          enabled: members.length > 0,
          groupName: config?.["groupName"] ?? null,
          singlePrimaryMode: config?.["singlePrimaryMode"] === 1,
          localAddress: config?.["localAddress"] ?? null,
          localMember: localMemberMapped,
          memberCount: mappedMembers.length,
          members: mappedMembers,
        };
        return withTokenEstimate({ success: true, data });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Get Group Replication members
 */
export function createGRMembersTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_gr_members",
    title: "MySQL GR Members",
    description:
      "List all Group Replication members with detailed state information.",
    group: "cluster",
    inputSchema: MemberSchemaBase,
    outputSchema: GRMembersOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { memberId } = MemberSchema.parse(params);

        // Check if GR is running
        const pluginResult = await adapter.executeQuery("/* readonly */ SHOW PLUGINS");
        const grPlugin = pluginResult.rows?.find((row) => row["Name"] === "group_replication");
        if (grPlugin?.["Status"] !== "ACTIVE") {
          return formatHandlerErrorResponse(
            new ExtensionNotAvailableError("Group Replication")
          );
        }

        let query = `
                SELECT 
                    m.MEMBER_ID as memberId,
                    m.MEMBER_HOST as host,
                    m.MEMBER_PORT as port,
                    m.MEMBER_STATE as state,
                    m.MEMBER_ROLE as role,
                    m.MEMBER_VERSION as version,
                    s.COUNT_TRANSACTIONS_IN_QUEUE as txInQueue,
                    s.COUNT_TRANSACTIONS_CHECKED as txChecked,
                    s.COUNT_CONFLICTS_DETECTED as conflictsDetected,
                    s.COUNT_TRANSACTIONS_ROWS_VALIDATING as rowsValidating
                FROM performance_schema.replication_group_members m
                LEFT JOIN performance_schema.replication_group_member_stats s
                    ON m.MEMBER_ID = s.MEMBER_ID
            `;

        const queryParams: unknown[] = [];
        if (memberId) {
          query += " WHERE m.MEMBER_ID = ?";
          queryParams.push(memberId);
        }

        const result = await adapter.executeQuery(`/* readonly */ ${query}`, queryParams);
        
        const rawMembers = result.rows ?? [];
        const members = rawMembers.map((m) => ({
          memberId: typeof m["memberId"] === "string" ? m["memberId"] : "",
          host: typeof m["host"] === "string" ? m["host"] : "",
          port: Number(m["port"] ?? 3306),
          state: typeof m["state"] === "string" ? m["state"] : "",
          role: typeof m["role"] === "string" ? m["role"] : "",
          version: typeof m["version"] === "string" ? m["version"] : "",
          txInQueue: m["txInQueue"] !== undefined && m["txInQueue"] !== null ? Number(m["txInQueue"]) : null,
          txChecked: m["txChecked"] !== undefined && m["txChecked"] !== null ? Number(m["txChecked"]) : null,
          conflictsDetected: m["conflictsDetected"] !== undefined && m["conflictsDetected"] !== null ? Number(m["conflictsDetected"]) : null,
          rowsValidating: m["rowsValidating"] !== undefined && m["rowsValidating"] !== null ? Number(m["rowsValidating"]) : null,
        }));

        const data = {
          members,
          count: members.length,
        };
        return withTokenEstimate({ success: true, data });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Identify current primary
 */
export function createGRPrimaryTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_gr_primary",
    title: "MySQL GR Primary",
    description:
      "Identify the current primary member in a single-primary GR cluster.",
    group: "cluster",
    inputSchema: EmptyArgsSchema,
    outputSchema: GRPrimaryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        EmptyArgsSchema.parse(_params);
        // Check if GR is running
        const pluginResult = await adapter.executeQuery("/* readonly */ SHOW PLUGINS");
        const grPlugin = pluginResult.rows?.find((row) => row["Name"] === "group_replication");
        if (grPlugin?.["Status"] !== "ACTIVE") {
          return formatHandlerErrorResponse(
            new ExtensionNotAvailableError("Group Replication")
          );
        }

        const modeResult = await adapter.executeQuery("/* readonly */ SELECT @@group_replication_single_primary_mode as singlePrimaryMode");
        if (Number(modeResult.rows?.[0]?.["singlePrimaryMode"]) !== 1) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "mysql_gr_primary is only applicable in single-primary Group Replication clusters. The cluster is currently in multi-primary mode.",
              "INVALID_MODE",
              ErrorCategory.CONFIGURATION,
              {
                suggestion: "Use mysql_gr_members to see all members in a multi-primary cluster.",
                recoverable: false
              }
            )
          );
        }

        const result = await adapter.executeQuery(`/* readonly */
                SELECT 
                    MEMBER_ID as memberId,
                    MEMBER_HOST as host,
                    MEMBER_PORT as port,
                    MEMBER_STATE as state,
                    MEMBER_VERSION as version
                FROM performance_schema.replication_group_members
                WHERE MEMBER_ROLE = 'PRIMARY'
            `);

        const rawPrimary = result.rows?.[0];
        let primary = null;
        if (rawPrimary) {
          primary = {
            memberId: typeof rawPrimary["memberId"] === "string" ? rawPrimary["memberId"] : "",
            host: typeof rawPrimary["host"] === "string" ? rawPrimary["host"] : "",
            port: Number(rawPrimary["port"] ?? 3306),
            state: typeof rawPrimary["state"] === "string" ? rawPrimary["state"] : "",
            version: typeof rawPrimary["version"] === "string" ? rawPrimary["version"] : "",
          };
        }

        // Check if we are the primary
        const localResult = await adapter.executeQuery(
          "/* readonly */ SELECT @@server_uuid as serverUuid",
        );
        const localUuidVal = localResult.rows?.[0]?.["serverUuid"];
        const localUuid = typeof localUuidVal === "string" ? localUuidVal : "";

        const data = {
          primary: primary ?? null,
          hasPrimary: !!primary,
          isLocalPrimary: !!primary && primary.memberId === localUuid,
        };
        return withTokenEstimate({ success: true, data });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Get transaction status
 */
export function createGRTransactionsTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_gr_transactions",
    title: "MySQL GR Transactions",
    description:
      "Get Group Replication transaction statistics and pending transactions.",
    group: "cluster",
    inputSchema: EmptyArgsSchema,
    outputSchema: GRTransactionsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        EmptyArgsSchema.parse(_params);
        // Check if GR is running
        const pluginResult = await adapter.executeQuery("/* readonly */ SHOW PLUGINS");
        const grPlugin = pluginResult.rows?.find((row) => row["Name"] === "group_replication");
        if (grPlugin?.["Status"] !== "ACTIVE") {
          return formatHandlerErrorResponse(
            new ExtensionNotAvailableError("Group Replication")
          );
        }

        // Get transaction statistics
        const statsResult = await adapter.executeQuery(`/* readonly */
                SELECT 
                    MEMBER_ID as memberId,
                    COUNT_TRANSACTIONS_IN_QUEUE as txInQueue,
                    COUNT_TRANSACTIONS_CHECKED as txChecked,
                    COUNT_CONFLICTS_DETECTED as conflictsDetected,
                    COUNT_TRANSACTIONS_ROWS_VALIDATING as rowsValidating,
                    COUNT_TRANSACTIONS_REMOTE_IN_APPLIER_QUEUE as remoteInApplierQueue,
                    COUNT_TRANSACTIONS_REMOTE_APPLIED as remoteApplied,
                    COUNT_TRANSACTIONS_LOCAL_PROPOSED as localProposed,
                    COUNT_TRANSACTIONS_LOCAL_ROLLBACK as localRollback
                FROM performance_schema.replication_group_member_stats
            `);

        // Get GTID info
        const gtidResult = await adapter.executeQuery(`/* readonly */
                SELECT 
                    @@gtid_executed as gtidExecuted,
                    @@gtid_purged as gtidPurged
            `);

        const gtid = gtidResult.rows?.[0];

        const rawStats = statsResult.rows ?? [];
        const memberStats = rawStats.map((row) => ({
          memberId: typeof row["memberId"] === "string" ? row["memberId"] : "",
          txInQueue: Number(row["txInQueue"] ?? 0),
          txChecked: Number(row["txChecked"] ?? 0),
          conflictsDetected: Number(row["conflictsDetected"] ?? 0),
          rowsValidating: Number(row["rowsValidating"] ?? 0),
          remoteInApplierQueue: Number(row["remoteInApplierQueue"] ?? 0),
          remoteApplied: Number(row["remoteApplied"] ?? 0),
          localProposed: Number(row["localProposed"] ?? 0),
          localRollback: Number(row["localRollback"] ?? 0),
        }));

        const data = {
          memberStats,
          gtid: {
            executed: typeof gtid?.["gtidExecuted"] === "string" ? gtid["gtidExecuted"] : "",
            purged: typeof gtid?.["gtidPurged"] === "string" ? gtid["gtidPurged"] : "",
          },
        };
        return withTokenEstimate({ success: true, data });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Get flow control statistics
 */
export function createGRFlowControlTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_gr_flow_control",
    title: "MySQL GR Flow Control",
    description:
      "Get Group Replication flow control statistics and throttling info.",
    group: "cluster",
    inputSchema: EmptyArgsSchema,
    outputSchema: GRFlowControlOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        EmptyArgsSchema.parse(_params);
        // Check if GR is running
        const pluginResult = await adapter.executeQuery("/* readonly */ SHOW PLUGINS");
        const grPlugin = pluginResult.rows?.find((row) => row["Name"] === "group_replication");
        if (grPlugin?.["Status"] !== "ACTIVE") {
          return formatHandlerErrorResponse(
            new ExtensionNotAvailableError("Group Replication")
          );
        }

        // Get flow control configuration
        const configResult = await adapter.executeQuery(`/* readonly */
                (SELECT 
                    @@group_replication_flow_control_mode as flowControlMode,
                    @@group_replication_flow_control_certifier_threshold as certifierThreshold,
                    @@group_replication_flow_control_applier_threshold as applierThreshold,
                    @@group_replication_flow_control_min_quota as minQuota,
                    @@group_replication_flow_control_min_recovery_quota as minRecoveryQuota,
                    @@group_replication_flow_control_max_quota as maxQuota)
            `);

        const config = configResult.rows?.[0];

        // Get current queue depths
        const queueResult = await adapter.executeQuery(`/* readonly */
                (SELECT 
                    MEMBER_ID as memberId,
                    COUNT_TRANSACTIONS_IN_QUEUE as certifyQueue,
                    COUNT_TRANSACTIONS_REMOTE_IN_APPLIER_QUEUE as applierQueue
                FROM performance_schema.replication_group_member_stats)
            `);

        // Determine if flow control is active
        const isThrottling = (queueResult.rows ?? []).some((row) => {
          const r = row;
          const certQueue = Number(r["certifyQueue"] ?? 0);
          const appQueue = Number(r["applierQueue"] ?? 0);

          const certThreshold = Number(config?.["certifierThreshold"] ?? 25000);

          const appThreshold = Number(config?.["applierThreshold"] ?? 25000);
          return (certThreshold > 0 && certQueue > certThreshold) || (appThreshold > 0 && appQueue > appThreshold);
        });

        const data = {
          configuration: config ?? {},
          memberQueues: queueResult.rows ?? [],
          isThrottling,
          recommendation: isThrottling
            ? "Flow control is active. Consider investigating slow members or adjusting thresholds."
            : "Flow control is not currently throttling.",
        };
        return withTokenEstimate({ success: true, data });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
