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
      inputSchema: tool.inputSchema as z.ZodType,
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
    },
    async (params: unknown, extra?: unknown) => {
      const extraMeta = extra as
        | { _meta?: { progressToken?: string | number } }
        | undefined;
      const progressToken = extraMeta?._meta?.progressToken;
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
              content: [{ type: "text" as const, text: finalText }],
              structuredContent: result as Record<string, unknown>,
            };
          }
          
          return {
            content: [{ type: "text" as const, text: finalText }],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text:
                typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2),
            },
          ],
        };
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
    async (uri: URL) => {
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
  // Build a Zod raw shape from prompt.arguments so the SDK can
  // advertise argument metadata in prompts/list via promptArgumentsFromSchema().
  //
  // ALL fields are .optional() because the SDK validates BEFORE our handler
  // runs. If required fields used z.string() (non-optional), clients that
  // invoke prompts without filling in required args would get a raw Zod
  // error instead of our graceful guide message. Required-ness is enforced
  // by the handler-level missing-arg check below.
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
      // Cast args to Record<string, string> for handler compatibility
      const args = (providedArgs ?? {}) as Record<string, string>;

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
              role: "user" as const,
              content: {
                type: "text" as const,
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
            role: "user" as const,
            content: {
              type: "text" as const,
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
  // The SDK's prompts/get handler calls safeParseAsync(argsSchema, args)
  // where args may be `undefined` when clients omit them. Zod v4's
  // z.object().safeParse(undefined) rejects — but we need it to succeed
  // (coercing to {}) so our handler-level required-arg check can provide
  // a graceful guide message instead of a raw Zod crash.
  // The metadata (shape, type) is preserved for promptArgumentsFromSchema().
  if (registered.argsSchema) {
    const schema = registered.argsSchema as unknown as {
      _zod: { run: (ctx: { value: unknown }) => unknown };
    };
    const originalRun = schema._zod.run.bind(schema._zod);
    schema._zod.run = (ctx: { value: unknown }) => {
      ctx.value ??= {};
      return originalRun(ctx);
    };
  }
}
