/**
 * Tools that should receive pre-mutation snapshots, mapped to the
 * argument key that identifies the target object.
 *
 * Tools not in this map are audited but don't trigger snapshots.
 */
export const SNAPSHOT_TOOL_ARGS: Record<
  string,
  { targetKey: string; schemaKey?: string }
> = {
  // Core group — destructive
  mysql_drop_table: { targetKey: "table", schemaKey: "database" },

  // Admin group
  mysql_optimize_table: { targetKey: "table", schemaKey: "database" },
  mysql_repair_table: { targetKey: "table", schemaKey: "database" },

  // Backup group — import overwrites
  mysql_import_data: { targetKey: "table", schemaKey: "database" },

  // Schema group — destructive
  mysql_drop_schema: { targetKey: "schema" },
  mysql_drop_view: { targetKey: "view", schemaKey: "schema" },

  // Partitioning group
  mysql_drop_partition: { targetKey: "table", schemaKey: "database" },

  // Docstore group
  mysql_doc_drop_collection: { targetKey: "collection", schemaKey: "database" },
};

/** File extension for compressed snapshot files */
export const SNAPSHOT_EXT = ".snapshot.json.gz";

/** Legacy uncompressed extension for backward compatibility */
export const SNAPSHOT_EXT_LEGACY = ".snapshot.json";

/** How many data rows to include in snapshot samples */
export const MAX_SAMPLE_ROWS = 100;

/** Default max data size for snapshot data capture (50 MB) */
export const DEFAULT_MAX_DATA_SIZE_BYTES = 50 * 1024 * 1024;
