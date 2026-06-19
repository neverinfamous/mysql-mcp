/**
 * MySQL Router Types and Schemas
 *
 * Type definitions and Zod validation schemas for MySQL Router REST API tools.
 */

import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

// =============================================================================
// Router Status Types
// =============================================================================

export const RouterStatusResponseSchema = z.object({
  processId: z.number().optional(),
  productEdition: z.string().optional(),
  timeStarted: z.string().optional(),
  version: z.string().optional(),
  hostname: z.string().optional(),
});

export type RouterStatusResponse = z.infer<typeof RouterStatusResponseSchema>;

// =============================================================================
// Route Types
// =============================================================================

export const RouteSchema = z.object({
  name: z.string(),
});

export const RouteListSchema = z.object({
  items: z.array(RouteSchema),
});

export type RouteList = z.infer<typeof RouteListSchema>;

export const RouteStatusSchema = z.object({
  activeConnections: z.number().optional(),
  totalConnections: z.number().optional(),
  blockedHosts: z.number().optional(),
});

export type RouteStatus = z.infer<typeof RouteStatusSchema>;

export const RouteHealthSchema = z.object({
  isAlive: z.boolean(),
});

export type RouteHealth = z.infer<typeof RouteHealthSchema>;

export const RouteConnectionSchema = z.object({
  bytesFromServer: z.number().optional(),
  bytesToServer: z.number().optional(),
  sourceAddress: z.string().optional(),
  destinationAddress: z.string().optional(),
  timeStarted: z.string().optional(),
  timeConnectedToServer: z.string().optional(),
});

export const RouteConnectionsListSchema = z.object({
  items: z.array(RouteConnectionSchema),
});

export type RouteConnectionsList = z.infer<typeof RouteConnectionsListSchema>;

export const RouteDestinationSchema = z.object({
  address: z.string(),
  port: z.number(),
});

export const RouteDestinationsListSchema = z.object({
  items: z.array(RouteDestinationSchema),
});

export type RouteDestinationsList = z.infer<typeof RouteDestinationsListSchema>;

export const BlockedHostSchema = z.object({
  hostname: z.string(),
});

export const BlockedHostsListSchema = z.object({
  items: z.array(BlockedHostSchema),
});

export type BlockedHostsList = z.infer<typeof BlockedHostsListSchema>;

// =============================================================================
// Metadata Types
// =============================================================================

export const MetadataStatusSchema = z.object({
  refreshFailed: z.number().optional(),
  refreshSucceeded: z.number().optional(),
  lastRefreshHostname: z.string().optional(),
  lastRefreshPort: z.number().optional(),
  timeLastRefreshSucceeded: z.string().optional(),
  timeLastRefreshFailed: z.string().optional(),
});

export type MetadataStatus = z.infer<typeof MetadataStatusSchema>;

// =============================================================================
// Connection Pool Types
// =============================================================================

export const ConnectionPoolStatusSchema = z.object({
  stashedServerConnections: z.number().optional(),
  idleServerConnections: z.number().optional(),
});

export type ConnectionPoolStatus = z.infer<typeof ConnectionPoolStatusSchema>;

// =============================================================================
// Tool Input Schemas
// =============================================================================

export const RouterBaseInputSchema = z.object({});

export const RouteNameInputSchemaBase = z.object({
  routeName: z.string().optional().describe("Name of the route to query"),
  name: z.string().optional().describe("Alias for routeName"),
});

export const RouteNameInputSchema = z
  .object({
    routeName: z.unknown().optional(),
    name: z.unknown().optional(),
  })
  .transform((data) => {
    const raw = data.routeName !== undefined ? data.routeName : data.name;
    return {
      routeName:
        typeof raw === "string"
          ? raw
          : typeof raw === "number" || typeof raw === "boolean"
            ? raw.toString()
            : "",
    };
  })
  .refine((data) => data.routeName !== "", {
    message: "routeName must not be empty",
  });

export const MetadataNameInputSchemaBase = z.object({
  metadataName: z
    .string()
    .optional()
    .describe("Name of the metadata cache instance"),
  name: z.string().optional().describe("Alias for metadataName"),
});

export const MetadataNameInputSchema = z
  .object({
    metadataName: z.unknown().optional(),
    name: z.unknown().optional(),
  })
  .transform((data) => {
    const raw =
      data.metadataName !== undefined ? data.metadataName : data.name;
    return {
      metadataName:
        typeof raw === "string"
          ? raw
          : typeof raw === "number" || typeof raw === "boolean"
            ? raw.toString()
            : "",
    };
  })
  .refine((data) => data.metadataName !== "", {
    message: "metadataName must not be empty",
  });

export const ConnectionPoolNameInputSchemaBase = z.object({
  poolName: z.string().optional().describe("Name of the connection pool (defaults to 'main')"),
  name: z.string().optional().describe("Alias for poolName"),
});

export const ConnectionPoolNameInputSchema = z
  .object({
    poolName: z.unknown().optional(),
    name: z.unknown().optional(),
  })
  .transform((data) => {
    const raw = data.poolName !== undefined ? data.poolName : data.name;
    const resolved =
      typeof raw === "string"
        ? raw
        : typeof raw === "number" || typeof raw === "boolean"
          ? raw.toString()
          : "main";
    return { poolName: resolved };
  })
  .refine((data) => data.poolName !== "", {
    message: "poolName must not be empty",
  });

// =============================================================================
// Tool Output Schemas
// =============================================================================

export const RouterStatusOutputSchema = BaseOutputSchema.extend({
  data: RouterStatusResponseSchema.optional(),
});

export const RouterRoutesOutputSchema = BaseOutputSchema.extend({
  data: RouteListSchema.optional(),
});

export const RouterRouteStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    routeName: z.string(),
    status: RouteStatusSchema.optional(),
  }).loose().optional(),
});

export const RouterRouteHealthOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    routeName: z.string(),
    health: RouteHealthSchema.optional(),
  }).loose().optional(),
});

export const RouterRouteConnectionsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    routeName: z.string(),
    connections: RouteConnectionsListSchema.optional(),
  }).loose().optional(),
});

export const RouterRouteDestinationsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    routeName: z.string(),
    destinations: RouteDestinationsListSchema.optional(),
  }).loose().optional(),
});

export const RouterRouteBlockedHostsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    routeName: z.string(),
    blockedHosts: BlockedHostsListSchema.optional(),
  }).loose().optional(),
});

export const RouterMetadataStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    metadataName: z.string(),
    status: MetadataStatusSchema.optional(),
  }).loose().optional(),
});

export const RouterPoolStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    poolName: z.string(),
    status: ConnectionPoolStatusSchema.optional(),
  }).loose().optional(),
});
