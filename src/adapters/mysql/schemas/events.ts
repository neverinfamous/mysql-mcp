import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

// =============================================================================
// Input Schemas
// =============================================================================

export const EventCreateSchemaBase = z.object({
  name: z.string().optional().describe("Event name. Note: Do not use eventName."),
  eventName: z.string().optional().describe("Alias for name"),
  schedule: z.string().optional().describe("Event schedule string (e.g., 'EVERY 1 DAY')"),
  body: z.string().optional().describe("SQL statement(s) to execute. Note: Can also use sql or query."),
  sql: z.string().optional().describe("Alias for body"),
  query: z.string().optional().describe("Alias for body"),
  onCompletion: z
    .string()
    .optional()
    .default("NOT PRESERVE")
    .describe("What to do after event completes"),
  status: z
    .enum(["ENABLE", "DISABLE", "DISABLE ON SLAVE"])
    .optional()
    .default("ENABLE")
    .describe("Event status"),
  comment: z.string().optional().describe("Event comment"),
  ifNotExists: z.boolean().optional().default(false).describe("Add IF NOT EXISTS clause"),
});

export const EventCreateSchema = z.object({
  name: z.string().optional(),
  eventName: z.string().optional(),
  schedule: z.string().optional(),
  body: z.string().optional(),
  sql: z.string().optional(),
  query: z.string().optional(),
  onCompletion: z.string().default("NOT PRESERVE"),
  status: z.enum(["ENABLE", "DISABLE", "DISABLE ON SLAVE"]).default("ENABLE"),
  comment: z.string().optional(),
  ifNotExists: z.boolean().default(false),
}).transform(data => ({
  name: data.name ?? data.eventName ?? "",
  schedule: data.schedule ?? "",
  body: data.body ?? data.sql ?? data.query ?? "",
  onCompletion: data.onCompletion,
  status: data.status,
  comment: data.comment,
  ifNotExists: data.ifNotExists,
})).refine(data => data.name !== "", { message: "name (or eventName alias) is required" })
  .refine(data => data.schedule !== "", { message: "schedule is required" })
  .refine(data => data.body !== "", { message: "body is required" });


export const EventAlterSchemaBase = z.object({
  name: z.string().optional().describe("Event name. Note: Do not use eventName."),
  eventName: z.string().optional().describe("Alias for name"),
  newName: z.string().optional().describe("New event name (for rename)"),
  schedule: z.string().optional().describe("New schedule configuration"),
  body: z.string().optional().describe("New SQL statement(s). Note: Can also use sql or query."),
  sql: z.string().optional().describe("Alias for body"),
  query: z.string().optional().describe("Alias for body"),
  onCompletion: z.string().optional(),
  status: z
    .enum(["ENABLE", "DISABLE", "DISABLE ON SLAVE"])
    .optional()
    .describe("Event status"),
  comment: z.string().optional(),
});

export const EventAlterSchema = z.object({
  name: z.string().optional(),
  eventName: z.string().optional(),
  newName: z.string().optional(),
  schedule: z.string().optional(),
  body: z.string().optional(),
  sql: z.string().optional(),
  query: z.string().optional(),
  onCompletion: z.string().optional(),
  status: z.enum(["ENABLE", "DISABLE", "DISABLE ON SLAVE"]).optional(),
  comment: z.string().optional(),
}).transform(data => ({
  name: data.name ?? data.eventName ?? "",
  newName: data.newName,
  schedule: data.schedule,
  body: data.body ?? data.sql ?? data.query,
  onCompletion: data.onCompletion,
  status: data.status,
  comment: data.comment,
})).refine(data => data.name !== "", { message: "name (or eventName alias) is required" });


export const EventDropSchemaBase = z.object({
  name: z.string().optional().describe("Event name to drop. Note: Do not use eventName."),
  eventName: z.string().optional().describe("Alias for name"),
  ifExists: z.boolean().optional().default(false).describe("Add IF EXISTS clause"),
});

export const EventDropSchema = z.object({
  name: z.string().optional(),
  eventName: z.string().optional(),
  ifExists: z.boolean().default(false),
}).transform(data => ({
  name: data.name ?? data.eventName ?? "",
  ifExists: data.ifExists,
})).refine(data => data.name !== "", { message: "name (or eventName alias) is required" });


export const EventListSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  includeDisabled: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include disabled events"),
});

export const EventListSchema = z.object({
  schema: z.string().optional(),
  database: z.string().optional(),
  includeDisabled: z.boolean().default(true),
}).transform(data => ({
  schema: data.schema ?? data.database,
  includeDisabled: data.includeDisabled,
}));


export const EventStatusSchemaBase = z.object({
  name: z.string().optional().describe("Event name"),
  eventName: z.string().optional().describe("Alias for name"),
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
});

export const EventStatusSchema = z.object({
  name: z.string().optional(),
  eventName: z.string().optional(),
  schema: z.string().optional(),
  database: z.string().optional(),
}).transform(data => ({
  name: data.name ?? data.eventName ?? "",
  schema: data.schema ?? data.database,
})).refine(data => data.name !== "", { message: "name (or eventName alias) is required" });


export const SchedulerStatusSchemaBase = z.object({});

export const SchedulerStatusSchema = z.object({}).transform(() => ({}));

// =============================================================================
// Output Schemas
// =============================================================================

export const EventCreateOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    eventName: z.string(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  }).optional()
});

export const EventAlterOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    eventName: z.string(),
  }).optional()
});

export const EventDropOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    eventName: z.string(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  }).optional()
});

export const EventListOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    events: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).optional()
});

export const EventStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    name: z.string(),
    event: z.record(z.string(), z.unknown()).optional(),
  }).optional()
});

export const SchedulerStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    schedulerEnabled: z.boolean(),
    schedulerStatus: z.string(),
    status: z.string(),
    eventCounts: z.array(z.record(z.string(), z.unknown())),
    recentlyExecuted: z.array(z.record(z.string(), z.unknown())),
  }).optional()
});
