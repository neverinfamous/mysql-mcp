import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: 'root',
    database: 'testdb'
  });
  
  const [rows] = await connection.query(`SHOW FULL COLUMNS FROM test_vectors`);
  console.log(JSON.stringify(rows, null, 2));
  await connection.end();
}

run().catch(console.error);
