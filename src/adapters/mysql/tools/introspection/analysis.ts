/**
 * MySQL Introspection Tools - Schema Analysis
 *
 * Constraint analysis and migration risk assessment tools.
 * 2 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ValidationError } from "../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  checkSchemaExists,
  checkTableExists,
  fetchForeignKeys,
  qualifiedName,
} from "./helpers.js";
import { detectCycles } from "./algorithms.js";
import {
  ConstraintAnalysisSchemaBase,
  ConstraintAnalysisSchema,
  MigrationRisksSchemaBase,
  MigrationRisksSchema,
  ConstraintAnalysisOutputSchema,
  MigrationRisksOutputSchema,
} from "../../schemas/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

// =============================================================================
// mysql_constraint_analysis
// =============================================================================

export function createConstraintAnalysisTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_constraint_analysis",
    title: "Constraint Analysis",
    description:
      "Analyze all constraints for issues: missing NOT NULL, missing primary keys.",
    group: "introspection",
    inputSchema: ConstraintAnalysisSchemaBase,
    outputSchema: ConstraintAnalysisOutputSchema,
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = ConstraintAnalysisSchema.parse(params);

        // Validate schema existence when filtering by schema
        await checkSchemaExists(adapter, parsed.schema);

        // Validate table existence when filtering by table
        await checkTableExists(adapter, parsed.table, parsed.schema);

        const runAll = !parsed.checks || parsed.checks.length === 0;
        const checks = new Set(parsed.checks ?? []);

        interface Finding {
          type: string;
          severity: "info" | "warning" | "error";
          table: string;
          description: string;
          suggestion?: string;
        }

        const findings: Finding[] = [];
        const schemaParams: unknown[] = [];
        let schemaWhere = "";
        let tableWhere = "";

        if (parsed.schema) {
          schemaParams.push(parsed.schema);
          schemaWhere = `AND c.TABLE_SCHEMA = ?`;
        }
        if (parsed.table) {
          schemaParams.push(parsed.table);
          tableWhere = `AND c.TABLE_NAME = ?`;
        }

        // Check: Tables without primary keys
        if (runAll || checks.has("missing_pk")) {
          const result = await adapter.executeReadQuery(
            `SELECT c.TABLE_SCHEMA as schema_name, c.TABLE_NAME as table_name
           FROM information_schema.TABLES c
           WHERE c.TABLE_TYPE = 'BASE TABLE'
             AND c.TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
             AND NOT EXISTS (
               SELECT 1 FROM information_schema.TABLE_CONSTRAINTS pk
               WHERE pk.TABLE_SCHEMA = c.TABLE_SCHEMA AND pk.TABLE_NAME = c.TABLE_NAME AND pk.CONSTRAINT_TYPE = 'PRIMARY KEY'
             )
             ${schemaWhere} ${tableWhere}
           ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME`,
            schemaParams.length > 0 ? schemaParams : undefined,
          );

          for (const row of result.rows ?? []) {
            findings.push({
              type: "missing_pk",
              severity: "error",
              table: qualifiedName(
                typeof row["schema_name"] === "string" ? row["schema_name"] : "",
                typeof row["table_name"] === "string" ? row["table_name"] : "",
              ),
              description: "Table has no primary key",
              suggestion:
                "Add a primary key column (e.g., id INT AUTO_INCREMENT PRIMARY KEY) for data integrity and efficient lookups",
            });
          }
        }

        // Check: Circular dependencies
        if (runAll || checks.has("circular_dependency")) {
          const fks = await fetchForeignKeys(adapter, parsed.schema);

          const adjacency = new Map<string, string[]>();
          for (const fk of fks) {
            const from = qualifiedName(fk.fromSchema, fk.fromTable);
            const to = qualifiedName(fk.toSchema, fk.toTable);
            if (from === to) continue; // Self references are not treated as system-blocking circular dependencies

            // Only add edges matching our filters
            if (
              parsed.table &&
              fk.fromTable !== parsed.table &&
              fk.toTable !== parsed.table
            ) {
              continue;
            }

            const existing = adjacency.get(from) ?? [];
            existing.push(to);
            adjacency.set(from, existing);
          }

          const cycles = detectCycles(adjacency);
          for (const cycle of cycles) {
            // A cycle is an array of tables like ['A', 'B', 'A']
            // We report it for the first table in the cycle to avoid spamming
            const table = cycle[0] ?? "";
            if (parsed.table && !table.includes(`.${parsed.table}`)) {
              // If filtering by table, only report cycles that involve this table
              if (!cycle.some((t) => t.includes(`.${parsed.table}`))) continue;
            }
            findings.push({
              type: "circular_dependency",
              severity: "error",
              table,
              description: `Circular foreign key dependency detected: ${cycle.join(" -> ")}`,
              suggestion:
                "Redesign schema to break the circular reference or defer constraints during operations",
            });
          }
        }

        // Check: Tables with columns that likely should have NOT NULL
        if (runAll || checks.has("missing_not_null")) {
          const result = await adapter.executeReadQuery(
            `SELECT
            c.TABLE_SCHEMA as schema_name, c.TABLE_NAME as table_name,
            c.COLUMN_NAME as column_name, c.COLUMN_TYPE as type
          FROM information_schema.COLUMNS c
          JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
          WHERE t.TABLE_TYPE = 'BASE TABLE'
            AND c.IS_NULLABLE = 'YES'
            AND c.TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
            AND c.COLUMN_NAME IN ('id', 'uuid', 'email', 'name', 'created_at', 'updated_at', 'status', 'type')
            AND NOT EXISTS (
               SELECT 1 FROM information_schema.KEY_COLUMN_USAGE kcu
               JOIN information_schema.TABLE_CONSTRAINTS pk
                 ON pk.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                 AND pk.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                 AND pk.TABLE_NAME = kcu.TABLE_NAME
               WHERE kcu.TABLE_SCHEMA = c.TABLE_SCHEMA AND kcu.TABLE_NAME = c.TABLE_NAME AND kcu.COLUMN_NAME = c.COLUMN_NAME
                 AND pk.CONSTRAINT_TYPE = 'PRIMARY KEY'
            )
            ${schemaWhere} ${tableWhere.replace("c.TABLE_NAME", "t.TABLE_NAME")}
          ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.COLUMN_NAME`,
            schemaParams.length > 0 ? schemaParams : undefined,
          );

          for (const row of result.rows ?? []) {
            findings.push({
              type: "missing_not_null",
              severity: "info",
              table: qualifiedName(
                typeof row["schema_name"] === "string" ? row["schema_name"] : "",
                typeof row["table_name"] === "string" ? row["table_name"] : "",
              ),
              description: `Column '${typeof row["column_name"] === "string" ? row["column_name"] : ""}' (${typeof row["type"] === "string" ? row["type"] : ""}) is nullable but commonly expected to be NOT NULL`,
              suggestion: `ALTER TABLE ${qualifiedName(typeof row["schema_name"] === "string" ? row["schema_name"] : "", typeof row["table_name"] === "string" ? row["table_name"] : "")} MODIFY COLUMN \`${typeof row["column_name"] === "string" ? row["column_name"] : ""}\` ${typeof row["type"] === "string" ? row["type"] : ""} NOT NULL`,
            });
          }
        }

        // Build summary
        const byType: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        for (const f of findings) {
          byType[f.type] = (byType[f.type] ?? 0) + 1;
          bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
        }

        const data = {
          ...(findings.length > 0 ? { findings } : {}),
          summary: {
            totalFindings: findings.length,
            ...(Object.keys(byType).length > 0 ? { byType } : {}),
            ...(Object.keys(bySeverity).length > 0 ? { bySeverity } : {}),
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(data), "utf8") / 4,
        );
        return withTokenEstimate({ success: true, data, metrics: { tokenEstimate } });
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// mysql_migration_risks
// =============================================================================

/** DDL patterns and their associated risks */
const DDL_RISK_PATTERNS: {
  pattern: RegExp;
  category: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  description: string;
  mitigation?: string;
  requiresDowntime: boolean;
  lockImpact: string;
}[] = [
  {
    pattern: /\bDROP\s+TABLE\b/i,
    category: "data_loss",
    riskLevel: "critical",
    description: "DROP TABLE permanently deletes the table and all its data",
    mitigation:
      "Back up the table first (mysql_schema_snapshot), verify no active references",
    requiresDowntime: false,
    lockImpact: "Exclusive metadata lock on the table",
  },
  {
    pattern: /\bTRUNCATE\b/i,
    category: "data_loss",
    riskLevel: "critical",
    description: "TRUNCATE removes all rows from the table",
    mitigation: "Verify you intend to delete all data, check CASCADE effects",
    requiresDowntime: false,
    lockImpact: "Exclusive metadata lock on the table",
  },
  {
    pattern: /\bDROP\s+COLUMN\b/i,
    category: "data_loss",
    riskLevel: "high",
    description: "DROP COLUMN permanently removes the column and its data",
    mitigation:
      "Back up the column data first, verify no application dependencies",
    requiresDowntime: true,
    lockImpact: "Requires table rebuild in most cases (ALGORITHM=COPY)",
  },
  {
    pattern: /\bMODIFY\s+COLUMN\b.*\bNOT\s+NULL\b/i,
    category: "constraint",
    riskLevel: "high",
    description:
      "Adding NOT NULL requires a full table scan to verify no NULL values exist",
    mitigation:
      "First check for NULLs: SELECT COUNT(*) FROM table WHERE column IS NULL",
    requiresDowntime: false,
    lockImpact: "Table scan during verification",
  },
  {
    pattern: /\bALTER\s+TABLE\b.*\bADD\s+(?:CONSTRAINT\b.*\b)?FOREIGN\s+KEY\b/i,
    category: "constraint",
    riskLevel: "medium",
    description: "Adding a foreign key requires validating all existing rows",
    mitigation: "Ensure referenced rows exist before applying the constraint",
    requiresDowntime: false,
    lockImpact: "Shared locks on both tables",
  },
  {
    pattern: /\bCREATE\s+TABLE\b(?!\s+IF\s+NOT\s+EXISTS)/i,
    category: "schema_change",
    riskLevel: "low",
    description:
      "CREATE TABLE without IF NOT EXISTS will fail if the table already exists. Unsafe for idempotency.",
    mitigation:
      "Consider using CREATE TABLE IF NOT EXISTS to make the migration idempotent.",
    requiresDowntime: false,
    lockImpact: "Brief metadata lock",
  },
  {
    pattern: /\bALTER\s+TABLE\b.*\bADD\s+COLUMN\b/i,
    category: "schema_change",
    riskLevel: "low",
    description:
      "Adding a nullable column without a default is a metadata-only change (INSTANT in MySQL 8+)",
    requiresDowntime: false,
    lockImpact: "Metadata-only lock in MySQL 8+",
  },
  {
    pattern: /\bALTER\s+TABLE\b.*\bADD\s+COLUMN\b.*\bDEFAULT\b/i,
    category: "schema_change",
    riskLevel: "medium",
    description:
      "Adding a column with a DEFAULT is INSTANT in MySQL 8+, but requires table rewrite in 5.7",
    mitigation: "Be cautious if running on MySQL 5.7 or older",
    requiresDowntime: false,
    lockImpact: "INSTANT in 8.0, requires rebuild in 5.7",
  },
  {
    pattern: /\bALTER\s+TABLE\b.*\bMODIFY\s+COLUMN\b/i,
    category: "schema_change",
    riskLevel: "high",
    description: "Changing column type requires rewriting the entire table",
    mitigation:
      "Consider using pt-online-schema-change or gh-ost for large tables",
    requiresDowntime: true,
    lockImpact: "Table copy (ALGORITHM=COPY) blocking writes",
  },
  {
    pattern: /\bCREATE\s+INDEX\b(?!\s+ALGORITHM=INPLACE)/i,
    category: "locking",
    riskLevel: "medium",
    description:
      "Index creation may block writes if not using INPLACE algorithm",
    mitigation: "Use ALGORITHM=INPLACE LOCK=NONE if supported",
    requiresDowntime: false,
    lockImpact: "May lock table for writes",
  },
  {
    pattern: /\bDROP\s+INDEX\b/i,
    category: "locking",
    riskLevel: "medium",
    description:
      "DROP INDEX blocks briefly. May degrade query performance significantly",
    mitigation: "Verify no critical queries depend on the index",
    requiresDowntime: false,
    lockImpact: "Exclusive metadata lock (brief)",
  },
  {
    pattern: /\bRENAME\s+(?:TABLE|TO)\b/i,
    category: "breaking_change",
    riskLevel: "high",
    description:
      "Renaming a table will break any application queries referencing the old name",
    requiresDowntime: false,
    lockImpact: "Exclusive metadata lock (brief)",
  },
  {
    pattern: /\bDROP\s+DATABASE\b/i,
    category: "data_loss",
    riskLevel: "critical",
    description: "DROP DATABASE deletes the schema and ALL objects within it",
    mitigation: "Verify intent and back up critical data",
    requiresDowntime: false,
    lockImpact: "Exclusive metadata lock on all objects",
  },
];

