/**
 * MySQL Resource - Document Store
 */
import type { MySQLAdapter } from "../mysql-adapter/index.js";
import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";

export function createDocstoreResource(
  adapter: MySQLAdapter,
): ResourceDefinition {
  return {
    uri: "mysql://docstore",
    name: "Document Store Collections",
    title: "MySQL Document Store",
    description: "X DevAPI document collections in the current database",
    mimeType: "application/json",
    annotations: {
      audience: ["user", "assistant"],
      priority: 0.5,
    },
    handler: async (_uri: string, _context: RequestContext) => {
      try {
        // Performance optimization: run both independent queries in parallel
        const pluginResult = await adapter.executeQuery(
          "SELECT PLUGIN_STATUS FROM information_schema.PLUGINS WHERE PLUGIN_NAME = 'mysqlx'",
        );

        const tablesResult = await adapter.executeQuery("SHOW TABLE STATUS");
        const collectionsResultRows: Record<string, unknown>[] = [];
        if (tablesResult.rows) {
          for (const row of tablesResult.rows) {
            const tableName = row['Name'] as string;
            try {
              const columnsResult = await adapter.executeQuery(`SHOW COLUMNS FROM \`${tableName}\``);
              let hasDoc = false;
              let hasId = false;
              if (columnsResult.rows) {
                for (const col of columnsResult.rows) {
                  const field = col['Field'];
                  const type = typeof col['Type'] === 'string' ? col['Type'].toLowerCase() : '';
                  if (field === 'doc' && type.includes('json')) hasDoc = true;
                  if (field === '_id') hasId = true;
                }
              }
              if (hasDoc && hasId) {
                collectionsResultRows.push({
                  collection_name: tableName,
                  row_count: Number(row['Rows'] ?? 0),
                  size_bytes: Number(row['Data_length'] ?? 0) + Number(row['Index_length'] ?? 0)
                });
              }
            } catch {
              // Ignore table access errors
            }
          }
        }

        const pluginRow = pluginResult.rows?.[0];
        const xPluginEnabled = pluginRow?.["PLUGIN_STATUS"] === "ACTIVE";

        return {
          xPluginEnabled,
          collectionCount: collectionsResultRows.length,
          collections: collectionsResultRows,
          note: xPluginEnabled
            ? "X Plugin is active - X Protocol available on port 33060"
            : "X Plugin not active - document store limited to SQL access",
        };
      } catch {
        return {
          xPluginEnabled: false,
          collectionCount: 0,
          collections: [],
          error: "Unable to retrieve document store information",
        };
      }
    },
  };
}
