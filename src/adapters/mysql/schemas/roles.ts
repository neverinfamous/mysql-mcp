import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

// Output Schemas

export const RoleListOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    roles: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const RoleCreateOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    roleName: z.string(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  }).loose().optional(),
});

export const RoleDropOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    roleName: z.string(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  }).loose().optional(),
});

export const RoleGrantsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    role: z.string(),
    grants: z.array(z.string()),
    exists: z.boolean(),
  }).loose().optional(),
});

export const RoleGrantPrivilegeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    role: z.string(),
    privileges: z.array(z.string()),
    database: z.string(),
    table: z.string(),
  }).loose().optional(),
});

export const RoleAssignOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    role: z.string(),
    user: z.string(),
    host: z.string(),
  }).loose().optional(),
});

export const RoleRevokeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    role: z.string(),
    user: z.string().optional(),
    host: z.string().optional(),
    privileges: z.array(z.string()).optional(),
    database: z.string().optional(),
    table: z.string().optional(),
  }).loose().optional(),
});

export const UserRolesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    user: z.string(),
    host: z.string(),
    roles: z.array(z.record(z.string(), z.unknown())),
  }).loose().optional(),
});
