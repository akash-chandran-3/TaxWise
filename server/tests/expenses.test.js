// Route tests for /api/expenses. The model (SQL) is mocked; these tests cover
// validation, status codes, and that every call is scoped to the token's user.
jest.mock('../src/models/expenses', () => ({
  listExpenses: jest.fn(),
  getExpense: jest.fn(),
  createExpense: jest.fn(),
  updateExpense: jest.fn(),
  deleteExpense: jest.fn(),
  monthlySummary: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const expenses = require('../src/models/expenses');
const { monthRange, isValidDate } = require('../src/validation');

const USER_ID = 9;
const auth = `Bearer ${jwt.sign({ userId: USER_ID }, 'test-secret')}`;
const validBody = { amount: 450.5, category: 'Food', date: '2026-10-05', note: ' Lunch ' };
const savedExpense = { id: 1, amount: 450.5, category: 'Food', date: '2026-10-05', note: 'Lunch' };

beforeEach(() => {
  jest.resetAllMocks();
});

describe('authentication', () => {
  test('every expense route needs a token (401)', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(401);
    expect(expenses.listExpenses).not.toHaveBeenCalled();
  });
});

describe('POST /api/expenses', () => {
  test('creates an expense (201), trimming the note', async () => {
    expenses.createExpense.mockResolvedValue(savedExpense);

    const res = await request(app).post('/api/expenses').set('Authorization', auth).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.expense).toEqual(savedExpense);
    expect(expenses.createExpense).toHaveBeenCalledWith(USER_ID, {
      amount: 450.5, category: 'Food', date: '2026-10-05', note: 'Lunch',
    });
  });

  test('stores an empty note as null', async () => {
    expenses.createExpense.mockResolvedValue(savedExpense);
    await request(app).post('/api/expenses').set('Authorization', auth).send({ ...validBody, note: '   ' });
    expect(expenses.createExpense.mock.calls[0][1].note).toBeNull();
  });

  test.each([
    ['a zero amount', { amount: 0 }],
    ['a negative amount', { amount: -10 }],
    ['an amount sent as text', { amount: '450' }],
    ['more than 2 decimal places', { amount: 10.555 }],
    ['an unknown category', { category: 'Crypto' }],
    ['an impossible date', { date: '2026-02-30' }],
    ['a date in the wrong format', { date: '05/10/2026' }],
    ['a note over 255 characters', { note: 'x'.repeat(256) }],
  ])('rejects %s (400)', async (_label, change) => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', auth)
      .send({ ...validBody, ...change });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(expenses.createExpense).not.toHaveBeenCalled();
  });
});

describe('GET /api/expenses', () => {
  test('lists one month of expenses for this user', async () => {
    expenses.listExpenses.mockResolvedValue([savedExpense]);

    const res = await request(app).get('/api/expenses?month=2026-10').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.expenses).toHaveLength(1);
    expect(expenses.listExpenses).toHaveBeenCalledWith(USER_ID, '2026-10');
  });

  test('rejects a badly formed month (400)', async () => {
    const res = await request(app).get('/api/expenses?month=2026-13').set('Authorization', auth);
    expect(res.status).toBe(400);
  });

  test('returns 404 for an expense that is missing or belongs to someone else', async () => {
    expenses.getExpense.mockResolvedValue(null);
    const res = await request(app).get('/api/expenses/42').set('Authorization', auth);
    expect(res.status).toBe(404);
    expect(expenses.getExpense).toHaveBeenCalledWith(USER_ID, 42);
  });

  test('rejects a non-numeric id (400)', async () => {
    const res = await request(app).get('/api/expenses/abc').set('Authorization', auth);
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/expenses/:id', () => {
  test('updates an expense (200)', async () => {
    expenses.updateExpense.mockResolvedValue({ ...savedExpense, amount: 500 });

    const res = await request(app)
      .put('/api/expenses/1')
      .set('Authorization', auth)
      .send({ ...validBody, amount: 500 });

    expect(res.status).toBe(200);
    expect(res.body.expense.amount).toBe(500);
    expect(expenses.updateExpense).toHaveBeenCalledWith(USER_ID, 1, expect.objectContaining({ amount: 500 }));
  });

  test('returns 404 when no row was updated', async () => {
    expenses.updateExpense.mockResolvedValue(null);
    const res = await request(app).put('/api/expenses/99').set('Authorization', auth).send(validBody);
    expect(res.status).toBe(404);
  });

  test('validates the body before touching the database (400)', async () => {
    const res = await request(app)
      .put('/api/expenses/1')
      .set('Authorization', auth)
      .send({ ...validBody, amount: -1 });
    expect(res.status).toBe(400);
    expect(expenses.updateExpense).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/expenses/:id', () => {
  test('deletes an expense (204, empty body)', async () => {
    expenses.deleteExpense.mockResolvedValue(true);
    const res = await request(app).delete('/api/expenses/1').set('Authorization', auth);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(expenses.deleteExpense).toHaveBeenCalledWith(USER_ID, 1);
  });

  test('returns 404 when nothing was deleted', async () => {
    expenses.deleteExpense.mockResolvedValue(false);
    const res = await request(app).delete('/api/expenses/1').set('Authorization', auth);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/expenses/summary', () => {
  test('returns totals per category plus a grand total', async () => {
    expenses.monthlySummary.mockResolvedValue([
      { category: 'Rent', total: 15000, count: 1 },
      { category: 'Food', total: 4200.5, count: 12 },
    ]);

    const res = await request(app).get('/api/expenses/summary?month=2026-10').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(19200.5);
    expect(res.body.byCategory).toHaveLength(2);
    expect(expenses.monthlySummary).toHaveBeenCalledWith(USER_ID, '2026-10');
  });

  test('requires the month parameter (400)', async () => {
    const res = await request(app).get('/api/expenses/summary').set('Authorization', auth);
    expect(res.status).toBe(400);
  });

  test('an empty month has a total of 0', async () => {
    expenses.monthlySummary.mockResolvedValue([]);
    const res = await request(app).get('/api/expenses/summary?month=2026-01').set('Authorization', auth);
    expect(res.body).toEqual({ month: '2026-01', total: 0, byCategory: [] });
  });
});

describe('GET /api/expenses/categories', () => {
  test('lists the allowed categories', async () => {
    const res = await request(app).get('/api/expenses/categories').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.categories).toContain('Food');
  });
});

describe('date helpers', () => {
  test('monthRange gives an exclusive end date, including across a year end', () => {
    expect(monthRange('2026-10')).toEqual({ start: '2026-10-01', end: '2026-11-01' });
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });

  test('isValidDate knows about leap years', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
  });
});
