/**
 * MySQL Router Types and Schemas
 *
 * Type definitions and Zod validation schemas for MySQL Router REST API tools.
 */

import { z } from "zod";

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

export const RouteNameInputSchema = z.object({
  routeName: z.string().describe("Name of the route to query"),
});

export const MetadataNameInputSchema = z.object({
  metadataName: z.string().describe("Name of the metadata cache instance"),
});

export const ConnectionPoolNameInputSchema = z.object({
  poolName: z.string().describe("Name of the connection pool"),
});
