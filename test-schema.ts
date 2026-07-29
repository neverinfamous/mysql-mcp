import { ProxySQLStatusInputSchema } from './src/adapters/mysql/schemas/proxysql.js';
console.log(ProxySQLStatusInputSchema.parse({ database: 'test', summary: 'yes' }));
