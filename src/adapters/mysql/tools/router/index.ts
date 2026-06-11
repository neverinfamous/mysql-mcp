import type { ToolDefinition } from "../../../../types/index.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";

import {
  createRouterStatusTool,
  createRouterRoutesTool,
} from "./status.js";
import {
  createRouterRouteStatusTool,
  createRouterRouteHealthTool,
  createRouterRouteConnectionsTool,
  createRouterRouteDestinationsTool,
  createRouterRouteBlockedHostsTool,
} from "./routes.js";
import { createRouterMetadataStatusTool } from "./metadata.js";
import { createRouterPoolStatusTool } from "./pool.js";

export function getRouterTools(_adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createRouterStatusTool(),
    createRouterRoutesTool(),
    createRouterRouteStatusTool(),
    createRouterRouteHealthTool(),
    createRouterRouteConnectionsTool(),
    createRouterRouteDestinationsTool(),
    createRouterRouteBlockedHostsTool(),
    createRouterMetadataStatusTool(),
    createRouterPoolStatusTool(),
  ];
}
