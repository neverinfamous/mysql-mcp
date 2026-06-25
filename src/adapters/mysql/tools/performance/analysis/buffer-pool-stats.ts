import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  BufferPoolStatsOutputSchema,
  BufferPoolStatsSchemaBase,
  BufferPoolStatsSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createBufferPoolStatsTool(
  adapter: MySQLAdapter,
): ToolDefinition {

  return {
    name: "mysql_buffer_pool_stats",
    title: "MySQL Buffer Pool Stats",
    description: "Get InnoDB buffer pool statistics.",
    group: "performance",
    inputSchema: BufferPoolStatsSchemaBase,
    outputSchema: BufferPoolStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        BufferPoolStatsSchema.parse(params);
        const result = await adapter.executeReadQuery(
          `SELECT POOL_ID, POOL_SIZE, FREE_BUFFERS, DATABASE_PAGES,
                OLD_DATABASE_PAGES, MODIFIED_DATABASE_PAGES, PENDING_DECOMPRESS,
                PENDING_READS, PENDING_FLUSH_LRU, PENDING_FLUSH_LIST,
                PAGES_MADE_YOUNG, PAGES_NOT_MADE_YOUNG,
                PAGES_MADE_YOUNG_RATE, PAGES_MADE_NOT_YOUNG_RATE,
                NUMBER_PAGES_READ, NUMBER_PAGES_CREATED, NUMBER_PAGES_WRITTEN,
                PAGES_READ_RATE, PAGES_CREATE_RATE, PAGES_WRITTEN_RATE,
                HIT_RATE, YOUNG_MAKE_PER_THOUSAND_GETS,
                NOT_YOUNG_MAKE_PER_THOUSAND_GETS
         FROM information_schema.INNODB_BUFFER_POOL_STATS`,
        );

        const response = {
          success: true,
          data: { bufferPoolStats: result.rows },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
