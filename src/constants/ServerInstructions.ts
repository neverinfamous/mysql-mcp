/**
 * Server instructions for MySQL MCP.
 *
 * These instructions are automatically sent to MCP clients during initialization,
 * providing guidance for AI agents on tool usage.
 */

import type {
  ToolGroup,
  ResourceDefinition,
  PromptDefinition,
} from "../types/index.js";
import { TOOL_GROUPS } from "../filtering/ToolConstants.js";

/**
 * Base instructions that are always included
 */
const BASE_INSTRUCTIONS = `# mysql-mcp Usage Instructions

## Server Identity

- **Server Name**: This server is identified as \`user-mysql\` in MCP client configurations.
- **Tool Invocation**: When calling tools via MCP, they are prefixed with the server name (e.g., \`user-mysql-mysql_json_extract\`, \`user-mysql-mysql_read_query\`).
- **Resources**: 
  - Resources use the \`mysql://\` URI scheme (e.g., \`mysql://capabilities\`, \`mysql://schema\`).
  - When listing or fetching resources, use server name \`user-mysql\` (e.g., \`list_mcp_resources(server: "user-mysql")\`, \`fetch_mcp_resource(server: "user-mysql", uri: "mysql://schema")\`).

## JSON Tools (\`mysql_json_*\`)

- **Automatic String Handling**: JSON tools automatically convert bare strings to valid JSON.
  - ✅ \`value: "green"\` → stored as JSON string \`"green"\`
  - ✅ \`value: 42\` → stored as number \`42\`
  - ✅ \`value: {"key": "val"}\` → stored as object
  - ✅ \`value: "[1,2,3]"\` → stored as array (already valid JSON)
- **Validation**: Creating or updating JSON values enforces JSON validity after auto-conversion.

## Transactions & Safety (\`mysql_transaction_*\`)

- Use transactions for multi-step changes:
  1. Call \`mysql_transaction_begin\` → get \`transactionId\`
  2. Perform updates with \`transactionId\`
  3. If successful, \`mysql_transaction_commit\`
  4. If error, \`mysql_transaction_rollback\`

## Document Store (\`mysql_doc_*\`)

- **Filter Syntax** (for \`mysql_doc_modify\`, \`mysql_doc_remove\`):
  - **By _id**: Pass the 32-character hex _id directly: \`filter: "686dd247b9724bcfa08ce6f1efed8b77"\`
  - **By field value**: Use \`field=value\` format: \`filter: "name=Alice"\` or \`filter: "age=30"\`
  - **By existence**: Use JSON path: \`filter: "$.address"\` (matches docs where address field exists)
  - ❌ Incorrect: \`filter: "$.name == 'Alice'"\` (comparison operators not supported in path)
  - ✅ Correct: \`filter: "name=Alice"\` (field=value format)
- **Find Filters** (\`mysql_doc_find\`): The filter parameter checks for field existence using JSON path (e.g., \`$.address.zip\`).

## Fulltext Search (\`mysql_fulltext_boolean\`)

- Uses MySQL boolean operators: \`+word\` (AND), \`-word\` (NOT), \`word*\` (wildcard), \`> <\` (relevance weighting)

## DDL Statements (\`mysql_write_query\`)

- DDL statements (like \`CREATE TABLE\`) are automatically handled via text protocol fallback.

## Role Management

- Role tools require appropriate privileges.
- \`mysql_role_grant\` supports \`db.table\` syntax (e.g., \`GRANT SELECT ON my_schema.my_table\`).

## Group Replication (\`mysql_gr_*\`)

- Tools check for \`group_replication\` plugin status and return "not active" if plugin is not active.

## MySQL Router Tools (\`mysql_router_*\`)

- **Prerequisites**: Router REST API requires InnoDB Cluster to be running (authentication uses \`metadata_cache\` backend)
- **Self-signed certificates**: Set \`MYSQL_ROUTER_INSECURE=true\` to bypass TLS certificate verification for development/testing
- **Route names**: Use \`mysql_router_routes\` to list available routes (e.g., \`bootstrap_rw\`, \`bootstrap_ro\`)
- **Metadata cache**: The \`metadataName\` parameter is typically \`bootstrap\` for bootstrapped routers

## Partitioning Tools (\`mysql_partition_*\`, \`mysql_add_partition\`, \`mysql_drop_partition\`, \`mysql_reorganize_partition\`)

- **Value Parameter**: The \`value\` parameter expects only the boundary value, NOT the full SQL clause.
  - ❌ Incorrect: \`value: "LESS THAN (2024)"\` (SQL syntax error - duplicates keywords)
  - ✅ Correct: \`value: "2024"\` for RANGE partitions
  - ✅ Correct: \`value: "1,2,3"\` for LIST partitions
  - ✅ Correct: \`value: "4"\` for HASH/KEY (number of partitions to add)
- **Reorganize**: Requires \`partitionType\` parameter (RANGE or LIST). HASH/KEY partitions cannot be reorganized.
- **Drop Warning**: \`mysql_drop_partition\` permanently deletes all data in the partition.

## Spatial Tools (\`mysql_spatial_*\`)

- **Coordinate Order**: All spatial tools use standard **longitude, latitude** parameter order (X, Y), matching GeoJSON and common mapping conventions.
  - ✅ Example: \`{ longitude: -122.4194, latitude: 37.7749 }\` for San Francisco
  - MySQL 8.0+ uses EPSG standard axis order (latitude, longitude) internally for SRID 4326, but tools handle this conversion automatically using \`axis-order=long-lat\` option.
- **SRID 4326**: Default spatial reference system is WGS 84 (GPS coordinates). Use \`srid\` parameter to specify other coordinate systems.

## Text Tools (\`mysql_like_search\`, \`mysql_regexp_match\`, etc.)

- **LIKE patterns**: \`%\` matches any characters, \`_\` matches single character.
- **Regex**: Uses MySQL regex syntax (not PCRE). Example: \`^[A-Z].*@.*\\.com$\`
- **SOUNDEX**: Finds phonetically similar values - matches alternative spellings (e.g., \`johndoe\` matches \`jonedoe\`).
- **WHERE clause**: All text tools support optional \`where\` parameter to filter rows.
- **Minimal output**: Tools return only \`id\`, target column(s), and computed result.
`;

