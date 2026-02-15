/**
 * mysql-mcp - Code Mode Tool: mysql_execute_code
 *
 * MCP tool that executes LLM-generated code in a sandboxed environment
 * with access to all MySQL tools via the mysql.* API.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  createSandboxPool,
  type ISandboxPool,
  type SandboxMode,
} from "../../../../codemode/sandbox-factory.js";
import { CodeModeSecurityManager } from "../../../../codemode/security.js";
import { createMysqlApi } from "../../../../codemode/api.js";
import type { ExecuteCodeOptions } from "../../../../codemode/types.js";

// Schema for mysql_execute_code input
export const ExecuteCodeSchema = z.object({
  code: z
    .string()
    .describe(
      "TypeScript/JavaScript code to execute. Use mysql.{group}.{method}() for database operations.",
    ),
  timeout: z
    .number()
    .optional()
    .describe("Execution timeout in milliseconds (max 30000, default 30000)"),
  readonly: z
    .boolean()
    .optional()
    .describe("If true, restricts to read-only operations"),
});

// Schema for mysql_execute_code output
export const ExecuteCodeOutputSchema = z.object({
  success: z.boolean().describe("Whether the code executed successfully"),
  result: z
    .unknown()
    .optional()
    .describe("Return value from the executed code"),
  error: z.string().optional().describe("Error message if execution failed"),
  metrics: z
    .object({
      wallTimeMs: z
        .number()
        .describe("Wall clock execution time in milliseconds"),
      cpuTimeMs: z.number().describe("CPU time used in milliseconds"),
      memoryUsedMb: z.number().describe("Memory used in megabytes"),
    })
    .optional()
    .describe("Execution performance metrics"),
  hint: z.string().optional().describe("Helpful tip or additional information"),
});

// Singleton instances (initialized on first use)
let sandboxPool: ISandboxPool | null = null;
let securityManager: CodeModeSecurityManager | null = null;

/**
 * Get isolation mode from environment variable
 */
function getIsolationMode(): SandboxMode {
  const envMode = process.env["CODEMODE_ISOLATION"];
  if (envMode === "worker") return "worker";
  return "vm"; // Default
}

/**
 * Initialize Code Mode infrastructure
 */
function ensureInitialized(): {
  pool: ISandboxPool;
  security: CodeModeSecurityManager;
} {
  sandboxPool ??= createSandboxPool(getIsolationMode());
  sandboxPool.initialize();
  securityManager ??= new CodeModeSecurityManager();
  return { pool: sandboxPool, security: securityManager };
}

/**
 * Create the mysql_execute_code tool
 */
