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
  timeLastSentToServer: z.string().optional(),
  timeLastReceivedFromServer: z.string().optional(),
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

export const RouterBaseInputSchema = z.object({}).strict();

export const RouteNameInputSchemaBase = z.object({
  routeName: z.unknown().optional().describe("Name of the route to query. Anti-Hallucination Hint: Pass routeName, not route."),
  name: z.unknown().optional().describe("Alias for routeName"),
  route: z.unknown().optional().describe("Alias for routeName"),
  route_name: z.unknown().optional().describe("Alias for routeName"),
  routename: z.unknown().optional().describe("Alias for routeName"),
  routerName: z.unknown().optional().describe("Alias for routeName"),
  id: z.unknown().optional().describe("Alias for routeName"),
  clusterName: z.unknown().optional().describe("Alias for routeName"),
  cluster_name: z.unknown().optional().describe("Alias for routeName"),
  metadataName: z.unknown().optional().describe("Alias for routeName"),
  poolName: z.unknown().optional().describe("Alias for routeName"),
}).strict();

export const RouteNameWithLimitInputSchemaBase = RouteNameInputSchemaBase.extend({
  limit: z.coerce.number().int().min(1).max(1000).optional().describe("Maximum number of results to return (default: 50)"),
}).strict();

export const RouteNameInputSchema = z.preprocess(
  (data: unknown) => {
    if (typeof data !== "object" || data === null) return data;
    const obj = data as Record<string, unknown>;
    let finalName = obj["routeName"] ?? obj["route"] ?? obj["route_name"] ?? 
                    obj["name"] ?? obj["routename"] ?? obj["routerName"] ?? 
                    obj["clusterName"] ?? obj["cluster_name"] ?? 
                    obj["metadataName"] ?? obj["poolName"] ?? obj["id"];
    
    if (finalName !== undefined) {
      if (typeof finalName === "object" && finalName !== null) {
        finalName = JSON.stringify(finalName);
      } else if (typeof finalName === "number" || typeof finalName === "boolean" || typeof finalName === "bigint") {
        finalName = String(finalName);
      }
    }
    
    return {
      ...obj,
      routeName: finalName,
    };
  },
  RouteNameInputSchemaBase
).refine((data) => data.routeName !== undefined && typeof data.routeName === "string" && data.routeName.trim() !== "", {
  message: "routeName must be a non-empty string",
  path: ["routeName"]
}).transform((data) => ({
  routeName: (data.routeName ?? "") as string,
}));

export const RouteNameWithLimitInputSchema = z.preprocess(
  (data: unknown) => {
    if (typeof data !== "object" || data === null) return data;
    const obj = data as Record<string, unknown>;
    let finalName = obj["routeName"] ?? obj["route"] ?? obj["route_name"] ?? 
                    obj["name"] ?? obj["routename"] ?? obj["routerName"] ?? 
                    obj["clusterName"] ?? obj["cluster_name"] ?? 
                    obj["metadataName"] ?? obj["poolName"] ?? obj["id"];
    
    if (finalName !== undefined) {
      if (typeof finalName === "object" && finalName !== null) {
        finalName = JSON.stringify(finalName);
      } else if (typeof finalName === "number" || typeof finalName === "boolean" || typeof finalName === "bigint") {
        finalName = String(finalName);
      }
    }

    let finalLimit = obj["limit"];
    if (finalLimit !== undefined && typeof finalLimit === "string") {
      const parsed = parseInt(finalLimit, 10);
      if (!isNaN(parsed)) finalLimit = parsed;
    }
    
    return {
      ...obj,
      routeName: finalName,
      limit: finalLimit,
    };
  },
  RouteNameWithLimitInputSchemaBase
).refine((data) => data.routeName !== undefined && typeof data.routeName === "string" && data.routeName.trim() !== "", {
  message: "routeName must be a non-empty string",
  path: ["routeName"]
}).transform((data) => ({
  routeName: (data.routeName ?? "") as string,
  limit: data.limit,
}));

