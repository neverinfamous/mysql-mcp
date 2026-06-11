import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition } from "../../../../types/index.js";

import { getRoleListTool } from "./list.js";
import { getRoleCreateTool } from "./create.js";
import { getRoleDropTool } from "./drop.js";
import { getRoleGrantsTools } from "./grants.js";
import { getRoleAssignTools } from "./assign.js";

export function getRoleTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    getRoleListTool(adapter),
    getRoleCreateTool(adapter),
    getRoleDropTool(adapter),
    ...getRoleGrantsTools(adapter),
    ...getRoleAssignTools(adapter),
  ];
}
