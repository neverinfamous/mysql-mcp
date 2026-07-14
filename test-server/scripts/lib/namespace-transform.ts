export const GROUP_PREFIX_MAP: Record<string, string> = {
  sysschema: "sys_",
  fulltext: "fulltext_",
  docstore: "doc_",
  transactions: "transaction_",
  shell: "mysqlsh_",
};

export const KEEP_PREFIX_GROUPS = new Set(["replication"]);

export function toCodeModeName(toolName: string, groupName: string): string {
  // Explicit mappings for optimization
  if (toolName === "mysql_index_recommendation") return "mysql.optimization.indexRecommendation";
  if (toolName === "mysql_query_rewrite") return "mysql.optimization.queryRewrite";
  if (toolName === "mysql_force_index") return "mysql.optimization.forceIndex";
  if (toolName === "mysql_optimizer_trace") return "mysql.optimization.optimizerTrace";

  // Explicit mappings for vector
  if (toolName === "mysql_vector_search") return "mysql.vector.search";
  if (toolName === "mysql_vector_range_search") return "mysql.vector.rangeSearch";
  if (toolName === "mysql_vector_hybrid_search") return "mysql.vector.hybridSearch";
  if (toolName === "mysql_vector_store") return "mysql.vector.store";
  if (toolName === "mysql_vector_batch_store") return "mysql.vector.batchStore";
  if (toolName === "mysql_vector_delete") return "mysql.vector.delete";
  if (toolName === "mysql_vector_get") return "mysql.vector.get";
  if (toolName === "mysql_vector_create_index") return "mysql.vector.createIndex";
  if (toolName === "mysql_vector_optimize") return "mysql.vector.optimize";
  if (toolName === "mysql_vector_stats") return "mysql.vector.stats";
  if (toolName === "mysql_vector_info") return "mysql.vector.info";

  // Explicit mappings for core versioning
  if (toolName === "mysql_enable_versioning") return "mysql.core.enableVersioning";
  if (toolName === "mysql_disable_versioning") return "mysql.core.disableVersioning";
  if (toolName === "mysql_check_version") return "mysql.core.checkVersion";
  if (toolName === "mysql_conditional_update") return "mysql.core.conditionalUpdate";

  // General transformation
  let name = toolName.replace(/^mysql_/, "");
  const groupPrefix = GROUP_PREFIX_MAP[groupName] ?? groupName + "_";

  if (!KEEP_PREFIX_GROUPS.has(groupName) && name.startsWith(groupPrefix)) {
    name = name.substring(groupPrefix.length);
  }

  const camelName = name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  return `mysql.${groupName}.${camelName}`;
}
