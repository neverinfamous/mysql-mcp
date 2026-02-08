/**
 * MySQL Group Replication and InnoDB Cluster Tools
 *
 * Tools for managing MySQL high-availability solutions.
 * 10 tools total (5 GR + 5 Cluster).
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

// Import from submodules
import {
  createGRStatusTool,
  createGRMembersTool,
  createGRPrimaryTool,
  createGRTransactionsTool,
  createGRFlowControlTool,
} from "./group-replication.js";

import {
  createClusterStatusTool,
  createClusterInstancesTool,
  createClusterTopologyTool,
  createClusterRouterStatusTool,
  createClusterSwitchoverTool,
} from "./innodb-cluster.js";

/**
 * Get all cluster tools
 */
export function getClusterTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createGRStatusTool(adapter),
    createGRMembersTool(adapter),
    createGRPrimaryTool(adapter),
    createGRTransactionsTool(adapter),
    createGRFlowControlTool(adapter),
    createClusterStatusTool(adapter),
    createClusterInstancesTool(adapter),
    createClusterTopologyTool(adapter),
    createClusterRouterStatusTool(adapter),
    createClusterSwitchoverTool(adapter),
  ];
}
