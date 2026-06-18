import type { ToolDefinition } from "../../../../types/index.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import { ValidationError } from "../../../../types/modules/errors.js";
import { WRITE, READ_ONLY, DESTRUCTIVE } from "../../../../utils/annotations.js";
import {
  VectorStoreSchemaBase,
  VectorStoreSchema,
  VectorBatchStoreSchemaBase,
  VectorBatchStoreSchema,
  VectorDeleteSchemaBase,
  VectorDeleteSchema,
  VectorGetSchemaBase,
  VectorGetSchema,
  VectorStoreOutputSchema,
  VectorBatchStoreOutputSchema,
  VectorDeleteOutputSchema,
  VectorGetOutputSchema,
} from "../../schemas/vector.js";
import { ensureVectorSupport, formatVector, parseVector, sanitizeIdentifier } from "./helpers.js";

export function createVectorStoreTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_store",
    title: "Store Vector Embedding",
    description: "Store a single vector embedding in a table with a VECTOR column.",
    group: "vector",
    inputSchema: VectorStoreSchemaBase,
    outputSchema: VectorStoreOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown) => {
      try {
        const validated = VectorStoreSchema.parse(params);
        await ensureVectorSupport(adapter);

        const table = sanitizeIdentifier(validated.table);
        const column = sanitizeIdentifier(validated.column);
        const idCol = sanitizeIdentifier(validated.idColumn);
        
        const vectorStr = formatVector(validated.vector);

        const query = `
          INSERT INTO \`${table}\` (\`${idCol}\`, \`${column}\`) 
          VALUES (?, STRING_TO_VECTOR(?))
          ON DUPLICATE KEY UPDATE \`${column}\` = VALUES(\`${column}\`)
        `;

        const result = await adapter.executeQuery(query, [validated.id, vectorStr]);

        return withTokenEstimate({
          success: true,
          data: {
            stored: true,
            table: validated.table,
            id: validated.id,
            affectedRows: result.rowsAffected,
          }
        });
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
    },
  };
}

export function createVectorBatchStoreTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_batch_store",
    title: "Batch Store Vector Embeddings",
    description: "Store multiple vector embeddings in a single batch operation.",
    group: "vector",
    inputSchema: VectorBatchStoreSchemaBase,
    outputSchema: VectorBatchStoreOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown) => {
      try {
        const validated = VectorBatchStoreSchema.parse(params);
        await ensureVectorSupport(adapter);

        const table = sanitizeIdentifier(validated.table);
        const column = sanitizeIdentifier(validated.column);
        const idCol = sanitizeIdentifier(validated.idColumn);

        const placeholders: string[] = [];
        const flatValues: unknown[] = [];

        for (const item of validated.items) {
          placeholders.push(`(?, STRING_TO_VECTOR(?))`);
          flatValues.push(item.id, formatVector(item.vector));
        }

        const query = `
          INSERT INTO \`${table}\` (\`${idCol}\`, \`${column}\`) 
          VALUES ${placeholders.join(", ")}
          ON DUPLICATE KEY UPDATE \`${column}\` = VALUES(\`${column}\`)
        `;

        const result = await adapter.executeQuery(query, flatValues);

        return withTokenEstimate({
          success: true,
          data: {
            stored: true,
            table: validated.table,
            count: validated.items.length,
            affectedRows: result.rowsAffected,
          }
        });
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
    },
  };
}

export function createVectorDeleteTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_delete",
    title: "Delete Vector",
    description: "Delete a vector embedding by its row identifier.",
    group: "vector",
    inputSchema: VectorDeleteSchemaBase,
    outputSchema: VectorDeleteOutputSchema,
    requiredScopes: ["write"],
    annotations: DESTRUCTIVE,
    handler: async (params: unknown) => {
      try {
        const validated = VectorDeleteSchema.parse(params);
        await ensureVectorSupport(adapter);

        const table = sanitizeIdentifier(validated.table);
        const idCol = sanitizeIdentifier(validated.idColumn);

        const query = `DELETE FROM \`${table}\` WHERE \`${idCol}\` = ?`;
        const result = await adapter.executeQuery(query, [validated.id]);

        if ((result.rowsAffected ?? 0) === 0) {
          throw new ValidationError(`Row with id '${validated.id}' not found in table '${validated.table}'`);
        }

        return withTokenEstimate({
          success: true,
          data: {
            deleted: true,
            table: validated.table,
            id: validated.id,
          }
        });
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
    },
  };
}

export function createVectorGetTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_get",
    title: "Get Vector",
    description: "Retrieve a vector embedding by its row identifier.",
    group: "vector",
    inputSchema: VectorGetSchemaBase,
    outputSchema: VectorGetOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown) => {
      try {
        const validated = VectorGetSchema.parse(params);
        await ensureVectorSupport(adapter);

        const table = sanitizeIdentifier(validated.table);
        const idCol = sanitizeIdentifier(validated.idColumn);
        
        let targetColumn = validated.column;
        
        if (!targetColumn) {
          // Pre-check table existence to satisfy P154
          await adapter.executeQuery(`SELECT 1 FROM \`${table}\` LIMIT 0`);

          const infoQuery = `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = ? AND DATA_TYPE = 'vector' 
            LIMIT 1
          `;
          const pkResult = await adapter.executeQuery(infoQuery, [validated.table]);
          if (!pkResult.rows || pkResult.rows.length === 0) {
            throw new ValidationError(`No VECTOR column found in table '${validated.table}'. Please specify the 'column' parameter.`);
          }
          const firstRow = pkResult.rows[0];
          const columnName = firstRow?.['COLUMN_NAME'];
          if (typeof columnName !== 'string') {
            throw new ValidationError(`No VECTOR column found in table '${validated.table}'. Please specify the 'column' parameter.`);
          }
          targetColumn = columnName;
        }
        
        const col = sanitizeIdentifier(targetColumn);

        const query = `
          SELECT \`${idCol}\`, VECTOR_TO_STRING(\`${col}\`) as vector_str
          FROM \`${table}\`
          WHERE \`${idCol}\` = ?
        `;
        
        const result = await adapter.executeQuery(query, [validated.id]);

        if (!result.rows || result.rows.length === 0) {
          return withTokenEstimate({
            success: true,
            data: {
              exists: false,
              table: validated.table,
              id: validated.id
            }
          });
        }

        const row = result.rows[0];
        if (!row) {
          return withTokenEstimate({
            success: true,
            data: {
              exists: false,
              table: validated.table,
              id: validated.id
            }
          });
        }
        
        return withTokenEstimate({
          success: true,
          data: {
            exists: true,
            table: validated.table,
            column: targetColumn,
            id: row[idCol],
            vector: typeof row['vector_str'] === 'string' && row['vector_str'] ? parseVector(row['vector_str']) : null
          }
        });
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
    },
  };
}
