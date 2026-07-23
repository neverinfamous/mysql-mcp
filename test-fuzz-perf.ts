import { createSlowQueriesTool } from './src/adapters/mysql/tools/performance/analysis/slow-queries.ts';
import { createQueryStatsTool } from './src/adapters/mysql/tools/performance/analysis/query-stats.ts';

const mockAdapter = {
  executeQuery: async (sql) => {
    return { rows: [] };
  }
} as any;

async function run() {
  const slowTool = createSlowQueriesTool(mockAdapter);
  const statsTool = createQueryStatsTool(mockAdapter);

  console.log('--- Fuzzing mysql_slow_queries ---');
  try {
    let res = await slowTool.handler({ limit: 150 }, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Error:", e.message);
  }
  
  try {
    let res = await slowTool.handler({ minTime: -5 }, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Error:", e.message);
  }

  console.log('--- Fuzzing mysql_query_stats ---');
  try {
    let res = await statsTool.handler({ limit: 150 }, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Error:", e.message);
  }
}

run().catch(console.error);
