// CRUD for /api/expenses, plus /categories and /summary?month=YYYY-MM
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { isValidDate, isValidMonth } = require('../validation');
const expenses = require('../models/expenses');

const router = express.Router();
router.use(requireAuth);

// A fixed list keeps the pie chart readable and the data clean.
const CATEGORIES = ['Food', 'Rent', 'Transport', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Other'];
const MAX_EXPENSE = 9_999_999_999.99; // largest value DECIMAL(12,2) can hold

// Turns the request body into a clean expense, or returns an error message.
function parseExpense(body) {
  const { amount, category, date } = body;
  const note = body.note ?? '';

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > MAX_EXPENSE) {
    return { error: 'Amount must be a number greater than 0' };
  }
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return { error: 'Amount can have at most 2 decimal places' };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: `Category must be one of: ${CATEGORIES.join(', ')}` };
  }
  if (!isValidDate(date)) {
    return { error: 'Date must be a real date in YYYY-MM-DD format' };
  }
  if (typeof note !== 'string' || note.trim().length > 255) {
    return { error: 'Note must be text of at most 255 characters' };
  }

  return { expense: { amount, category, date, note: note.trim() || null } };
}

// Route ids come in as strings; only accept positive whole numbers.
function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/categories', (req, res) => {
  res.json({ categories: CATEGORIES });
});

router.get('/summary', async (req, res) => {
  const { month } = req.query;
  if (!isValidMonth(month)) {
    return res.status(400).json({ error: 'Query parameter month is required, e.g. ?month=2026-10' });
  }
  const byCategory = await expenses.monthlySummary(req.userId, month);
  const total = byCategory.reduce((sum, row) => sum + row.total, 0);
  res.json({ month, total: Math.round(total * 100) / 100, byCategory });
});

router.get('/', async (req, res) => {
  const { month } = req.query;
  if (month !== undefined && !isValidMonth(month)) {
    return res.status(400).json({ error: 'month must look like 2026-10' });
  }
  res.json({ expenses: await expenses.listExpenses(req.userId, month) });
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Expense id must be a positive whole number' });

  const expense = await expenses.getExpense(req.userId, id);
  // 404 (not 403) for other users' expenses, so we don't reveal that the id exists.
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  res.json({ expense });
});

router.post('/', async (req, res) => {
  const { expense, error } = parseExpense(req.body || {});
  if (error) return res.status(400).json({ error });
  res.status(201).json({ expense: await expenses.createExpense(req.userId, expense) });
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Expense id must be a positive whole number' });

  const { expense, error } = parseExpense(req.body || {});
  if (error) return res.status(400).json({ error });

  const updated = await expenses.updateExpense(req.userId, id, expense);
  if (!updated) return res.status(404).json({ error: 'Expense not found' });
  res.json({ expense: updated });
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Expense id must be a positive whole number' });

  const deleted = await expenses.deleteExpense(req.userId, id);
  if (!deleted) return res.status(404).json({ error: 'Expense not found' });
  res.status(204).end();
});

module.exports = router;
