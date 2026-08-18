import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import { logger } from "../../utils/logger.js";
import { z } from "zod";
import type {
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
} from "../../types/index.js";
import type { DatabaseAdapter } from "./database-adapter.js";
import { metrics } from "../../observability/metrics/index.js";

/**
 * Patches a Zod schema's ~standard JSON Schema output to remove
 * `additionalProperties: false` that would block MCP SDK _meta injection.
 *
 * Zod 4 natively emits JSON Schema 2020-12 via ~standard — no external
 * library needed. The deprecated `zod-to-json-schema` v3.x is incompatible
 * with Zod 4 and silently returns `{}`, which is why it was removed.
 */
function patchSchemaForMcp<T extends z.ZodType>(schema: T): T {
  // Extract Zod 4's native ~standard interface
  interface StandardLike { jsonSchema: { input: () => Record<string, unknown>; output?: () => Record<string, unknown> } }
  const std = (schema as unknown as { "~standard": StandardLike | undefined })["~standard"];
  if (std?.jsonSchema?.input === undefined) return schema;
  const original = std;

  // Cache the patched schema to avoid repeated cloning
  let cached: Record<string, unknown> | null = null;

  function getPatchedSchema(): Record<string, unknown> {
    if (!cached) {
      cached = JSON.parse(JSON.stringify(original.jsonSchema.input())) as Record<string, unknown>;
      stripAdditionalProperties(cached);
    }
    return cached;
  }

  return new Proxy(schema, {
    get(target, prop, receiver): unknown {
      if (prop === "~standard") {
        const existing = Reflect.get(target, prop, receiver) as object;
        return {
          ...existing,
          jsonSchema: {
            input: () => getPatchedSchema(),
            output: () => getPatchedSchema()
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      if (prop === "~standard") return true;
      return Reflect.has(target, prop);
    }
  });
}

function stripAdditionalProperties(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) return;
  const rec = obj as Record<string, unknown>;
  if (rec["type"] === 'object' && rec["additionalProperties"] === false) {
    delete rec["additionalProperties"];
  }
  for (const key of Object.keys(rec)) {
    stripAdditionalProperties(rec[key]);
  }
}

/**
 * Register all enabled tools with the MCP server
 */
export function registerTools(adapter: DatabaseAdapter, server: McpServer, enabledTools: Set<string>): void {
  const tools = adapter.getToolDefinitions();
  let registered = 0;

  for (const tool of tools) {
    if (enabledTools.has(tool.name)) {
      registerTool(adapter, server, tool);
      registered++;
    }
  }

  logger.info(
    `Registered ${registered}/${tools.length} tools from ${adapter.name}`,
  );
}

/**
 * Register a single tool with the MCP server
 */
export function registerTool(adapter: DatabaseAdapter, server: McpServer, tool: ToolDefinition): void {
  // MCP SDK server.registerTool() registration
  // Build MCP tool options with annotations (MCP Spec 2025-11-25)
  const toolOptions: Record<string, unknown> = {
    description: tool.description,
  };

  // Add title if provided (human-readable display name)
  if (tool.title) {
    toolOptions["title"] = tool.title;
  }

  // Add behavioral annotations for AI clients
  if (tool.annotations) {
    toolOptions["annotations"] = tool.annotations;
  }

  if (tool.inputSchema !== undefined) {
    const schema = tool.inputSchema instanceof z.ZodType 
      ? tool.inputSchema 
      : z.object(tool.inputSchema);
    toolOptions["inputSchema"] = patchSchemaForMcp(schema);
  }

  if (tool.outputSchema !== undefined) {
    toolOptions["outputSchema"] = patchSchemaForMcp(tool.outputSchema);
  }

  const hasOutputSchema = Boolean(tool.outputSchema);

  // registerTool expects options as the second argument
  server.registerTool(
    tool.name,
    toolOptions,
    async (params: unknown, ctx?: unknown) => {
      try {
        let progressToken: string | number | undefined;
        if (typeof ctx === "object" && ctx !== null) {
          if ("mcpReq" in ctx) {
            // MCP SDK v2.0.0 attaches _meta directly to mcpReq
            const req = (ctx as { mcpReq?: { _meta?: { progressToken?: string | number } } }).mcpReq;
            const pt = req?._meta?.progressToken;
            if (typeof pt === "string" || typeof pt === "number") {
              progressToken = pt;
            }
          }
        }
        const context = adapter.createContext(undefined, server, progressToken);

        const execFn = async (): Promise<CallToolResult> => {
          const result = await tool.handler(params, context);

          // Inject _meta.tokenEstimate into object responses
          if (typeof result === "object" && result !== null) {
            const withMeta = JSON.stringify(
              { ...result, _meta: { tokenEstimate: 0 } },
              null,
              2,
            );
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(withMeta, "utf8") / 4,
            );
            const finalText = withMeta.replace(
              '"tokenEstimate": 0',
              `"tokenEstimate": ${String(tokenEstimate)}`,
            );
            
            // If tool declares an outputSchema, return structuredContent
            if (hasOutputSchema) {
              const isError = isRecord(result) && result["success"] === false;
              return {
                content: [{ type: "text", text: finalText }],
                structuredContent: isRecord(result) ? result : undefined,
                ...(isError ? { isError: true } : {}),
              } satisfies CallToolResult;
            }
            
            const isError = isRecord(result) && result["success"] === false;
            return {
              content: [{ type: "text", text: finalText }],
              ...(isError ? { isError: true } : {}),
            } satisfies CallToolResult;
          }

          return {
            content: [
              {
                type: "text",
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
              },
            ],
          } satisfies CallToolResult;
        };

        const auditInterceptor = adapter.getAuditInterceptor();
        if (auditInterceptor) {
          return await auditInterceptor.around(
            tool.name,
            params,
            context.requestId,
            execFn,
          );
        }

        // Auditing is disabled, but we still need to record metrics
        const startTime = Date.now();
        let success = false;
        let tokens = 0;
        let errorType: string | undefined;
        let errorCategory: string | undefined;

        try {
          const result = await execFn();
          success = !result.isError;
          if (success) {
            tokens = result.content?.[0]?.type === "text" 
              ? Math.ceil(Buffer.byteLength(result.content[0].text, "utf8") / 4) 
              : 0;
          }
          return result;
        } catch (error: unknown) {
          errorType = error instanceof Error ? error.name : "UnknownError";
          errorCategory = "Internal";
          throw error; // Let the outer catch block format the error
        } finally {
          const durationMs = Date.now() - startTime;
          metrics.recordToolCall(tool.name, durationMs, success, tokens, errorType, errorCategory);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (hasOutputSchema) {
          const errorResult = {
            success: false,
            error: errorMessage,
            code: "INTERNAL_ERROR",
            category: "internal",
            recoverable: false,
          };

          const enriched = JSON.stringify({
            ...errorResult,
            _meta: { tokenEstimate: 0 },
          });
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(enriched, "utf8") / 4,
          );
          const finalText = enriched.replace(
            '"tokenEstimate":0',
            `"tokenEstimate":${String(tokenEstimate)}`,
          );

          return {
            content: [{ type: "text", text: finalText }],
            structuredContent: errorResult,
            isError: true,
          } satisfies CallToolResult;
        }

        return {
          content: [{ type: "text", text: `Error: ${errorMessage}` }],
          isError: true,
        } satisfies CallToolResult;
      }
    },
  );
}

/**
 * Register resources with the MCP server
 */
export function registerResources(adapter: DatabaseAdapter, server: McpServer): void {
  const resources = adapter.getResourceDefinitions();
  for (const resource of resources) {
    registerResource(adapter, server, resource);
  }
  logger.info(`Registered ${resources.length} resources from ${adapter.name}`);
}

// Helper to type guard records
function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}

