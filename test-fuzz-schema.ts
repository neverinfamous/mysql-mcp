import { TransactionIdSchema, TransactionSavepointSchema } from "./src/adapters/mysql/schemas/transactions.ts";

try {
  console.log(TransactionIdSchema.parse({ transaction_id: "test-123" }));
} catch (e: any) {
  console.log("TransactionIdSchema Error:", e.errors);
}

try {
  console.log(TransactionSavepointSchema.parse({ transaction_id: "test-123", savepoint_name: "sp1" }));
} catch (e: any) {
  console.log("TransactionSavepointSchema Error:", e.errors);
}
