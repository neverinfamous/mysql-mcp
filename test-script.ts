import { createAuditListBackupsTool, createAuditRestoreBackupTool } from "./src/adapters/mysql/tools/admin/audit-backup.ts";
import { ZodError } from "zod";

async function run() {
  const mockAdapter: any = {
    getBackupManager: () => ({
      listSnapshots: async () => [{ target: "users", filename: "test.gz" }],
      getSnapshot: async (f: string) => f === "test.gz" ? { ddl: "CREATE TABLE", metadata: { target: "users" } } : null
    }),
    executeWriteQuery: async (q: string) => console.log("executed", q)
  };

  const listTool = createAuditListBackupsTool(mockAdapter);
  const restoreTool = createAuditRestoreBackupTool(mockAdapter);

  console.log("Testing list backups with limit hallucination:");
  const res1 = await listTool.handler({ limit: "2" }, {} as any);
  console.log(JSON.stringify(res1, null, 2));

  console.log("Testing list backups with alias:");
  const res2 = await listTool.handler({ table: "users" }, {} as any);
  console.log(JSON.stringify(res2, null, 2));

  console.log("Testing restore backups with alias hallucination:");
  const res3 = await restoreTool.handler({ backup: "test.gz" }, {} as any);
  console.log(JSON.stringify(res3, null, 2));
}

run().catch(console.error);
