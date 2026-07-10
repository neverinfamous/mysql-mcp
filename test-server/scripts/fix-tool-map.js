import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toolMapPath = path.join(__dirname, 'tool-map.json');
let toolMap = JSON.parse(fs.readFileSync(toolMapPath, 'utf8'));

// Fix backup
toolMap["test-codemode-advanced-backup-audit-part1.md"] = ["mysql_audit_list_backups", "mysql_audit_restore_backup"];
toolMap["test-codemode-advanced-backup-audit-part2.md"] = ["mysql_audit_diff_backup"];
toolMap["test-codemode-advanced-backup-export.md"] = ["mysql_export_table", "mysql_import_data", "mysql_create_dump", "mysql_restore_dump"];

// Fix schema
toolMap["test-codemode-advanced-schema-management.md"] = ["mysql_list_schemas", "mysql_create_schema", "mysql_drop_schema"];
toolMap["test-codemode-advanced-schema-views.md"] = ["mysql_list_views", "mysql_create_view", "mysql_drop_view", "mysql_list_constraints"];
toolMap["test-codemode-advanced-schema-routines.md"] = ["mysql_list_stored_procedures", "mysql_list_functions"];
toolMap["test-codemode-advanced-schema-triggers.md"] = ["mysql_list_triggers", "mysql_create_trigger", "mysql_drop_trigger"];

// Fix spatial
toolMap["test-codemode-advanced-spatial-setup.md"] = ["mysql_spatial_create_column", "mysql_spatial_create_index"];
toolMap["test-codemode-advanced-spatial-geometry.md"] = ["mysql_spatial_point", "mysql_spatial_polygon", "mysql_spatial_geojson"];
toolMap["test-codemode-advanced-spatial-operations.md"] = ["mysql_spatial_distance", "mysql_spatial_distance_sphere", "mysql_spatial_buffer", "mysql_spatial_transform"];
toolMap["test-codemode-advanced-spatial-queries.md"] = ["mysql_spatial_contains", "mysql_spatial_within", "mysql_spatial_intersection"];

// Fix stats
toolMap["test-codemode-advanced-stats-descriptive-part1.md"] = ["mysql_stats_descriptive", "mysql_stats_percentiles", "mysql_stats_summary"];
toolMap["test-codemode-advanced-stats-descriptive-part2.md"] = ["mysql_stats_distribution", "mysql_stats_histogram", "mysql_stats_frequency"];
toolMap["test-codemode-advanced-stats-advanced-part1.md"] = ["mysql_stats_correlation", "mysql_stats_regression", "mysql_stats_sampling"];
toolMap["test-codemode-advanced-stats-advanced-part2.md"] = ["mysql_stats_hypothesis", "mysql_stats_outliers", "mysql_stats_distinct"];
toolMap["test-codemode-advanced-stats-time-series-part1.md"] = ["mysql_stats_time_series", "mysql_stats_moving_avg"];
toolMap["test-codemode-advanced-stats-time-series-part2.md"] = ["mysql_stats_running_total", "mysql_stats_lag_lead"];
toolMap["test-codemode-advanced-stats-window-part1.md"] = ["mysql_stats_row_number", "mysql_stats_rank"];
toolMap["test-codemode-advanced-stats-window-part2.md"] = ["mysql_stats_ntile", "mysql_stats_top_n"];

// Fix shell
toolMap["test-codemode-advanced-shell-utils-part1a.md"] = ["mysqlsh_version", "mysqlsh_check_upgrade"];
toolMap["test-codemode-advanced-shell-utils-part1b.md"] = ["mysqlsh_run_script"];
toolMap["test-codemode-advanced-shell-utils-part2.md"] = ["mysqlsh_dump_instance", "mysqlsh_dump_schemas"];
toolMap["test-codemode-advanced-shell-data-part1.md"] = ["mysqlsh_export_table", "mysqlsh_import_table", "mysqlsh_import_json"];
toolMap["test-codemode-advanced-shell-data-part2.md"] = ["mysqlsh_dump_tables", "mysqlsh_load_dump"];

// Fix docstore
toolMap["test-codemode-advanced-docstore-collections-part1.md"] = ["mysql_doc_list_collections", "mysql_doc_create_collection", "mysql_doc_drop_collection"];
toolMap["test-codemode-advanced-docstore-collections-part2.md"] = ["mysql_doc_create_index", "mysql_doc_collection_info"];
toolMap["test-codemode-advanced-docstore-documents-part1.md"] = ["mysql_doc_add", "mysql_doc_find"];
toolMap["test-codemode-advanced-docstore-documents-part2.md"] = ["mysql_doc_modify", "mysql_doc_remove"];

fs.writeFileSync(toolMapPath, JSON.stringify(toolMap, null, 2), 'utf8');
console.log('Fixed tool-map.json mappings!');
