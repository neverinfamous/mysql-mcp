import { createDetectQueryAnomaliesTool, createDetectBloatRiskTool } from './src/adapters/mysql/tools/performance/anomaly-detection.ts';

const mockAdapter = {
  executeQuery: async (sql, params) => {
    // just return empty rows for tests
    return { rows: [] };
  }
} as any;

async function run() {
  const anomaliesTool = createDetectQueryAnomaliesTool(mockAdapter);
  const bloatTool = createDetectBloatRiskTool(mockAdapter);

  console.log('--- Fuzzing mysql_detect_query_anomalies ---');
  try {
    let res = await anomaliesTool.handler({ query: "SELECT * FROM users" }, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Error crashed:", e);
  }

  console.log('--- Fuzzing mysql_detect_bloat_risk ---');
  try {
    let res = await bloatTool.handler({ query: "SELECT * FROM my_table" }, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Error crashed:", e);
  }
}

run().catch(console.error);