export const MetadataNameInputSchemaBase = z.object({
  metadataName: z
    .unknown()
    .optional()
    .describe("Name of the metadata cache instance. Anti-Hallucination Hint: Pass metadataName, not metadata."),
  name: z.unknown().optional().describe("Alias for metadataName"),
  metadata: z.unknown().optional().describe("Alias for metadataName"),
  metadata_name: z.unknown().optional().describe("Alias for metadataName"),
  metadataname: z.unknown().optional().describe("Alias for metadataName"),
  id: z.unknown().optional().describe("Alias for metadataName"),
  clusterName: z.unknown().optional().describe("Alias for metadataName"),
  cluster_name: z.unknown().optional().describe("Alias for metadataName"),
  routeName: z.unknown().optional().describe("Alias for metadataName"),
  poolName: z.unknown().optional().describe("Alias for metadataName"),
}).strict();

export const MetadataNameInputSchema = z.preprocess(
  (data: unknown) => {
    if (typeof data !== "object" || data === null) return data;
    const obj = data as Record<string, unknown>;
    let finalName = obj["metadataName"] ?? obj["metadata"] ?? obj["metadata_name"] ?? 
                    obj["name"] ?? obj["metadataname"] ?? obj["clusterName"] ?? 
                    obj["cluster_name"] ?? obj["routeName"] ?? obj["poolName"] ?? obj["id"];
                         
    if (finalName !== undefined) {
      if (typeof finalName === "object" && finalName !== null) {
        finalName = JSON.stringify(finalName);
      } else if (typeof finalName === "number" || typeof finalName === "boolean" || typeof finalName === "bigint") {
        finalName = String(finalName);
      }
    }
    
    return {
      ...obj,
      metadataName: finalName,
    };
  },
  MetadataNameInputSchemaBase
).refine((data) => data.metadataName !== undefined && typeof data.metadataName === "string" && data.metadataName.trim() !== "", {
  message: "metadataName must not be empty",
  path: ["metadataName"]
}).transform((data) => ({
  metadataName: (data.metadataName ?? "") as string,
}));

export const ConnectionPoolNameInputSchemaBase = z.object({
  poolName: z.unknown().optional().describe("Name of the connection pool (the default pool is typically named 'main'). Anti-Hallucination Hint: Pass poolName, not pool."),
  name: z.unknown().optional().describe("Alias for poolName"),
  pool: z.unknown().optional().describe("Alias for poolName"),
  pool_name: z.unknown().optional().describe("Alias for poolName"),
  poolname: z.unknown().optional().describe("Alias for poolName"),
  id: z.unknown().optional().describe("Alias for poolName"),
  clusterName: z.unknown().optional().describe("Alias for poolName"),
  cluster_name: z.unknown().optional().describe("Alias for poolName"),
  routeName: z.unknown().optional().describe("Alias for poolName"),
  metadataName: z.unknown().optional().describe("Alias for poolName"),
}).strict();

export const ConnectionPoolNameInputSchema = z.preprocess(
  (data: unknown) => {
    if (typeof data !== "object" || data === null) return data;
    const obj = data as Record<string, unknown>;
    let finalName = obj["poolName"] ?? obj["pool"] ?? obj["pool_name"] ?? 
                    obj["name"] ?? obj["poolname"] ?? obj["clusterName"] ?? 
                    obj["cluster_name"] ?? obj["routeName"] ?? obj["metadataName"] ?? obj["id"];
                     
    if (finalName !== undefined) {
      if (typeof finalName === "object" && finalName !== null) {
        finalName = JSON.stringify(finalName);
      } else if (typeof finalName === "number" || typeof finalName === "boolean" || typeof finalName === "bigint") {
        finalName = String(finalName);
      }
    } else {
      finalName = "main";
    }
    
    return {
      ...obj,
      poolName: finalName,
    };
  },
  ConnectionPoolNameInputSchemaBase
).refine((data) => data.poolName !== undefined && typeof data.poolName === "string" && data.poolName.trim() !== "", {
  message: "poolName must not be empty",
  path: ["poolName"]
}).transform((data) => ({
  poolName: (data.poolName ?? "") as string,
}));

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
