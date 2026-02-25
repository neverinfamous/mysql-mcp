import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";
import { getSecurityTools } from "../security/index.js";

describe("Security Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;
  let tools: ReturnType<typeof getSecurityTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
    tools = getSecurityTools(mockAdapter as any);
  });

  describe("mysql_security_audit", () => {
    it("should first check for audit log table", async () => {
      // Check table exists (fail)
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      // Check performance schema fallback
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { event: "SELECT", user: "root", startTime: 123456 },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_security_audit");
      const result = (await tool?.handler({ limit: 10 }, mockContext)) as any;

      expect(result.source).toBe("performance_schema");
      expect(result.events).toHaveLength(1);
    });

    it("should query mysql.audit_log if exists", async () => {
      // Check table exists (success)
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "audit_log" }]),
      );

      // Query audit log
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ event_type: "CONNECT", user: "root" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_security_audit");
      const result = (await tool?.handler(
        { limit: 10, user: "root" },
        mockContext,
      )) as any;

      expect(result.source).toBe("mysql.audit_log");
      expect(result.events).toHaveLength(1);
      const queryArgs = mockAdapter.executeQuery.mock.calls[1][1] as any[];
      expect(queryArgs).toContain("%root%");
    });

    it("should filter by start time", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "audit_log" }]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_security_audit");
      await tool?.handler({ startTime: "2023-01-01" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(call).toContain("timestamp >= ?");
    });

    it("should filter by event type and start time in main audit log", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "audit_log" }]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_security_audit");
      await tool?.handler(
        { eventType: "CONNECT", startTime: "2023-01-01" },
        mockContext,
      );

      const callArgs = mockAdapter.executeQuery.mock.calls[1];
      const query = callArgs[0] as string;
      const params = callArgs[1] as any[];

      expect(query).toContain("event_type = ?");
      expect(query).toContain("timestamp >= ?");
      expect(params).toContain("CONNECT");
      expect(params).toContain("2023-01-01");
    });

    it("should handle audit log unavailable", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Connect error"));

      const tool = tools.find((t) => t.name === "mysql_security_audit");
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connect error");
    });
  });

  describe("mysql_security_firewall_rules", () => {
    it("should list firewall rules", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { USERHOST: "root@localhost", MODE: "RECORDING" },
        ]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { USERHOST: "root@localhost", RULE: "SELECT * FROM users" },
        ]),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_firewall_rules",
      );
      const result = (await tool?.handler(
        { user: "root" },
        mockContext,
      )) as any;

      expect(result.userCount).toBe(1);
      expect(result.ruleCount).toBe(1);
      expect(result.rules[0].RULE).toBe("SELECT * FROM users");
    });

    it("should filter by mode", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find(
        (t) => t.name === "mysql_security_firewall_rules",
      );
      await tool?.handler({ mode: "PROTECTING" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("MODE = ?");
    });

    it("should handle firewall tables access error", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Access denied"));

      const tool = tools.find(
        (t) => t.name === "mysql_security_firewall_rules",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.available).toBe(false);
    });
  });

  describe("mysql_security_firewall_status", () => {
    it("should return installed status if plugin found", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { PLUGIN_NAME: "mysql_firewall", PLUGIN_STATUS: "ACTIVE" },
        ]),
      );

      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "mysql_firewall_mode", Value: "ON" },
        ]),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_firewall_status",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.installed).toBe(true);
      expect(result.configuration).toHaveProperty("mysql_firewall_mode", "ON");
    });

    it("should return not installed if plugin missing", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find(
        (t) => t.name === "mysql_security_firewall_status",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.installed).toBe(false);
      expect(result.message).toContain("not installed");
    });

    it("should handle plugin check failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("DB Error"));

      const tool = tools.find(
        (t) => t.name === "mysql_security_firewall_status",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.installed).toBe(false);
      expect(result.message).toBe("Firewall plugin check failed");
    });
  });

  describe("mysql_security_mask_data", () => {
    it("should masking email", async () => {
      const tool = tools.find((t) => t.name === "mysql_security_mask_data");
      const result = (await tool?.handler(
        {
          value: "john.doe@example.com",
          type: "email",
        },
        mockContext,
      )) as any;

      expect(result.masked).toBe("j******e@example.com");
    });

    it("should mask different types correctly", async () => {
      const tool = tools.find((t) => t.name === "mysql_security_mask_data");

      // Email without @
      const resNoAt = (await tool?.handler(
        { value: "invalid-email", type: "email" },
        mockContext,
      )) as any;
      expect(resNoAt.masked).toBe("*************");

      // Phone
      const resPhone = (await tool?.handler(
        { value: "1234567890", type: "phone" },
        mockContext,
      )) as any;
      expect(resPhone.masked).toBe("******7890");

      // SSN
      const resSSN = (await tool?.handler(
        { value: "123456789", type: "ssn" },
        mockContext,
      )) as any;
      expect(resSSN.masked).toBe("***-**-6789");

      // Credit Card
      const resCC = (await tool?.handler(
        { value: "1234567812345678", type: "credit_card" },
        mockContext,
      )) as any;
      expect(resCC.masked).toBe("1234********5678");

      // Partial
      const resPartial = (await tool?.handler(
        { value: "abcdef", type: "partial", keepFirst: 2, keepLast: 2 },
        mockContext,
      )) as any;
      expect(resPartial.masked).toBe("ab**ef");

      // Default fallback
      // We need to force a type that falls through or just check specific logic
      // Since we can't pass invalid enum via Zod, we trust the switch default handles odd input if it could bypass Zod
      // But Zod prevents it. However, the switch has a default case.
      // Let's assume typescript-eslint doesn't complain about unreachable code if we force it
    });

    it("should mask credit card", async () => {
      const tool = tools.find((t) => t.name === "mysql_security_mask_data");
      const result = (await tool?.handler(
        {
          value: "1234-5678-9012-3456",
          type: "credit_card",
        },
        mockContext,
      )) as any;

      expect(result.masked).toBe("1234********3456");
    });

    it("should fully mask short credit card values with warning", async () => {
      const tool = tools.find((t) => t.name === "mysql_security_mask_data");
      const result = (await tool?.handler(
        { value: "123", type: "credit_card" },
        mockContext,
      )) as any;

      expect(result.original).toBe("123");
      expect(result.masked).toBe("***");
      expect(result.type).toBe("credit_card");
      expect(result.warning).toContain("too short");
    });

    it("should fully mask 8-digit credit card values with warning", async () => {
      const tool = tools.find((t) => t.name === "mysql_security_mask_data");
      const result = (await tool?.handler(
        { value: "12345678", type: "credit_card" },
        mockContext,
      )) as any;

      expect(result.original).toBe("12345678");
      expect(result.masked).toBe("********");
      expect(result.type).toBe("credit_card");
      expect(result.warning).toContain("too short");
    });

    it("should return warning when partial masking is ineffective", async () => {
      const tool = tools.find((t) => t.name === "mysql_security_mask_data");
      const result = (await tool?.handler(
        { value: "AB", type: "partial", keepFirst: 5, keepLast: 5 },
        mockContext,
      )) as any;

      expect(result.original).toBe("AB");
      expect(result.masked).toBe("AB");
      expect(result.type).toBe("partial");
      expect(result.warning).toContain("Masking ineffective");
    });

    it("should return warning for empty string partial masking", async () => {
      const tool = tools.find((t) => t.name === "mysql_security_mask_data");
      const result = (await tool?.handler(
        { value: "", type: "partial", keepFirst: 0, keepLast: 0 },
        mockContext,
      )) as any;

      expect(result.original).toBe("");
      expect(result.masked).toBe("");
      expect(result.type).toBe("partial");
      expect(result.warning).toContain("Masking ineffective");
    });
  });

  describe("mysql_security_password_validate", () => {
    it("should return password strength", async () => {
      // Variables (checked first to detect component)
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "validate_password.policy", Value: "STRONG" },
        ]),
      );
      // VALIDATE_PASSWORD_STRENGTH
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ strength: 100 }]),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_password_validate",
      );
      const result = (await tool?.handler(
        { password: "StrongPassword123!" },
        mockContext,
      )) as any;

      expect(result.strength).toBe(100);
      expect(result.interpretation).toBe("Very Strong");
      expect(result.policy).toHaveProperty(
        "validate_password.policy",
        "STRONG",
      );
    });

    it("should handle different password strengths", async () => {
      const tool = tools.find(
        (t) => t.name === "mysql_security_password_validate",
      );

      // Strong
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "validate_password.policy", Value: "MEDIUM" },
        ]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ strength: 75 }]),
      );
      const resultStrong = (await tool?.handler(
        { password: "Strong1" },
        mockContext,
      )) as any;
      expect(resultStrong.interpretation).toBe("Strong");

      // Medium
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "validate_password.policy", Value: "MEDIUM" },
        ]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ strength: 50 }]),
      );
      const resultMedium = (await tool?.handler(
        { password: "Medium1" },
        mockContext,
      )) as any;
      expect(resultMedium.interpretation).toBe("Medium");

      // Weak
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "validate_password.policy", Value: "MEDIUM" },
        ]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ strength: 25 }]),
      );
      const resultWeak = (await tool?.handler(
        { password: "Weak1" },
        mockContext,
      )) as any;
      expect(resultWeak.interpretation).toBe("Weak");

      // Very Weak
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "validate_password.policy", Value: "MEDIUM" },
        ]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ strength: 0 }]),
      );
      const resultVeryWeak = (await tool?.handler(
        { password: "VeryWeak" },
        mockContext,
      )) as any;
      expect(resultVeryWeak.interpretation).toBe("Very Weak");
    });

    it("should detect component not installed when no policy variables exist", async () => {
      // Empty policy variables = component not installed
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find(
        (t) => t.name === "mysql_security_password_validate",
      );
      const result = (await tool?.handler(
        { password: "test" },
        mockContext,
      )) as any;

      expect(result.available).toBe(false);
      expect(result.message).toContain("not installed");
    });

    it("should handle validation function error", async () => {
      // Policy check passes (component installed)
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "validate_password.policy", Value: "MEDIUM" },
        ]),
      );
      // But function call fails
      mockAdapter.executeQuery.mockRejectedValue(new Error("Function error"));

      const tool = tools.find(
        (t) => t.name === "mysql_security_password_validate",
      );
      const result = (await tool?.handler(
        { password: "test" },
        mockContext,
      )) as any;

      expect(result.available).toBe(false);
      expect(result.message).toContain("failed");
    });
  });

  describe("mysql_security_ssl_status", () => {
    it("should return ssl status", async () => {
      // Status
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "Ssl_cipher", Value: "AES256-SHA" },
          { Variable_name: "Ssl_version", Value: "TLSv1.3" },
        ]),
      );
      // Variables
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ Variable_name: "ssl_ca", Value: "ca.pem" }]),
      );
      // Connection
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ cipher: "AES256-SHA", verifyCert: 1 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_security_ssl_status");
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.sslEnabled).toBe(true);
      expect(result.currentCipher).toBe("AES256-SHA");
      expect(result.configuration.sslCa).toBe("ca.pem");
    });

    it("should handle undefined values gracefully", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_security_ssl_status");
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.sslEnabled).toBe(false);
      expect(result.currentCipher).toBe("None");
    });
  });

  describe("mysql_security_user_privileges", () => {
    it("should return comprehensive user report", async () => {
      // mysql.user
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            User: "root",
            Host: "localhost",
            plugin: "caching_sha2_password",
            account_locked: "N",
          },
        ]),
      );
      // SHOW GRANTS
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            "Grants for root@localhost":
              "GRANT ALL PRIVILEGES ON *.* TO `root`@`localhost`",
          },
        ]),
      );
      // Role edges
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find(
        (t) => t.name === "mysql_security_user_privileges",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.count).toBe(1);
      expect(result.users[0].user).toBe("root");
      expect(result.users[0].grants).toHaveLength(1);
    });

    it("should include roles if requested", async () => {
      // P154: User existence pre-check
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ User: "root" }]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ User: "root", Host: "localhost" }]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ Grants: "GRANT..." }]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ FROM_USER: "app_role", FROM_HOST: "%" }]),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_user_privileges",
      );
      const result = (await tool?.handler(
        { user: "root", includeRoles: true },
        mockContext,
      )) as any;

      expect(result.users[0].roles).toContain("app_role@%");
    });

    it("should filter by specific host", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find(
        (t) => t.name === "mysql_security_user_privileges",
      );
      await tool?.handler({ host: "127.0.0.1" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("Host = ?");
    });

    it("should return condensed summary when summary=true", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            User: "root",
            Host: "localhost",
            plugin: "caching_sha2_password",
            account_locked: "N",
          },
        ]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            "Grants for root@localhost":
              "GRANT ALL PRIVILEGES ON *.* TO `root`@`localhost` WITH GRANT OPTION",
          },
        ]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ FROM_USER: "dba_role", FROM_HOST: "%" }]),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_user_privileges",
      );
      const result = (await tool?.handler(
        { summary: true },
        mockContext,
      )) as any;

      expect(result.summary).toBe(true);
      expect(result.users[0].grantCount).toBe(1);
      expect(result.users[0].roleCount).toBe(1);
      expect(result.users[0].hasAllPrivileges).toBe(true);
      expect(result.users[0].hasWithGrantOption).toBe(true);
      expect(result.users[0].grants).toBeUndefined();
      expect(result.users[0].roles).toBeUndefined();
    });

    it("should return exists:false for nonexistent user (P154)", async () => {
      // P154 pre-check returns empty
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find(
        (t) => t.name === "mysql_security_user_privileges",
      );
      const result = (await tool?.handler(
        { user: "nonexistent_user" },
        mockContext,
      )) as any;

      expect(result.exists).toBe(false);
      expect(result.user).toBe("nonexistent_user");
      expect(result.users).toBeUndefined();
    });
  });

  describe("mysql_security_sensitive_tables", () => {
    it("should find sensitive columns based on patterns", async () => {
      // P154: Schema existence pre-check
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "test" }]),
      );
      // COLUMNS query
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            tableName: "users",
            columnName: "password_hash",
            dataType: "varchar",
          },
          { tableName: "users", columnName: "email", dataType: "varchar" },
        ]),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_sensitive_tables",
      );
      const result = (await tool?.handler(
        { schema: "test" },
        mockContext,
      )) as any;

      expect(result.tableCount).toBe(1);
      expect(result.sensitiveTables[0].table).toBe("users");
      expect(result.sensitiveTables[0].sensitiveColumns).toHaveLength(2);
    });

    it("should return exists:false for nonexistent schema (P154)", async () => {
      // P154 pre-check returns empty
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find(
        (t) => t.name === "mysql_security_sensitive_tables",
      );
      const result = (await tool?.handler(
        { schema: "nonexistent_schema" },
        mockContext,
      )) as any;

      expect(result.exists).toBe(false);
      expect(result.schema).toBe("nonexistent_schema");
      expect(result.sensitiveTables).toBeUndefined();
    });
  });

  describe("mysql_security_encryption_status", () => {
    it("should return encryption status", async () => {
      // Keyring
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { PLUGIN_NAME: "keyring_file", PLUGIN_STATUS: "ACTIVE" },
        ]),
      );
      // Tablespaces
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ NAME: "mysql", ENCRYPTION: "Y" }]),
      );
      // Variables
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "innodb_encryption_threads", Value: "4" },
        ]),
      );
      // InnoDB Vars
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "innodb_redo_log_encrypt", Value: "ON" },
        ]),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_encryption_status",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.keyringInstalled).toBe(true);
      expect(result.encryptedTablespaceCount).toBe(1);
      expect(result.encryptionSettings.innodb_redo_log_encrypt).toBe("ON");
    });

    it("should handle missing keyring", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find(
        (t) => t.name === "mysql_security_encryption_status",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.keyringInstalled).toBe(false);
      expect(result.tdeAvailable).toBe(false);
    });
  });

  describe("mysql_security_ssl_status (Edge Cases)", () => {
    it("should handle partial data in ssl status", async () => {
      // Status with some missing/malformed rows
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "Ssl_cipher", Value: "AES256-SHA" },
          { Variable_name: 123, Value: "invalid" }, // Invalid variable name
        ]),
      );
      // Variables (undefined rows)
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: undefined,
      } as any);
      // Connection
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_security_ssl_status");
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.sslEnabled).toBe(true);
      expect(result.configuration.sslCa).toBe("");
      expect(result.serverCertVerification).toBe(false);
    });
  });

  describe("mysql_security_encryption_status (Edge Cases)", () => {
    it("should handle partial data in encryption status", async () => {
      // Keyring
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: undefined,
      } as any);
      // Tablespaces
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: undefined,
      } as any);
      // Variables with invalid names
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ Variable_name: 123, Value: "invalid" }]),
      );
      // InnoDB Vars with invalid names
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ Variable_name: 123, Value: "invalid" }]),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_encryption_status",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.keyringInstalled).toBe(false);
      expect(result.encryptedTablespaceCount).toBe(0);
      expect(result.encryptionSettings).toEqual({ "": "invalid" });
    });
  });

  describe("Error handling (try/catch wrapping)", () => {
    it("mysql_security_ssl_status should return structured error on query failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Access denied"));

      const tool = tools.find((t) => t.name === "mysql_security_ssl_status");
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Access denied");
    });

    it("mysql_security_encryption_status should return structured error on query failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Query failed: Execute failed: Access denied"),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_encryption_status",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Access denied");
    });

    it("mysql_security_user_privileges should return structured error on query failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Query failed: Access denied to mysql.user"),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_user_privileges",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Access denied to mysql.user");
    });

    it("mysql_security_sensitive_tables should return structured error on query failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Execute failed: Connection lost"),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_security_sensitive_tables",
      );
      const result = (await tool?.handler({}, mockContext)) as any;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection lost");
    });

    it("mysql_security_user_privileges should use backtick-quoted identifiers in SHOW GRANTS", async () => {
      // Setup: one user returned
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            User: "test_user",
            Host: "localhost",
            plugin: "caching_sha2_password",
            account_locked: "N",
          },
        ]),
      );
      // SHOW GRANTS
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            "Grants for test_user@localhost":
              "GRANT USAGE ON *.* TO `test_user`@`localhost`",
          },
        ]),
      );
      // Role edges
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find(
        (t) => t.name === "mysql_security_user_privileges",
      );
      await tool?.handler({}, mockContext);

      // The SHOW GRANTS call is the second call (index 1)
      const grantsCall = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(grantsCall).toContain("`test_user`@`localhost`");
      expect(grantsCall).not.toContain("'test_user'@'localhost'");
    });
  });
});
