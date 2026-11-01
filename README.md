# TaxWise

A personal income tax calculator (Old vs New Regime, India) and expense tracker.

> **Disclaimer:** TaxWise gives an *estimate* for learning purposes. It is not tax advice.
> Always verify against [incometax.gov.in](https://www.incometax.gov.in) or a qualified professional.

**Stack:** React + Vite · Node.js + Express 5 · MySQL 8 (mysql2, plain SQL) · JWT + bcrypt · Chart.js · Jest + Supertest

📝 Preparing for an interview? See **[INTERVIEW_NOTES.md](INTERVIEW_NOTES.md)**.
🚀 Deploying? See **[DEPLOY.md](DEPLOY.md)** (one Render web service + Aiven MySQL).

## Features

- **Accounts:** register and log in. Passwords are hashed with bcrypt, and sessions use JWT.
- **Tax comparison:** enter income, HRA details and 80C/80D for a financial year, and see
  both regimes side by side. Each shows the slab-by-slab breakdown, the 87A rebate,
  marginal relief, cess and total tax, followed by "You save ₹X with the … Regime".
- **Data-driven tax rules:** slabs, rates, standard deduction, rebate, cess, caps and HRA
  percentages are rows in MySQL, not code. FY 2025-26 and FY 2026-27 are included.
- **Expenses:** add, edit and delete expenses by month, with a doughnut chart and table by
  category, built with SQL `GROUP BY`.

## Project layout

```
server/
  db/schema.sql            CREATE TABLE scripts (6 tables, keys, indexes, checks)
  db/seed_tax_rules.sql    tax rules + slabs per year (sources in the comments)
  db/init.js               runs both SQL files (npm run db:init)
  src/app.js               Express app: routes, 404 and error handlers; serves client/dist when built
  src/dbConfig.js          connection settings (+ TLS for a hosted DB like Aiven)
  src/server.js            starts the HTTP server
  src/db.js                MySQL connection pool
  src/validation.js        shared input checks (year, month, date, amount)
  src/middleware/          requireAuth (JWT check)
  src/models/              all SQL: profiles, taxConfig, expenses
  src/routes/              auth, profile, tax, expenses
  src/tax/calculateTax.js  the pure tax function
  tests/                   Jest unit tests + Supertest route tests
client/
  src/api.js               fetch wrapper (adds the JWT, throws on errors)
  src/AuthContext.jsx      logged-in user + token, shared app-wide
  src/format.js            ₹ and date formatting
  src/pages/               AuthPage (login/register), TaxPage, ExpensesPage
  src/components/          RegimeCard, CategoryChart, Disclaimer
INTERVIEW_NOTES.md         likely questions with short answers
```

## Setup

**Prerequisites:** Node.js 20.19+ (or 22.12+) and MySQL 8.0.19+ running locally.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
```

Edit `server/.env`. Set `DB_USER` and `DB_PASSWORD` to your MySQL login, and `JWT_SECRET` to
a long random string. To generate one:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

```bash
npm run db:init           # creates the taxwise database, tables and tax rules
npm run dev               # API on http://localhost:5000 (restarts on file changes)
```

> **Tip:** rather than using `root`, create a MySQL user that can only access this database:
> ```sql
> CREATE USER 'taxwise_app'@'localhost' IDENTIFIED BY 'choose-a-password';
> GRANT ALL PRIVILEGES ON taxwise.* TO 'taxwise_app'@'localhost';
> ```

### 2. Frontend (second terminal)

```bash
cd client
npm install
npm run dev               # http://localhost:5173 (calls to /api are proxied to port 5000)
```

Open http://localhost:5173 and create an account.

### 3. Tests

```bash
cd server
npm test                  # 82 tests; MySQL not needed (the DB layer is mocked)
```

| File | Tests |
|------|-------|
| `tests/calculateTax.test.js` | slab edges, rebate thresholds, marginal relief, zero income, caps, HRA, recommendation |
| `tests/auth.test.js` | register/login validation, 409 duplicate, 401s, bcrypt hash stored, JWT check |
| `tests/profileTax.test.js` | profile validation, unsupported year, compare endpoint |
| `tests/expenses.test.js` | expense CRUD, validation, 404s, user scoping, monthly summary |

> **Why the scripts call `node node_modules/...`:** the folder name `H&R BLOCK` contains `&`,
> which breaks npm's Windows command shims. So the npm scripts run
> `node node_modules/<tool>/...` (Jest, Vite) rather than the plain command.

## API

All routes except register, login and health need `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/health | Health check |
| POST   | /api/auth/register | `{name, email, password}` → `201 {token, user}` |
| POST   | /api/auth/login | `{email, password}` → `{token, user}` |
| GET    | /api/auth/me | Current user |
| GET    | /api/profile/:fy | Saved income + deductions (`404` if none) |
| PUT    | /api/profile/:fy | Save income + deductions (insert or update) |
| GET    | /api/tax/years | Financial years that have tax rules |
| GET    | /api/tax/compare/:fy | Old vs New breakdown + recommendation |
| GET    | /api/expenses?month=YYYY-MM | List expenses (month optional) |
| GET    | /api/expenses/:id | One expense |
| POST   | /api/expenses | `{amount, category, date, note}` → `201` |
| PUT    | /api/expenses/:id | Replace an expense |
| DELETE | /api/expenses/:id | Delete → `204` |
| GET    | /api/expenses/summary?month=YYYY-MM | Total and count per category |
| GET    | /api/expenses/categories | Allowed categories |

`:fy` looks like `2026-27`. Example profile `PUT` body:

```json
{
  "grossSalary": 1300000, "otherIncome": 0,
  "basicSalary": 500000, "hraReceived": 200000, "rentPaid": 240000, "isMetro": true,
  "deductions": { "80C": 150000, "80D": 25000 }
}
```

**Error codes:** `400` invalid input · `401` bad or missing credentials/token ·
`404` not found (including another user's expense, so ids can't be probed) ·
`409` email already registered · `500` server error. Every error body is `{ "error": "message" }`.

## Tax rules

Slabs and rules live in the `tax_rules` and `tax_slabs` tables, seeded from
`server/db/seed_tax_rules.sql`. **Verify every number against incometax.gov.in.**

To add a new year, copy a block in that file, change the year and numbers, and run
`npm run db:init`. No code changes are needed.

**Not modelled:**
- surcharge (income above ₹50 lakh)
- senior-citizen slabs
- special-rate income such as capital gains
- 80D for parents or senior citizens
- employer NPS
- other Chapter VI-A deductions

From FY 2026-27 the Income-tax Act 2025 renumbers sections (80C → 123, 80D → 126, 87A → 156).
The app keeps the familiar names.
