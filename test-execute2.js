import mysql from "mysql2/promise";
async function main() {
  const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    database: "adamic_db",
  });
  try {
    const sql1 = "UPDATE test_json_docs SET doc = JSON_REMOVE(doc, '$.author') WHERE id = 1";
    console.log("EXECUTE SQL1:", sql1);
    const [res1] = await pool.execute(sql1);
    console.log("RES1:", res1);
  } catch (err) {
    console.error("SQL1 ERROR:", err);
  }
  
  try {
    const sql2 = "UPDATE test_json_docs SET doc = JSON_REMOVE(doc, 'author') WHERE id = 1";
    console.log("EXECUTE SQL2:", sql2);
    const [res2] = await pool.execute(sql2);
    console.log("RES2:", res2);
  } catch (err) {
    console.error("SQL2 ERROR:", err);
  }

  process.exit(0);
}
main();
