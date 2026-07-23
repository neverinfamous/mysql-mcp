import { createDetectBloatRiskTool } from './src/adapters/mysql/tools/performance/anomaly-detection.ts';
import { createDetectQueryAnomaliesTool } from './src/adapters/mysql/tools/performance/anomaly-detection.ts';

const mockAdapter = {
  executeQuery: async (sql, params) => {
    if (sql.includes('performance_schema.events_statements_summary_by_digest LIMIT 1')) {
        return { rows: [{ '1': 1 }] };
    }
    if (sql.includes('COUNT(*)')) {
        return { rows: [{ total: 100 }] };
    }
    if (sql.includes('events_statements_summary_by_digest')) {
        return { rows: [{
            query_preview: 'SELECT 1',
            db_schema: 'test',
            calls: 100,
            avg_exec_time_ms: 10,
            max_exec_time_ms: 200,
            variance_ratio: 20,
            total_exec_time_ms: 1000
        }] };
    }
    
    if (sql.includes('TABLE_NAME FROM information_schema.TABLES')) {
        return { rows: [{ TABLE_NAME: 'test_table' }] };
    }
    
    if (sql.includes('information_schema.TABLES')) {
        return { rows: [{
            db_schema: 'test',
            table_name: 'test_table',
            engine: 'InnoDB',
            row_count: 1000,
            data_bytes: 1024,
            index_bytes: 1024,
            free_bytes: 1024,
            total_used_bytes: 2048,
            fragmentation_pct: 33.3
        }] };
    }
    return { rows: [] };
  }
} as any;

async function run() {
  const anomaliesTool = createDetectQueryAnomaliesTool(mockAdapter);
  const bloatTool = createDetectBloatRiskTool(mockAdapter);

  console.log('--- Fuzzing mysql_detect_query_anomalies VALID ---');
  try {
    let res = await anomaliesTool.handler({}, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Error crashed:", e);
  }

  console.log('--- Fuzzing mysql_detect_bloat_risk VALID ---');
  try {
    let res = await bloatTool.handler({}, {} as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Error crashed:", e);
  }
}

run().catch(console.error);
