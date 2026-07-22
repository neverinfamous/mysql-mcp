/**
 * MySQL Text Tools - Processing
 *
 * Text manipulation and pattern matching tools.
 * 6 tools: regexp_match, like_search, soundex, substring, concat, collation_convert.
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import {
  type ToolDefinition,
  type RequestContext,
  ValidationError,
} from "../../../../types/index.js";
import {
  RegexpMatchSchema,
  RegexpMatchSchemaBase,
  LikeSearchSchema,
  LikeSearchSchemaBase,
  SoundexSchema,
  SoundexSchemaBase,
  SubstringSchema,
  SubstringSchemaBase,
  ConcatSchema,
  ConcatSchemaBase,
  CollationConvertSchema,
  CollationConvertSchemaBase,
  TextQueryOutputSchema,
} from "../../schemas/index.js";
import {
  validateIdentifier,
  validateQualifiedIdentifier,
  validateWhereClause,
  escapeQualifiedTable,
} from "../../../../utils/validators.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { READ_ONLY } from "../../../../utils/annotations.js";


async function getSelectColumns(
  adapter: MySQLAdapter,
  table: string,
  targetColumns: string[],
  expressions?: string[]
): Promise<string> {
  const selectCols: string[] = [];
  try {
    const tableInfo = await adapter.describeTable(table);
    if (tableInfo?.columns && tableInfo.columns.length > 0) {
      const pkCols = tableInfo.columns
        .filter((c) => c.primaryKey)
        .map((c) => `\`${c.name}\``);
      const idCol = tableInfo.columns.find((c) => c.name.toLowerCase() === "id");
      if (pkCols.length > 0) {
        selectCols.push(...pkCols);
      } else if (idCol) {
        selectCols.push(`\`${idCol.name}\``);
      } else if (targetColumns.length === 0 && (!expressions || expressions.length === 0) && tableInfo.columns[0]) {
        selectCols.push(`\`${tableInfo.columns[0].name}\``);
      }
    } else if (targetColumns.length === 0 && (!expressions || expressions.length === 0)) {
      selectCols.push("`id`");
    }
  } catch {
    if (targetColumns.length === 0 && (!expressions || expressions.length === 0)) {
      selectCols.push("`id`");
    }
  }

  for (const col of targetColumns) {
    const quoted = `\`${col}\``;
    if (!selectCols.includes(quoted)) {
      selectCols.push(quoted);
    }
  }

  if (expressions) {
    selectCols.push(...expressions);
  }

  return selectCols.join(", ");
}

export function createRegexpMatchTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_regexp_match",
    title: "MySQL REGEXP Match",
    description: "Find rows where column matches a regular expression pattern.",
    group: "text",
    inputSchema: RegexpMatchSchemaBase,
    outputSchema: TextQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, pattern, where, includeSourceColumn, limit } =
          RegexpMatchSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        // Pre-validate regex pattern to prevent MySQL connection drop on fatal syntax error
        try {
          new RegExp(pattern);
        } catch (e) {
          throw new ValidationError(
            `Invalid regular expression pattern: ${(e as Error).message}`,
            { pattern }
          );
        }


        // Return PKs and matched column for minimal payload (unless includeSourceColumn is true)
        const targetCols = includeSourceColumn ? [column] : [];
        const selectCols = await getSelectColumns(adapter, table, targetCols);
        let sql = `SELECT ${selectCols} FROM ${escapeQualifiedTable(table)} WHERE \`${column}\` REGEXP ?`;
        const queryParams: unknown[] = [pattern];
        if (where !== undefined) {
          sql += ` AND (${where})`;
        }
        const queryLimit = Math.min(limit ?? 50, 500);
        sql += ` LIMIT ${queryLimit}`;
        const result = await adapter.executeReadQuery(sql, queryParams);

        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createLikeSearchTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_like_search",
    title: "MySQL LIKE Search",
    description:
      "Find rows using LIKE pattern matching with % and _ wildcards.",
    group: "text",
    inputSchema: LikeSearchSchemaBase,
    outputSchema: TextQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, pattern, where, includeSourceColumn, limit } =
          LikeSearchSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        // Return PKs and matched column for minimal payload (unless includeSourceColumn is true)
        const targetCols = includeSourceColumn ? [column] : [];
        const selectCols = await getSelectColumns(adapter, table, targetCols);
        let sql = `SELECT ${selectCols} FROM ${escapeQualifiedTable(table)} WHERE \`${column}\` LIKE ?`;
        const queryParams: unknown[] = [pattern];
        if (where !== undefined) {
          sql += ` AND (${where})`;
        }
        const queryLimit = Math.min(limit ?? 50, 500);
        sql += ` LIMIT ${queryLimit}`;
        const result = await adapter.executeReadQuery(sql, queryParams);

        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createSoundexTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_soundex",
    title: "MySQL SOUNDEX",
    description: "Find rows with phonetically similar values using SOUNDEX.",
    group: "text",
    inputSchema: SoundexSchemaBase,
    outputSchema: TextQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, value, where, includeSourceColumn, limit } =
          SoundexSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        // Return only PKs and soundex value for minimal payload (unless includeSourceColumn is true)
        const targetCols = includeSourceColumn ? [column] : [];
        const exprs = [`SOUNDEX(\`${column}\`) as soundex_value`];
        const selectColumns = await getSelectColumns(adapter, table, targetCols, exprs);
        let sql = `SELECT ${selectColumns} FROM ${escapeQualifiedTable(table)} WHERE SOUNDEX(\`${column}\`) = SOUNDEX(?)`;
        const queryParams: unknown[] = [value];
        if (where !== undefined) {
          sql += ` AND (${where})`;
        }
        const queryLimit = Math.min(limit ?? 50, 500);
        sql += ` LIMIT ${queryLimit}`;
        const result = await adapter.executeReadQuery(sql, queryParams);

        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createSubstringTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_substring",
    title: "MySQL SUBSTRING",
    description: "Extract substrings from column values.",
    group: "text",
    inputSchema: SubstringSchemaBase,
    outputSchema: TextQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, start, length, where, includeSourceColumn, limit } =
          SubstringSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        const substringExpr =
          length !== undefined
            ? `SUBSTRING(\`${column}\`, ?, ?)`
            : `SUBSTRING(\`${column}\`, ?)`;

        // Return only PKs and substring result for minimal payload (unless includeSourceColumn is true)
        const targetCols = includeSourceColumn ? [column] : [];
        const exprs = [`${substringExpr} as substring_value`];
        const selectColumns = await getSelectColumns(adapter, table, targetCols, exprs);
        let sql = `SELECT ${selectColumns} FROM ${escapeQualifiedTable(table)}`;
        const queryParams: unknown[] =
          length !== undefined ? [start, length] : [start];

        if (where !== undefined) {
          sql += ` WHERE ${where}`;
        }
        const queryLimit = Math.min(limit ?? 50, 500);
        sql += ` LIMIT ${queryLimit}`;

        const result = await adapter.executeReadQuery(sql, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createConcatTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_concat",
    title: "MySQL CONCAT",
    description: "Concatenate multiple columns with an optional separator.",
    group: "text",
    inputSchema: ConcatSchemaBase,
    outputSchema: TextQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          table,
          columns,
          separator,
          alias,
          where,
          includeSourceColumns,
          limit,
        } = ConcatSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        for (const col of columns) {
          validateIdentifier(col, "column");
        }
        validateIdentifier(alias, "column");
        validateWhereClause(where);

        const columnList = columns.map((c) => `\`${c}\``).join(", ");
        const concatExpr = `CONCAT_WS(?, ${columnList})`;

        // Optionally include source columns for full context or minimal payload
        const targetCols = includeSourceColumns ? columns : [];
        const exprs = [`${concatExpr} as \`${alias}\``];
        const selectColumns = await getSelectColumns(adapter, table, targetCols, exprs);
        let sql = `SELECT ${selectColumns} FROM ${escapeQualifiedTable(table)}`;
        const queryParams: unknown[] = [separator];

        if (where !== undefined) {
          sql += ` WHERE ${where}`;
        }
        const queryLimit = Math.min(limit ?? 50, 500);
        sql += ` LIMIT ${queryLimit}`;

        const result = await adapter.executeReadQuery(sql, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createCollationConvertTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_collation_convert",
    title: "MySQL Collation Convert",
    description:
      "Convert column values to a different character set or collation.",
    group: "text",
    inputSchema: CollationConvertSchemaBase,
    outputSchema: TextQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, charset, collation, alias, where, includeSourceColumn, limit } =
          CollationConvertSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateIdentifier(alias, "column");
        validateWhereClause(where);
        // charset and collation are parameters for CONVERT, not identifiers in the query structure per se (but should be safe strings)
        // They are usually safe to interpolate if we trust them or validate against a list, but here we just put them in.
        // A safer approach for charset/collation would be to validate against known MySQL charsets/collations,
        // but for now we assume they are safe or the user has rights.
        // However, to be strictly safe, let's validate them as identifiers as they usually follow identifier rules.
        validateIdentifier(charset, "charset"); // charset names follow identifier rules
        if (collation !== undefined) validateIdentifier(collation, "collation"); // collation names follow identifier rules

        let convertExpr = `CONVERT(\`${column}\` USING ${charset})`;
        if (collation !== undefined) {
          convertExpr = `${convertExpr} COLLATE ${collation}`;
        }

        // Return only PKs and converted result for minimal payload (unless includeSourceColumn is true)
        const targetCols = includeSourceColumn ? [column] : [];
        const exprs = [`${convertExpr} as \`${alias}\``];
        const selectColumns = await getSelectColumns(adapter, table, targetCols, exprs);
        let sql = `SELECT ${selectColumns} FROM ${escapeQualifiedTable(table)}`;
        const queryParams: unknown[] = [];

        if (where !== undefined) {
          sql += ` WHERE ${where}`;
        }
        const queryLimit = Math.min(limit ?? 50, 500);
        sql += ` LIMIT ${queryLimit}`;

        const result = await adapter.executeReadQuery(sql, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