export function createMigrationRisksTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_migration_risks",
    title: "Migration Risks",
    description:
      "Analyze proposed DDL statements for risks: data loss, lock contention, constraint violations, and breaking changes. Pre-flight check before executing migrations.",
    group: "introspection",
    inputSchema: MigrationRisksSchemaBase,
    outputSchema: MigrationRisksOutputSchema,
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationRisksSchema.parse(params) as {
          statements: string[];
          schema?: string;
        };

        if (parsed.statements.length === 0) {
          throw new ValidationError("statements parameter is required");
        }

        if (parsed.schema) {
          await checkSchemaExists(adapter, parsed.schema);
        }

        interface Risk {
          statement: string;
          statementIndex: number;
          severity: "low" | "medium" | "high" | "critical";
          category: string;
          description: string;
          mitigation?: string | undefined;
        }

        const risks: Risk[] = [];
        let requiresDowntime = false;
        let highestRiskLevel: "low" | "medium" | "high" | "critical" = "low";
        const lockImpacts = new Set<string>();

        const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 };

        for (let i = 0; i < parsed.statements.length; i++) {
          const stmt = parsed.statements[i] ?? "";

          for (const pattern of DDL_RISK_PATTERNS) {
            if (pattern.pattern.test(stmt)) {
              risks.push({
                statement:
                  stmt.length > 200 ? stmt.slice(0, 200) + "..." : stmt,
                statementIndex: i,
                severity: pattern.riskLevel,
                category: pattern.category,
                description: pattern.description,
                mitigation: pattern.mitigation,
              });

              if (pattern.requiresDowntime) {
                requiresDowntime = true;
              }
              if (riskOrder[pattern.riskLevel] > riskOrder[highestRiskLevel]) {
                highestRiskLevel = pattern.riskLevel;
              }
              lockImpacts.add(pattern.lockImpact);
            }
          }
        }

        const data = {
          ...(risks.length > 0 ? { risks } : {}),
          summary: {
            totalStatements: parsed.statements.length,
            totalRisks: risks.length,
            highestSeverity: highestRiskLevel,
            requiresDowntime,
            estimatedLockImpact:
              lockImpacts.size > 0 ? [...lockImpacts].join("; ") : "None",
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(data), "utf8") / 4,
        );
        return withTokenEstimate({ success: true, data, metrics: { tokenEstimate } });
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
