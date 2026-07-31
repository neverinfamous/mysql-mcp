import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: 'root',
    database: 'testdb'
  });
  
  await connection.query('CREATE TABLE test_vectors_v2 (id INT PRIMARY KEY, vec VECTOR(3), vec2 VECTOR(3), txt VARCHAR(255))');
  console.log('Table created');
  await connection.end();
}

run().catch(console.error);
