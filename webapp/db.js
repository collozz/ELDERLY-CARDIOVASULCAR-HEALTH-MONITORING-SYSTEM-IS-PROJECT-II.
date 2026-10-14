// Database connection

const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  ...config.DB,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true,
});

// Run a query
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function log(userId, action, details = null) {
  if (!userId) return;
  await query('INSERT INTO tbl_activity_log (user_id, action, details) VALUES (?, ?, ?)', [userId, action, details]);
}

module.exports = { pool, query, one, log };