export function createExecuteCodeTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_execute_code",
    title: "MySQL Execute Code",
    description: `Execute TypeScript/JavaScript code in a sandboxed environment with access to all MySQL tools via the mysql.* API.

Available API groups:
- mysql.core: readQuery, writeQuery, listTables, describeTable, createTable, createIndex (8 methods)
- mysql.transactions: begin, commit, rollback, savepoint, execute (7 methods)
- mysql.json: extract, set, insert, remove, contains, keys, merge, diff, stats (17 methods)
- mysql.text: regexpMatch, likeSearch, soundex, substring, concat, collationConvert (6 methods)
- mysql.fulltext: fulltextSearch, fulltextCreate, fulltextBoolean, fulltextExpand (5 methods)
- mysql.performance: explain, explainAnalyze, slowQueries, bufferPoolStats, tableStats (8 methods)
- mysql.optimization: indexRecommendation, queryRewrite, forceIndex, optimizerTrace (4 methods)
- mysql.admin: optimizeTable, analyzeTable, checkTable, repairTable, flushTables, killQuery (6 methods)
- mysql.monitoring: showProcesslist, showStatus, showVariables, innodbStatus, poolStats (7 methods)
- mysql.backup: createDump, exportTable, importData, restoreDump (4 methods)
- mysql.replication: masterStatus, slaveStatus, binlogEvents, gtidStatus, replicationLag (5 methods)
- mysql.partitioning: partitionInfo, addPartition, dropPartition, reorganizePartition (4 methods)
- mysql.schema: listSchemas, createView, listFunctions, listTriggers (10 methods)
- mysql.events: eventCreate, eventAlter, eventDrop, eventList, schedulerStatus (6 methods)
- mysql.sysschema: sysSchemaStats, sysStatementSummary, sysIoSummary (8 methods)
- mysql.stats: descriptive, percentiles, correlation, regression, timeSeries, histogram (8 methods)
- mysql.spatial: distance, distanceSphere, point, polygon, buffer (12 methods)
- mysql.security: sslStatus, userPrivileges, audit, sensitiveTables (9 methods)
- mysql.cluster: clusterStatus, grStatus, grMembers, clusterTopology (10 methods)
- mysql.roles: roleCreate, roleGrant, roleAssign, roleList (8 methods)
- mysql.docstore: docCreateCollection, docFind, docAdd, docModify (9 methods)
- mysql.router: routerStatus, routerRoutes, routerRouteHealth (9 methods)

Example:
\`\`\`javascript
const tables = await mysql.core.listTables();
const results = [];
for (const t of tables.tables) {
    const count = await mysql.core.readQuery(\`SELECT COUNT(*) as n FROM \\\`\${t.name}\\\`\`);
    results.push({ table: t.name, rows: count.rows[0].n });
}
return results;
\`\`\``,
    group: "codemode",
    inputSchema: ExecuteCodeSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { code, readonly } = params as ExecuteCodeOptions;

      // Initialize infrastructure
      const { pool, security } = ensureInitialized();

      // Validate code
      const validation = security.validateCode(code);
      if (!validation.valid) {
        return {
          success: false,
          error: `Code validation failed: ${validation.errors.join("; ")}`,
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        };
      }

      // Check rate limit
      const clientId = "default";
      if (!security.checkRateLimit(clientId)) {
        return {
          success: false,
          error: "Rate limit exceeded. Please wait before executing more code.",
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        };
      }

      // Create mysql API bindings
      const mysqlApi = createMysqlApi(adapter);
      const bindings = mysqlApi.createSandboxBindings();

      // Validate bindings are populated
      const totalMethods = Object.values(bindings).reduce(
        (sum: number, group) => {
          if (typeof group === "object" && group !== null) {
            return sum + Object.keys(group).length;
          }
          return sum;
        },
        0,
      );
      if (totalMethods === 0) {
        return {
          success: false,
          error:
            "mysql.* API not available: no tool bindings were created. Ensure adapter.getToolDefinitions() returns valid tools.",
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        };
      }

      // Capture active transactions before execution for cleanup on error
      const transactionsBefore = new Set(adapter.getActiveTransactionIds());

      // Execute in sandbox
      const result = await pool.execute(code, bindings);

      // Cleanup orphaned transactions on failure
      if (!result.success) {
        const transactionsAfter = adapter.getActiveTransactionIds();
        const orphanedTransactions = transactionsAfter.filter(
          (txId: string) => !transactionsBefore.has(txId),
        );

        for (const txId of orphanedTransactions) {
          try {
            await adapter.rollbackTransaction(txId);
          } catch {
            // Best-effort cleanup
          }
        }
      }

      // Sanitize result
      if (result.success && result.result !== undefined) {
        result.result = security.sanitizeResult(result.result);
      }

      // Audit log
      const record = security.createExecutionRecord(
        code,
        result,
        readonly ?? false,
        clientId,
      );
      security.auditLog(record);

      // Add help hint for discoverability
      const helpHint =
        "Tip: Use mysql.help() to list all groups, or mysql.core.help() for group-specific methods.";

      return {
        ...result,
        hint: helpHint,
      };
    },
  };
}

/**
 * Get all Code Mode tools
 */
export function getCodeModeTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [createExecuteCodeTool(adapter)];
}

/**
 * Cleanup Code Mode resources (call on server shutdown)
 */
export function cleanupCodeMode(): void {
  if (sandboxPool) {
    sandboxPool.dispose();
    sandboxPool = null;
  }
}
