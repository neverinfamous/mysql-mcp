import type { MySQLAdapter } from "./mysql-adapter.js";
import { ConnectionError, TransactionError } from "../../../types/index.js";

export class TransactionManager {
  constructor(private adapter: MySQLAdapter) {}

  async beginTransaction(isolationLevel?: string): Promise<string> {
    if (!this.adapter.pool) {
      throw new ConnectionError("Not connected");
    }

    const VALID_ISOLATION_LEVELS = [
      "READ UNCOMMITTED",
      "READ COMMITTED",
      "REPEATABLE READ",
      "SERIALIZABLE",
    ];
    if (
      isolationLevel &&
      !VALID_ISOLATION_LEVELS.includes(isolationLevel.toUpperCase())
    ) {
      throw new TransactionError(
        `Invalid isolation level: ${isolationLevel}. Must be one of: ${VALID_ISOLATION_LEVELS.join(", ")}`,
      );
    }

    const connection = await this.adapter.pool.getConnection();
    const transactionId = crypto.randomUUID();

    try {
      if (isolationLevel) {
        const [rows] = await connection.query(
          "SELECT @@SESSION.transaction_isolation AS iso",
        );
        const results = rows as { iso: string }[];
        if (results.length > 0 && results[0]) {
          const origIso = results[0].iso.replace("-", " ");
          this.adapter.origIsolationLevels.set(transactionId, origIso);
        }

        await connection.query(
          `SET SESSION TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
        );
      }
      await connection.beginTransaction();
      this.adapter.activeTransactions.set(transactionId, connection);
      return transactionId;
    } catch (error) {
      connection.release();
      throw new TransactionError(
        `Failed to begin transaction: ${String(error)}`,
      );
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const connection = this.adapter.activeTransactions.get(transactionId);
    if (!connection) {
      throw new TransactionError(`Transaction not found: ${transactionId}`);
    }

    try {
      await connection.commit();
    } finally {
      const origIso = this.adapter.origIsolationLevels.get(transactionId);
      if (origIso) {
        try {
          await connection.query(
            `SET SESSION TRANSACTION ISOLATION LEVEL ${origIso}`,
          );
        } catch {
          // Ignore reset errors
        }
        this.adapter.origIsolationLevels.delete(transactionId);
      }
      connection.release();
      this.adapter.activeTransactions.delete(transactionId);
    }
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const connection = this.adapter.activeTransactions.get(transactionId);
    if (!connection) {
      throw new TransactionError(`Transaction not found: ${transactionId}`);
    }

    try {
      await connection.rollback();
    } finally {
      const origIso = this.adapter.origIsolationLevels.get(transactionId);
      if (origIso) {
        try {
          await connection.query(
            `SET SESSION TRANSACTION ISOLATION LEVEL ${origIso}`,
          );
        } catch {
          // Ignore reset errors
        }
        this.adapter.origIsolationLevels.delete(transactionId);
      }
      connection.release();
      this.adapter.activeTransactions.delete(transactionId);
    }
  }
}
