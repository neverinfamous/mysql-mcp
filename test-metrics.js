import { metrics } from './dist/observability/metrics.js';
metrics.recordToolCall('mysql_list_tables', 100, true, 42, undefined);
console.log(metrics.toPrometheus());