/**
 * Generate dynamic instructions based on enabled tools, resources, and prompts
 */
export function generateInstructions(
  enabledTools: Set<string>,
  resources: ResourceDefinition[],
  prompts: PromptDefinition[],
): string {
  let instructions = BASE_INSTRUCTIONS;

  // Add active tools section
  const activeGroups = getActiveToolGroups(enabledTools);
  if (activeGroups.length > 0) {
    instructions += "\n## Active Tools\n\n";
    instructions += `This server instance has ${enabledTools.size} tools enabled across ${activeGroups.length} groups:\n\n`;

    for (const { group, tools } of activeGroups) {
      instructions += `### ${group} (${tools.length} tools)\n`;
      instructions += tools.map((t) => `- \`${t}\``).join("\n");
      instructions += "\n\n";
    }
  }

  // Add resources section
  if (resources.length > 0) {
    instructions += `## Active Resources (${resources.length})\n\n`;
    instructions += "Read-only resources for database metadata:\n\n";
    for (const resource of resources) {
      instructions += `- \`${resource.uri}\` - ${resource.description}\n`;
    }
    instructions += "\n";
  }

  // Add prompts section
  if (prompts.length > 0) {
    instructions += `## Active Prompts (${prompts.length})\n\n`;
    instructions += "Pre-built query templates and guided workflows:\n\n";
    for (const prompt of prompts) {
      instructions += `- \`${prompt.name}\` - ${prompt.description}\n`;
    }
    instructions += "\n";
  }

  return instructions;
}

/**
 * Get active tool groups with their enabled tools
 */
function getActiveToolGroups(
  enabledTools: Set<string>,
): { group: ToolGroup; tools: string[] }[] {
  const activeGroups: { group: ToolGroup; tools: string[] }[] = [];

  for (const [group, allTools] of Object.entries(TOOL_GROUPS) as [
    ToolGroup,
    string[],
  ][]) {
    const enabledInGroup = allTools.filter((tool) => enabledTools.has(tool));
    if (enabledInGroup.length > 0) {
      activeGroups.push({ group, tools: enabledInGroup });
    }
  }

  return activeGroups;
}

/**
 * Static instructions for backward compatibility
 * @deprecated Use generateInstructions() instead for dynamic content
 */
export const SERVER_INSTRUCTIONS = BASE_INSTRUCTIONS;
