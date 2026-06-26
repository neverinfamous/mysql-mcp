/**
 * MySQL Security Schemas
 */

import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

// =============================================================================
// Output Schemas
// =============================================================================

export const SecurityAuditOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    source: z.string(),
    message: z.string().optional(),
    events: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
    filtersIgnored: z.array(z.string()).optional(),
    note: z.string().optional(),
  }).loose().optional(),
});

export const SecurityFirewallStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    installed: z.boolean(),
    message: z.string().optional(),
    suggestion: z.string().optional(),
    plugins: z.array(z.record(z.string(), z.unknown())).optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  }).loose().optional(),
});

export const SecurityFirewallRulesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    users: z.array(z.record(z.string(), z.unknown())),
    rules: z.array(z.record(z.string(), z.unknown())),
    userCount: z.number(),
    ruleCount: z.number(),
    message: z.string().optional(),
  }).loose().optional(),
});

export const SecurityMaskDataOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    original: z.string(),
    masked: z.string(),
    type: z.string(),
    warning: z.string().optional(),
  }).loose().optional(),
});

export const SecurityUserPrivilegesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    users: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
    summary: z.boolean().optional(),
  }).loose().optional(),
});

export const SecuritySensitiveTablesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    sensitiveTables: z.array(z.record(z.string(), z.unknown())),
    tableCount: z.number(),
    totalSensitiveColumns: z.number(),
    patternsUsed: z.array(z.string()),
    limited: z.boolean().optional(),
    totalAvailable: z.number().optional(),
  }).loose().optional(),
});

export const SecuritySslStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    sslEnabled: z.boolean(),
    currentCipher: z.string(),
    sslVersion: z.string(),
    serverCertVerification: z.boolean(),
    configuration: z.object({
      sslCa: z.string(),
      sslCert: z.string(),
      sslKey: z.string(),
      requireSecureTransport: z.string(),
    }),
    sessionStats: z.object({
      acceptedConnects: z.string(),
      finishedConnects: z.string(),
    }),
  }).loose().optional(),
});

export const SecurityEncryptionStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    keyringPlugins: z.array(z.record(z.string(), z.unknown())),
    keyringInstalled: z.boolean(),
    encryptedTablespaces: z.array(z.record(z.string(), z.unknown())),
    encryptedTablespaceCount: z.number(),
    encryptionSettings: z.record(z.string(), z.unknown()),
    tdeAvailable: z.boolean(),
  }).loose().optional(),
});

export const SecurityPasswordValidateOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    strength: z.number(),
    interpretation: z.string(),
    meetsPolicy: z.boolean(),
    policy: z.record(z.string(), z.unknown()),
  }).loose().optional(),
});
