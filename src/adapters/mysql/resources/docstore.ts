/**
 * MySQL Resource - Document Store
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
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
        // Check if X Plugin is enabled
        const pluginResult = await adapter.executeQuery(
          "SELECT PLUGIN_STATUS FROM information_schema.PLUGINS WHERE PLUGIN_NAME = 'mysqlx'",
        );
        const pluginRow = pluginResult.rows?.[0];
        const xPluginEnabled = pluginRow?.["PLUGIN_STATUS"] === "ACTIVE";

        // Get collections (tables with _id column and doc JSON column)
        const collectionsResult = await adapter.executeQuery(`
                    SELECT 
                        t.TABLE_NAME as collection_name,
                        t.TABLE_ROWS as row_count,
                        t.DATA_LENGTH + t.INDEX_LENGTH as size_bytes
                    FROM information_schema.TABLES t
                    WHERE t.TABLE_SCHEMA = DATABASE()
                      AND EXISTS (
                          SELECT 1 FROM information_schema.COLUMNS c
                          WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA
                            AND c.TABLE_NAME = t.TABLE_NAME
                            AND c.COLUMN_NAME = 'doc'
                            AND c.DATA_TYPE = 'json'
                      )
                      AND EXISTS (
                          SELECT 1 FROM information_schema.COLUMNS c2
                          WHERE c2.TABLE_SCHEMA = t.TABLE_SCHEMA
                            AND c2.TABLE_NAME = t.TABLE_NAME
                            AND c2.COLUMN_NAME = '_id'
                      )
                    ORDER BY t.TABLE_NAME
                `);

        return {
          xPluginEnabled,
          collectionCount: collectionsResult.rows?.length ?? 0,
          collections: collectionsResult.rows ?? [],
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
