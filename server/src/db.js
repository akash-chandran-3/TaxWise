// One shared MySQL connection pool for the whole app.
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  decimalNumbers: true, // return DECIMAL columns as JS numbers, not strings
  dateStrings: true, // return DATE columns as 'YYYY-MM-DD', avoiding timezone shifts
});

module.exports = pool;