/**
 * Register a single resource with the MCP server
 */
export function registerResource(
  adapter: DatabaseAdapter,
  server: McpServer,
  resource: ResourceDefinition,
): void {
  // Build resource metadata with MCP 2025-11-25 enhancements
  const resourceMeta: Record<string, unknown> = {
    description: resource.description,
    mimeType: resource.mimeType ?? "application/json",
  };

  // Add title if provided
  if (resource.title) {
    resourceMeta["title"] = resource.title;
  }

  // Add annotations for AI clients (audience, priority, lastModified)
  if (resource.annotations) {
    resourceMeta["annotations"] = resource.annotations;
  }

  server.registerResource(
    resource.name,
    resource.uri,
    resourceMeta,
    async (uri: string | URL, _extra?: unknown) => {
      metrics.recordResourceRead(uri.toString());
      const context = adapter.createContext();
      const result = await resource.handler(uri.toString(), context);
      
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: resource.mimeType ?? "application/json",
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
        ...(resource.ttlMs !== undefined ? { ttlMs: resource.ttlMs } : {}),
        ...(resource.cacheScope !== undefined ? { cacheScope: resource.cacheScope } : {}),
      };
    },
  );
}

/**
 * Register prompts with the MCP server
 */
export function registerPrompts(adapter: DatabaseAdapter, server: McpServer): void {
  const prompts = adapter.getPromptDefinitions();
  for (const prompt of prompts) {
    registerPrompt(adapter, server, prompt);
  }
  logger.info(`Registered ${prompts.length} prompts from ${adapter.name}`);
}

/**
 * Register a single prompt with the MCP server
 */
export function registerPrompt(adapter: DatabaseAdapter, server: McpServer, prompt: PromptDefinition): void {
  let argsSchema: z.ZodObject<z.ZodRawShape> | undefined;
  if (prompt.arguments && prompt.arguments.length > 0) {
    const shape: Record<string, z.ZodType> = {};
    for (const arg of prompt.arguments) {
      shape[arg.name] = z.string().optional().describe(arg.description);
    }
    argsSchema = z.object(shape);
  }

  server.registerPrompt(
    prompt.name,
    {
      description: prompt.description,
      argsSchema,
    },
    async (providedArgs) => {
      const context = adapter.createContext();
      const args: Record<string, string> = {};
      if (typeof providedArgs === "object" && providedArgs !== null) {
        for (const [k, v] of Object.entries(providedArgs)) {
          if (typeof v === "string") {
            args[k] = v;
          }
        }
      }

      // Check for missing required arguments
      const requiredArgs = prompt.arguments?.filter((a) => a.required) ?? [];
      const missingArgs = requiredArgs.filter((a) => !args[a.name]);
      if (missingArgs.length > 0) {
        // Return a helpful guide listing expected arguments
        const argList = (prompt.arguments ?? [])
          .map(
            (a) =>
              `- **${a.name}**${a.required ? " (required)" : " (optional)"}: ${a.description}`,
          )
          .join("\n");
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `# ${prompt.name}\n\n${prompt.description}\n\n## Arguments\n\n${argList}\n\nPlease provide the required arguments to use this prompt.`,
              },
            },
          ],
        };
      }

      const result = await prompt.handler(args, context);
      return {
          messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2),
            },
          },
        ],
      };
    },
  );
}
