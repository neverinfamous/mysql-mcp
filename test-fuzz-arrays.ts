import { TransactionIdSchema, TransactionSavepointSchema } from "./src/adapters/mysql/schemas/transactions.ts";

try {
  console.log(TransactionIdSchema.parse({ transaction_id: ["test-123"] }));
} catch (e: any) {
  console.log("Array txid error:", e.message);
}

try {
  console.log(TransactionSavepointSchema.parse({ transactionId: "valid", savepoint: ["invalid"] }));
} catch (e: any) {
  console.log("Array savepoint error:", e.message);
}
