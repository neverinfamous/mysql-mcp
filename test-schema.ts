import { ProxySQLHostgroupInputSchema } from './src/adapters/mysql/schemas/proxysql.js';
try {
  console.log(ProxySQLHostgroupInputSchema.parse({ hostgroup_id: '1' }));
} catch (e) {
  console.log(e.toString());
}
