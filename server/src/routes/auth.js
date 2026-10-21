// POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

function normaliseEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

router.post('/register', async (req, res) => {
  const { name, password } = req.body || {};
  const email = normaliseEmail((req.body || {}).email);

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    return res.status(400).json({ error: 'Name is required (max 100 characters)' });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 255) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  // bcrypt only uses the first 72 bytes of a password, so cap it there.
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: 'Password must be 8 to 72 characters' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), email, passwordHash]
    );
    const user = { id: result.insertId, name: name.trim(), email };
    res.status(201).json({ token: signToken(user.id), user });
  } catch (err) {
    // The UNIQUE index on email rejects duplicates, so no separate SELECT is needed.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email is already registered' });
    }
    throw err; // anything else goes to the error handler in app.js
  }
});

router.post('/login', async (req, res) => {
  const { password } = req.body || {};
  const email = normaliseEmail((req.body || {}).email);

  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const [rows] = await db.execute(
    'SELECT id, name, email, password_hash FROM users WHERE email = ?',
    [email]
  );
  const user = rows[0];
  const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;

  // Same message for "no such user" and "wrong password" so attackers
  // can't use this endpoint to discover which emails are registered.
  if (!passwordOk) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({
    token: signToken(user.id),
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// Returns the logged-in user. Handy for the frontend to check a stored token.
router.get('/me', requireAuth, async (req, res) => {
  const [rows] = await db.execute(
    'SELECT id, name, email, created_at FROM users WHERE id = ?',
    [req.userId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: rows[0] });
});

module.exports = router;
