/**
 * MySQL Cluster Schemas
 */

import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

// =============================================================================
// Input Schemas
// =============================================================================

export const MemberSchemaBase = z.object({
  memberId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID format").optional().describe("Filter by specific member UUID"),
  id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID format").optional().describe("Alias for memberId"),
  member: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID format").optional().describe("Alias for memberId"),
  uuid: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID format").optional().describe("Alias for memberId"),
}).strict();

export const MemberSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "string") {
      return { memberId: val };
    }
    if (val !== null && typeof val === "object") {
      const v = val as Record<string, unknown>;
      let resultMemberId = v["memberId"];
      if (resultMemberId === undefined || resultMemberId === null || resultMemberId === "") {
        if ("id" in v) resultMemberId = v["id"];
        else if ("member" in v) resultMemberId = v["member"];
        else if ("uuid" in v) resultMemberId = v["uuid"];
      }
      const rest = { ...v };
      delete rest["id"];
      delete rest["member"];
      delete rest["uuid"];
      if (resultMemberId !== undefined && resultMemberId !== null && resultMemberId !== "") {
        return { ...rest, memberId: resultMemberId };
      }
      return rest;
    }
    return val;
  },
  z.object({
    memberId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID format").optional().describe("Filter by specific member UUID"),
  }).strict()
);

export const LimitSchemaBase = z.object({
  limit: z.any().optional().describe("Maximum number of results"),
  count: z.any().optional().describe("Alias for limit"),
}).strict();

export const SummarySchemaBase = z.object({
  summary: z.preprocess((val) => {
    if (typeof val === 'boolean') return val;
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()).describe("If true, return condensed output without configuration blobs"),
}).strict();

// =============================================================================
// Output Schemas
// =============================================================================

export const GRStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    enabled: z.boolean(),
    groupName: z.string().nullable(),
    singlePrimaryMode: z.boolean(),
    localAddress: z.string().nullable(),
    localMember: z.record(z.string(), z.unknown()).nullable(),
    memberCount: z.number(),
    members: z.array(z.record(z.string(), z.unknown())),
  }).loose().optional(),
});

export const GRMembersOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    members: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const GRPrimaryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    primary: z.object({
      memberId: z.string(),
      host: z.string(),
      port: z.number(),
      state: z.string(),
      version: z.string(),
    }).nullable().optional(),
    hasPrimary: z.boolean(),
    isLocalPrimary: z.boolean(),
  }).loose().optional(),
});

export const GRTransactionsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    memberStats: z.array(z.record(z.string(), z.unknown())),
    gtid: z.object({
      executed: z.string(),
      purged: z.string(),
    }),
  }).loose().optional(),
});

export const GRFlowControlOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    configuration: z.record(z.string(), z.unknown()),
    memberQueues: z.array(z.record(z.string(), z.unknown())),
    isThrottling: z.boolean(),
    recommendation: z.string(),
  }).loose().optional(),
});

export const ClusterStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    isInnoDBCluster: z.boolean(),
    message: z.string().optional(),
    onlineMembers: z.number().optional(),
    cluster: z.record(z.string(), z.unknown()).nullable().optional(),
    instanceCount: z.number().optional(),
    routerCount: z.number().optional(),
    status: z.string().optional(),
    topology: z.record(z.string(), z.unknown()).optional(),
  }).loose().optional(),
});

export const ClusterInstancesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    source: z.string().optional(),
    instances: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const ClusterTopologyOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    topology: z.record(z.string(), z.unknown()),
    visualization: z.string(),
    totalMembers: z.number(),
    onlineMembers: z.number(),
  }).loose().optional(),
});

export const ClusterRouterStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    routers: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
    staleCount: z.number(),
  }).loose().optional(),
});

export const ClusterSwitchoverOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    currentPrimary: z.record(z.string(), z.unknown()).nullable(),
    candidates: z.array(z.record(z.string(), z.unknown())),
    recommendedTarget: z.record(z.string(), z.unknown()).nullable(),
    canSwitchover: z.boolean(),
    warning: z.string().optional(),
  }).loose().optional(),
});
