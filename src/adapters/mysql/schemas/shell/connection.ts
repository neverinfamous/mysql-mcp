import { z } from "zod";
import { ShellToolBaseSchema } from "./base.js";

// --- ShellConnect ---
export const ShellConnectSchema = ShellToolBaseSchema.extend({
  uri: z.string().optional().describe("Connection URI (e.g., user@host:port)"),
  user: z.string().optional().describe("Username for connection"),
  password: z.string().optional().describe("Password for connection"),
  host: z.string().optional().describe("Host for connection"),
  port: z.number().optional().describe("Port for connection"),
  database: z.string().optional().describe("Default database/schema"),
  sslMode: z
    .enum(["DISABLED", "REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"])
    .optional()
    .describe("SSL mode for connection"),
});

// --- ShellDisconnect ---
export const ShellDisconnectSchema = ShellToolBaseSchema.extend({
  force: z
    .boolean()
    .optional()
    .default(false)
    .describe("Force disconnection ignoring active transactions"),
});
