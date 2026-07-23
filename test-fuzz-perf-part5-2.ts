import { createDetectBloatRiskTool } from './src/adapters/mysql/tools/performance/anomaly-detection.ts';
import { createDetectQueryAnomaliesTool } from './src/adapters/mysql/tools/performance/anomaly-detection.ts';

const mockAdapter = {
  executeQuery: async (sql, params) => {
    return { rows: [] };
  }
} as any;

async function run() {
  const bloatTool = createDetectBloatRiskTool(mockAdapter);

  console.log('--- Fuzzing mysql_detect_bloat_risk invalid schema ---');
  try {
    let res = await bloatTool.handler({ schema: "invalid!@#$" }, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Error crashed:", e);
  }

  console.log('--- Fuzzing mysql_detect_bloat_risk missing table ---');
  try {
    let res = await bloatTool.handler({ table: "missing_table" }, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Error crashed:", e);
  }
}

run().catch(console.error);
