import mysql from "mysql2/promise";

async function main() {
  const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "password",
    database: "mcp_test",
    port: 3306,
  });

  try {
    const sql = "UPDATE `test_json_docs` SET `metadata` = JSON_INSERT(`metadata`, ?, CAST(? AS JSON)) WHERE id = 1";
    console.log("Running pool.query...");
    const [results] = await pool.query(sql, ["$.test5", "\"test\""]);
    console.log("pool.query SUCCESS:", results);
  } catch (err) {
    console.error("pool.query FAILED:", err);
  }

  try {
    const sql = "SELECT SUM(JSON_CONTAINS_PATH(`metadata`, 'one', ?)) FROM test_json_docs WHERE id = 1";
    console.log("Running pool.query checkSql...");
    const [results] = await pool.query(sql, ["$.test5"]);
    console.log("pool.query checkSql SUCCESS:", results);
  } catch (err) {
    console.error("pool.query checkSql FAILED:", err);
  }

  pool.end();
}

main();
