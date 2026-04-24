import { z } from "zod";

export const EventCreateSchema = z.object({
  name: z.string().describe("Event name"),
  schedule: z.string().describe("Event schedule string (e.g., 'EVERY 1 DAY')"),
  body: z.string().describe("SQL statement(s) to execute"),
  onCompletion: z.string().default("NOT PRESERVE").describe("What to do after event completes"),
  status: z.enum(["ENABLE", "DISABLE", "DISABLE ON SLAVE"]).default("ENABLE").describe("Event status"),
  comment: z.string().optional().describe("Event comment"),
  ifNotExists: z.boolean().default(false).describe("Add IF NOT EXISTS clause"),
});

export const EventAlterSchema = z.object({
  name: z.string().describe("Event name"),
  newName: z.string().optional().describe("New event name (for rename)"),
  schedule: z.string().optional().describe("New schedule configuration"),
  body: z.string().optional().describe("New SQL statement(s)"),
  onCompletion: z.string().optional(),
  status: z.enum(["ENABLE", "DISABLE", "DISABLE ON SLAVE"]).optional().describe("Event status"),
  comment: z.string().optional(),
});

export const EventDropSchema = z.object({
  name: z.string().describe("Event name to drop"),
  ifExists: z.boolean().default(false).describe("Add IF EXISTS clause"),
});

export const EventListSchema = z.object({
  schema: z.string().optional().describe("Schema name (defaults to current database)"),
  includeDisabled: z.boolean().default(true).describe("Include disabled events"),
});

export const EventStatusSchema = z.object({
  name: z.string().describe("Event name"),
  schema: z.string().optional().describe("Schema name (defaults to current database)"),
});
