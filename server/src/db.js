// One shared MySQL connection pool for the whole app.
const mysql = require('mysql2/promise');
const { connectionOptions } = require('./dbConfig');

const pool = mysql.createPool({
  ...connectionOptions(),
  database: process.env.DB_NAME,
  connectionLimit: 10,
  decimalNumbers: true, // return DECIMAL columns as JS numbers, not strings
  dateStrings: true, // return DATE columns as 'YYYY-MM-DD', avoiding timezone shifts
});

module.exports = pool;
