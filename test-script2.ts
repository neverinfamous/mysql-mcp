import { createAuditRestoreBackupTool } from "./src/adapters/mysql/tools/admin/audit-backup.ts";

async function run() {
  const mockAdapter: any = {
    getBackupManager: () => ({
      getSnapshot: async (f: string) => null
    })
  };

  const restoreTool = createAuditRestoreBackupTool(mockAdapter);

  console.log("Testing restore backups with invalid filename:");
  const res3 = await restoreTool.handler({ filename: "users" }, {} as any);
  console.log(JSON.stringify(res3, null, 2));
}

run().catch(console.error);
