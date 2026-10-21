// Runs the SQL files in this folder against MySQL: `npm run db:init`
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Run in this order: tables first, then the tax reference data.
const SQL_FILES = ['schema.sql', 'seed_tax_rules.sql'];

async function main() {
  // No `database` option here: schema.sql creates the database itself.
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true, // allow a whole .sql file in one query
  });

  for (const file of SQL_FILES) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    await conn.query(sql);
    console.log(`Ran ${file}`);
  }

  await conn.end();
}

main().catch((err) => {
  console.error('Database init failed:', err.message);
  process.exit(1);
});
