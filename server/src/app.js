// Builds the Express app. Kept separate from server.js so tests can import
// the app without opening a network port.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const taxRoutes = require('./routes/tax');
const expenseRoutes = require('./routes/expenses');

const app = express();

// Only these sites may call the API from a browser. Needed in local development,
// where Vite runs on a different port; comma-separate several origins.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/expenses', expenseRoutes);

// When deployed, Express also serves the built React app (client/dist), so the
// whole site is one URL: same origin, no CORS. In local development Vite serves
// the client instead, and this folder may not exist.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // /tax and /expenses are React routes, not files: answer any non-API GET
  // with index.html and let React Router pick the page.
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

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
