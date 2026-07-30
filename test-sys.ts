import { MySQLAdapter } from './src/adapters/mysql/mysql-adapter/index.js';
import { createSysSchemaResource } from './src/adapters/mysql/resources/sysschema.js';

const config = {
  host: '127.0.0.1',
  port: 6033, // ProxySQL
  username: 'root',
  password: 'password',
  database: 'testdb'
};

async function test() {
  const adapter = new MySQLAdapter();
  await adapter.connect(config);
  console.log('Connected');
  
  try {
    const sys = createSysSchemaResource(adapter);
    const result = await sys.handler('mysql://sysschema', {} as any);
    console.log('SysSchema result:', JSON.stringify(result).substring(0, 100));
  } catch (e: any) {
    console.error('SysSchema error:', e.message);
  }

  await adapter.disconnect();
}
test();
