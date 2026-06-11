import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../../utils/logger.js";
import { z } from "zod";
import type {
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
} from "../../types/index.js";
import type { DatabaseAdapter } from "./database-adapter.js";

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

  // Create the tool options object with input schema
  // registerTool expects options as the second argument
  server.registerTool(
    tool.name,
    {
      ...toolOptions,
      inputSchema: tool.inputSchema ? tool.inputSchema : {},
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
    },
    async (params: unknown, extra?: unknown) => {
      let progressToken: string | number | undefined;
      if (typeof extra === "object" && extra !== null && "_meta" in extra) {
        const meta = extra._meta;
        if (typeof meta === "object" && meta !== null && "progressToken" in meta) {
          const pt = meta.progressToken;
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
          if (tool.outputSchema) {
            return {
              content: [{ type: "text", text: finalText }],
              structuredContent: isRecord(result) ? result : undefined,
            } satisfies CallToolResult;
          }
          
          return {
            content: [{ type: "text", text: finalText }],
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
      return await execFn();
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
    resource.uri,
    resource.name,
    resourceMeta,
    async (uri: string | URL, _extra?: unknown) => {
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
  let argsSchema: Record<string, z.ZodType> | undefined;
  if (prompt.arguments && prompt.arguments.length > 0) {
    argsSchema = {};
    for (const arg of prompt.arguments) {
      argsSchema[arg.name] = z.string().optional().describe(arg.description);
    }
  }

  const registered = server.registerPrompt(
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

  // Patch the SDK's stored Zod object schema to accept `undefined` input.
  if (registered.argsSchema && typeof registered.argsSchema === "object") {
    const zodObj: unknown = Reflect.get(registered.argsSchema, "_zod");
    if (typeof zodObj === "object" && zodObj !== null) {
      const runFn: unknown = Reflect.get(zodObj, "run");
      if (typeof runFn === "function") {
        Reflect.set(zodObj, "run", (...args: unknown[]) => {
          const payload = args[0];
          if (typeof payload === "object" && payload !== null && "value" in payload) {
            const val = Reflect.get(payload, "value");
            if (val === undefined || val === null) {
              Reflect.set(payload, "value", {});
            }
          }
          const res: unknown = Reflect.apply(runFn, zodObj, args);
          return res;
        });
      }
    }
  }
}
