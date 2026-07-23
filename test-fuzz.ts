import { createReplicationStatusTool } from './src/adapters/mysql/tools/admin/monitoring/replication.js';
import { createPoolStatsTool } from './src/adapters/mysql/tools/admin/monitoring/pool-stats.js';

// mock adapter
const mockAdapter = {
  executeQuery: async () => ({ rows: [] }),
  getPoolStats: async () => ({
    totalConnections: 1,
    activeConnections: 0,
    idleConnections: 1,
    pendingAcquires: 0,
    waitingClients: 0
  })
} as any;

const repTool = createReplicationStatusTool(mockAdapter);
const poolTool = createPoolStatsTool(mockAdapter);

async function run() {
  try {
    console.log('--- Fuzzing Replication Status ---');
    let res = await repTool.handler({ unknown_param: "test" }, {} as any);
    console.log(JSON.stringify(res, null, 2));

    res = await repTool.handler({ summary: "not_a_boolean" }, {} as any);
    console.log(JSON.stringify(res, null, 2));

    console.log('--- Fuzzing Pool Stats ---');
    res = await poolTool.handler({ unknown_param: "test" }, {} as any);
    console.log(JSON.stringify(res, null, 2));

    res = await poolTool.handler({ summary: "not_a_boolean" }, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}

run().catch(console.error);
