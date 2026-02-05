import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  createSecuritySSLStatusTool,
  createSecurityEncryptionStatusTool,
  createSecurityPasswordValidateTool,
} from "../encryption.js";
import { MySQLAdapter } from "../../../MySQLAdapter.js";

describe("Security Encryption Tools", () => {
  let mockAdapter: MySQLAdapter;
  let mockExecuteQuery: Mock;

  beforeEach(() => {
    mockExecuteQuery = vi.fn();
    mockAdapter = {
      executeQuery: mockExecuteQuery,
    } as unknown as MySQLAdapter;
  });

  describe("mysql_security_ssl_status", () => {
    it("should report SSL status correctly when enabled", async () => {
      const tool = createSecuritySSLStatusTool(mockAdapter);
      mockExecuteQuery
        // SHOW STATUS LIKE 'Ssl%'
        .mockResolvedValueOnce({
          rows: [
            { Variable_name: "Ssl_cipher", Value: "AES256-SHA" },
            { Variable_name: "Ssl_version", Value: "TLSv1.3" },
            { Variable_name: "Ssl_accepts", Value: "10" },
            { Variable_name: "Ssl_finished_accepts", Value: "10" },
          ],
        })
        // SHOW VARIABLES LIKE '%ssl%'
        .mockResolvedValueOnce({
          rows: [
            { Variable_name: "ssl_ca", Value: "ca.pem" },
            { Variable_name: "ssl_cert", Value: "cert.pem" },
            { Variable_name: "ssl_key", Value: "key.pem" },
            { Variable_name: "require_secure_transport", Value: "ON" },
          ],
        })
        // Connection status
        .mockResolvedValueOnce({
          rows: [{ cipher: "AES256-SHA" }],
        });

      const result = (await tool.handler({}, {} as any)) as any;

      expect(result).toEqual({
        sslEnabled: true,
        currentCipher: "AES256-SHA",
        sslVersion: "TLSv1.3",
        serverCertVerification: false, // Updated expectation
        configuration: {
          sslCa: "ca.pem",
          sslCert: "cert.pem",
          sslKey: "key.pem",
          requireSecureTransport: "ON",
        },
        sessionStats: {
          acceptedConnects: "10",
          finishedConnects: "10",
        },
      });
    });

    it("should handle missing SSL information", async () => {
      const tool = createSecuritySSLStatusTool(mockAdapter);
      mockExecuteQuery
        .mockResolvedValueOnce({ rows: [] }) // Status
        .mockResolvedValueOnce({ rows: [] }) // Variables
        .mockResolvedValueOnce({ rows: [] }); // Connection

      const result = (await tool.handler({}, {} as any)) as any;

      expect(result.sslEnabled).toBe(false);
      expect(result.currentCipher).toBe("None");
      expect(result.sslVersion).toBe("N/A");
    });
  });

  describe("mysql_security_encryption_status", () => {
    it("should report TDE status", async () => {
      const tool = createSecurityEncryptionStatusTool(mockAdapter);
      mockExecuteQuery
        // keyring plugins
        .mockResolvedValueOnce({
          rows: [{ PLUGIN_NAME: "keyring_file", PLUGIN_STATUS: "ACTIVE" }],
        })
        // tablespaces
        .mockResolvedValueOnce({
          rows: [{ NAME: "mysql", ENCRYPTION: "Y" }],
        })
        // variables
        .mockResolvedValueOnce({
          rows: [{ Variable_name: "default_table_encryption", Value: "ON" }],
        })
        // innodb variables
        .mockResolvedValueOnce({
          rows: [{ Variable_name: "innodb_redo_log_encrypt", Value: "ON" }],
        });

      const result = (await tool.handler({}, {} as any)) as any;

      expect(result.keyringInstalled).toBe(true);
      expect(result.tdeAvailable).toBe(true);
      expect(result.encryptedTablespaces).toHaveLength(1);
      expect(result.encryptionSettings).toMatchObject({
        default_table_encryption: "ON",
        innodb_redo_log_encrypt: "ON",
      });
    });
  });

  describe("mysql_security_password_validate", () => {
    it("should validate password strength", async () => {
      const tool = createSecurityPasswordValidateTool(mockAdapter);
      mockExecuteQuery
        // VALIDATE_PASSWORD_STRENGTH
        .mockResolvedValueOnce({
          rows: [{ strength: 100 }],
        })
        // SHOW VARIABLES
        .mockResolvedValueOnce({
          rows: [
            { Variable_name: "validate_password_policy", Value: "STRONG" },
          ],
        });

      const result = (await tool.handler(
        { password: "StrongPassword123!" },
        {} as any,
      )) as any;

      expect(result.interpretation).toBe("Very Strong");
      expect(result.meetsPolicy).toBe(true);
    });

    it("should handle weak passwords", async () => {
      const tool = createSecurityPasswordValidateTool(mockAdapter);
      mockExecuteQuery
        .mockResolvedValueOnce({
          rows: [{ strength: 20 }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = (await tool.handler(
        { password: "123" },
        {} as any,
      )) as any;

      expect(result.interpretation).toBe("Very Weak");
      expect(result.meetsPolicy).toBe(false);
    });

    it("should handle component not installed error", async () => {
      const tool = createSecurityPasswordValidateTool(mockAdapter);
      mockExecuteQuery.mockRejectedValue(new Error("Function not found"));

      const result = (await tool.handler(
        { password: "pass" },
        {} as any,
      )) as any;

      expect(result.available).toBe(false);
      expect(result.message).toContain("not installed");
    });
  });
});
