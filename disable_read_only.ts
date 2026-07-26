import mysql from "mysql2/promise";
async function run() {
  const conn = await mysql.createConnection({
    host: "192.168.55.39",
    port: 6033,
    user: "cluster_admin",
    password: "cluster_admin",
    database: "testdb"
  });
  await conn.query("SET GLOBAL super_read_only = 0");
  console.log("Done");
  await conn.end();
}
run();
