# TaxWise

A personal income tax calculator (Old vs New Regime, India) and expense tracker.

> **Disclaimer:** TaxWise gives an *estimate* for learning purposes. It is not tax advice.
> Always verify against [incometax.gov.in](https://www.incometax.gov.in) or a qualified professional.

**Stack:** React + Vite · Node.js + Express 5 · MySQL 8 (mysql2, plain SQL) · JWT + bcrypt · Jest + Supertest

## Project layout

```
server/
  db/schema.sql          CREATE TABLE scripts
  db/init.js             runs the SQL files (npm run db:init)
  src/app.js             Express app (routes, error handling)
  src/server.js          starts the HTTP server
  src/db.js              MySQL connection pool
  src/middleware/        requireAuth (JWT check)
  src/routes/            auth routes (more added in later steps)
  tests/                 Jest + Supertest tests
client/
  src/api.js             fetch wrapper (adds the JWT, throws on errors)
  src/AuthContext.jsx    logged-in user + token, shared app-wide
  src/pages/             AuthPage (login/register), TaxPage, ExpensesPage
  src/components/        RegimeCard, CategoryChart (Chart.js doughnut + table), Disclaimer
```

## Setup

Prerequisites: Node.js 18+ and MySQL 8.0.16+ running locally.

```bash
cd server
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
```

Edit `server/.env`: set `DB_PASSWORD` to your MySQL password and `JWT_SECRET` to a long random string.

```bash
npm run db:init           # creates the `taxwise` database and tables
npm run dev               # API on http://localhost:5000 (restarts on file changes)
npm test                  # runs the tests (MySQL not needed: the DB is mocked)
```

Then, in a second terminal, start the frontend:

```bash
cd client
npm install
npm run dev               # http://localhost:5173 (calls to /api are proxied to port 5000)
```

> The project folder name contains `&`, which breaks npm's Windows command shims.
> That's why the npm scripts run `node node_modules/<tool>/...` (e.g. Jest, Vite) rather than the plain command.

## API

| Method | Path                 | Auth | Description                     |
|--------|----------------------|------|---------------------------------|
| GET    | /api/health          | –    | Health check                    |
| POST   | /api/auth/register   | –    | `{name, email, password}` → token |
| POST   | /api/auth/login      | –    | `{email, password}` → token     |
| GET    | /api/auth/me         | JWT  | Current user                    |
| GET    | /api/profile/:fy     | JWT  | Saved income + deductions (404 if none) |
| PUT    | /api/profile/:fy     | JWT  | Save income + deductions (insert or update) |
| GET    | /api/tax/years       | JWT  | Financial years that have tax rules |
| GET    | /api/tax/compare/:fy | JWT  | Old vs New breakdown + recommendation |

| GET    | /api/expenses?month=YYYY-MM | JWT | List expenses (month optional) |
| GET    | /api/expenses/:id    | JWT  | One expense                     |
| POST   | /api/expenses        | JWT  | `{amount, category, date, note}` → 201 |
| PUT    | /api/expenses/:id    | JWT  | Replace an expense              |
| DELETE | /api/expenses/:id    | JWT  | Delete → 204                    |
| GET    | /api/expenses/summary?month=YYYY-MM | JWT | Total per category (`GROUP BY`) |
| GET    | /api/expenses/categories | JWT | Allowed categories          |

Expenses belonging to another user return `404`, not `403`, so ids can't be probed.

`:fy` looks like `2026-27`. Example profile PUT body:

```json
{
  "grossSalary": 1300000, "otherIncome": 0,
  "basicSalary": 500000, "hraReceived": 200000, "rentPaid": 240000, "isMetro": true,
  "deductions": { "80C": 150000, "80D": 25000 }
}
```

Error codes: `400` invalid input · `401` bad or missing credentials/token · `404` not found · `409` email already registered · `500` server error.

## Tax rules

Slabs and rules live in the `tax_rules` and `tax_slabs` tables, seeded from
`server/db/seed_tax_rules.sql` (FY 2025-26 and FY 2026-27). **Verify every number
against incometax.gov.in.** To add a new year, copy a block in that file, change the
year and numbers, and run `npm run db:init`. No code changes are needed.

Not modelled: surcharge (income above ₹50 lakh), senior-citizen slabs, special-rate
income such as capital gains, 80D for parents/senior citizens.
