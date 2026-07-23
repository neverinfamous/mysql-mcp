import { zodToJsonSchema } from 'zod-to-json-schema';
import { ReplicationStatusSchema } from './src/adapters/mysql/schemas/admin.js';
import { PoolStatsSchema } from './src/adapters/mysql/schemas/admin.js';

console.log('Replication:', JSON.stringify(zodToJsonSchema(ReplicationStatusSchema), null, 2));
console.log('PoolStats:', JSON.stringify(zodToJsonSchema(PoolStatsSchema), null, 2));
