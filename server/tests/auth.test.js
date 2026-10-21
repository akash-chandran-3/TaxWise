// Route tests for /api/auth. The database module is replaced with a Jest mock,
// so these tests run without MySQL and we control exactly what "the DB" returns.
jest.mock('../src/db', () => ({ execute: jest.fn() }));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../src/db');
const app = require('../src/app');

beforeEach(() => {
  db.execute.mockReset();
});

describe('POST /api/auth/register', () => {
  test('creates a user, stores a bcrypt hash and returns a token (201)', async () => {
    db.execute.mockResolvedValueOnce([{ insertId: 7 }]);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: ' Asha@Example.com ', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: 7, name: 'Asha', email: 'asha@example.com' });
    expect(jwt.verify(res.body.token, 'test-secret').userId).toBe(7);

    // The value sent to the DB must be a hash, not the plain password.
    const storedHash = db.execute.mock.calls[0][1][2];
    expect(storedHash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', storedHash)).toBe(true);
  });

  test('rejects an invalid email (400) without touching the DB', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'not-an-email', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(db.execute).not.toHaveBeenCalled();
  });

  test('rejects a short password (400)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'asha@example.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  test('rejects a duplicate email (409)', async () => {
    db.execute.mockRejectedValueOnce(Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' }));

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'asha@example.com', password: 'secret123' });

    expect(res.status).toBe(409);
  });

  test('rejects malformed JSON (400)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  let hash;
  beforeAll(async () => {
    hash = await bcrypt.hash('secret123', 4); // low cost factor keeps tests fast
  });

  test('returns a token for correct credentials (200)', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 3, name: 'Asha', email: 'asha@example.com', password_hash: hash }]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'asha@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 3, name: 'Asha', email: 'asha@example.com' });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(jwt.verify(res.body.token, 'test-secret').userId).toBe(3);
  });

  test('rejects a wrong password (401)', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 3, name: 'Asha', email: 'asha@example.com', password_hash: hash }]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'asha@example.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
  });

  test('rejects an unknown email with the same 401 message', async () => {
    db.execute.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'secret123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  test('rejects missing fields (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'asha@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  test('rejects a request with no token (401)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('rejects a token signed with a different secret (401)', async () => {
    const forged = jwt.sign({ userId: 3 }, 'some-other-secret');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test('returns the user for a valid token (200)', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 3, name: 'Asha', email: 'asha@example.com' }]]);
    const token = jwt.sign({ userId: 3 }, 'test-secret');

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(3);
    expect(db.execute.mock.calls[0][1]).toEqual([3]); // query was scoped to the token's user
  });
});
