import { createSlowQueriesTool } from './src/adapters/mysql/tools/performance/analysis/slow-queries.ts';
import { createQueryStatsTool } from './src/adapters/mysql/tools/performance/analysis/query-stats.ts';

async function run() {
  const adapter = {
    executeReadQuery: async (sql) => {
      console.log("SQL:", sql);
      return { rows: [{ 'avg_time_ms': 100, 'total_time_ms': 500, 'max_time_ms': 200, 'DIGEST_TEXT': 'SELECT 1' }] };
    }
  } as any;

  const slowTool = createSlowQueriesTool(adapter);
  const statsTool = createQueryStatsTool(adapter);

  console.log('--- Valid mysql_slow_queries ---');
  let res1 = await slowTool.handler({ limit: 5 }, {} as any);
  console.log(JSON.stringify(res1, null, 2));

  console.log('--- Valid mysql_query_stats ---');
  let res2 = await statsTool.handler({ limit: 5, orderBy: "executions" }, {} as any);
  console.log(JSON.stringify(res2, null, 2));
}

run().catch(console.error);
