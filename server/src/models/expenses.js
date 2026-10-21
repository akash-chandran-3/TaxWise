// SQL for the expenses table. Every query includes `user_id = ?`, so a user
// can only ever see or change their own rows.
const db = require('../db');
const { monthRange } = require('../validation');

const COLUMNS = 'id, amount, category, expense_date AS date, note';

// All of a user's expenses, or just one month's if `month` ('YYYY-MM') is given.
async function listExpenses(userId, month) {
  if (!month) {
    const [rows] = await db.execute(
      `SELECT ${COLUMNS} FROM expenses WHERE user_id = ? ORDER BY expense_date DESC, id DESC`,
      [userId]
    );
    return rows;
  }

  // A date range (not MONTH(expense_date) = ...) lets MySQL use the
  // (user_id, expense_date) index instead of checking every row.
  const { start, end } = monthRange(month);
  const [rows] = await db.execute(
    `SELECT ${COLUMNS} FROM expenses
      WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
      ORDER BY expense_date DESC, id DESC`,
    [userId, start, end]
  );
  return rows;
}

async function getExpense(userId, id) {
  const [rows] = await db.execute(
    `SELECT ${COLUMNS} FROM expenses WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return rows[0] || null;
}

async function createExpense(userId, expense) {
  const [result] = await db.execute(
    'INSERT INTO expenses (user_id, amount, category, expense_date, note) VALUES (?, ?, ?, ?, ?)',
    [userId, expense.amount, expense.category, expense.date, expense.note]
  );
  return getExpense(userId, result.insertId);
}

// Returns the updated expense, or null if it doesn't exist / isn't this user's.
async function updateExpense(userId, id, expense) {
  const [result] = await db.execute(
    `UPDATE expenses SET amount = ?, category = ?, expense_date = ?, note = ?
      WHERE id = ? AND user_id = ?`,
    [expense.amount, expense.category, expense.date, expense.note, id, userId]
  );
  return result.affectedRows === 0 ? null : getExpense(userId, id);
}

// Returns true if a row was deleted.
async function deleteExpense(userId, id) {
  const [result] = await db.execute('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

// Total spent per category in one month. GROUP BY collapses all rows of the
// same category into one row; SUM and COUNT run over each group.
async function monthlySummary(userId, month) {
  const { start, end } = monthRange(month);
  const [rows] = await db.execute(
    `SELECT category, SUM(amount) AS total, COUNT(*) AS count
       FROM expenses
      WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
      GROUP BY category
      ORDER BY total DESC`,
    [userId, start, end]
  );
  return rows;
}

module.exports = { listExpenses, getExpense, createExpense, updateExpense, deleteExpense, monthlySummary };
