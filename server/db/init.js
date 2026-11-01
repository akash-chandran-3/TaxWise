// Runs the SQL files in this folder against MySQL: `npm run db:init`
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { connectionOptions } = require('../src/dbConfig');

// Run in this order: tables first, then the tax reference data.
const SQL_FILES = ['schema.sql', 'seed_tax_rules.sql'];

async function main() {
  // No `database` option here: schema.sql creates the database itself.
  const conn = await mysql.createConnection({
    ...connectionOptions(),
    multipleStatements: true, // allow a whole .sql file in one query
  });
  console.log(`Connected to ${process.env.DB_HOST}`);

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
