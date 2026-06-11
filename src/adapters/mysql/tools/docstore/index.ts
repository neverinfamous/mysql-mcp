import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition } from "../../../../types/index.js";
import { getTools as getCollectionTools } from "./collection.js";
import { getTools as getDocumentTools } from "./documents.js";
import { getTools as getIndexTools } from "./indexes.js";

export function getDocStoreTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    ...getCollectionTools(adapter),
    ...getDocumentTools(adapter),
    ...getIndexTools(adapter),
  ];
}
