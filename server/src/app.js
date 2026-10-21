// Builds the Express app. Kept separate from server.js so tests can import
// the app without opening a network port.
require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const taxRoutes = require('./routes/tax');
const expenseRoutes = require('./routes/expenses');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/expenses', expenseRoutes);

// Any route not matched above.
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler. Express 5 forwards errors thrown in async
// handlers here automatically, so routes don't need try/catch everywhere.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
