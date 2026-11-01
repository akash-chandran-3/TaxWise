# TaxWise – Interview Notes

## 30-second pitch

> TaxWise is a full-stack app for salaried people in India. You enter your income and
> deductions, and it compares tax under the Old and New Regimes slab by slab, then tells
> you which one saves more. It also tracks expenses with a monthly category chart.
> React + Vite on the front, Express and MySQL with plain SQL on the back, JWT auth with
> bcrypt-hashed passwords. The tax rules live in the database, not the code, and the
> calculation is a pure function with unit tests on every slab edge and rebate threshold.

Numbers worth remembering: 82 server tests · 6 tables · 2 financial years seeded ·
4 steps in the tax calculation (deductions → slabs → rebate → cess).

---

## 1. Walk me through what happens when a user clicks "Calculate tax".

1. `TaxPage.jsx` turns the form strings into numbers and calls `api('/profile/2026-27', { method: 'PUT' })`.
2. `api.js` adds `Authorization: Bearer <token>`. Vite's dev proxy forwards `/api` to Express on port 5000.
3. `requireAuth` verifies the JWT and sets `req.userId`.
4. `routes/profile.js` validates the body (400 on bad input), then `saveProfile()` upserts
   the profile and its deductions inside a **transaction**.
5. The page then calls `GET /api/tax/compare/2026-27`. The route loads the rules and slabs
   (`models/taxConfig.js`) and the profile (`models/profiles.js`), then calls the pure
   `compareRegimes()`.
6. The JSON comes back and React renders two `RegimeCard`s plus the "You save ₹X" banner.

The layers are routes (HTTP and validation) → models (SQL) → `calculateTax.js` (pure logic).
Each layer can be tested on its own.

## 2. How does JWT authentication work here?

- **Login:** the server checks the password and signs a token: `jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1d' })`.
- **A token has three parts:** header, payload and signature. The payload is only
  base64-encoded, **not encrypted**, so we put just the user id in it, never secrets.
- **Every protected request:** `requireAuth` calls `jwt.verify`. If anyone changed the
  payload or the token has expired, the signature check fails and we return **401**.
- **Stateless:** the server keeps no session store. The signature itself proves the token
  is genuine, so it scales across servers easily.
- **Downsides:** you can't easily revoke a token before it expires. And because we keep it
  in `localStorage`, an XSS bug could steal it. In production I'd use a short-lived token in
  an **httpOnly cookie** plus a refresh token.

## 3. Why bcrypt? Why not just SHA-256 the password?

- SHA-256 is designed to be **fast**, so attackers can try billions of guesses per second.
  bcrypt is **deliberately slow**. The cost factor (10 here) means 2¹⁰ rounds, and you can
  raise it as hardware gets faster.
- bcrypt adds a random **salt** per password, so two users with the same password get
  different hashes, and precomputed rainbow tables don't work.
- The salt and cost are stored **inside** the 60-character hash (`$2b$10$…`), which is why
  `bcrypt.compare()` needs only the plain password and the stored hash.
- bcrypt only reads the first **72 bytes** of a password, so registration caps the
  length at 72.
- Login returns the same "Invalid email or password" for an unknown email and for a wrong
  password, so attackers can't use it to find out which emails are registered.

## 4. Explain the JOIN you used.

`findProfile()` in `models/profiles.js`:

```sql
SELECT p.fy, p.gross_salary, ..., d.section, d.amount
  FROM income_profiles p
  LEFT JOIN deductions d ON d.profile_id = p.id
 WHERE p.user_id = ? AND p.fy = ?
```

- It returns **one row per deduction** (80C, 80D), each repeating the profile columns. The
  JS then folds those rows into one object.
- It's a **LEFT** JOIN, so a profile with **no** deductions still comes back, with `NULL` in
  `section` and `amount`. An INNER JOIN would drop that profile entirely.
- Deductions sit in their own table (one row per section) instead of `sec_80c` and
  `sec_80d` columns, so adding a new section is a new row, not a schema change.

## 5. How does the monthly summary work? (GROUP BY)

```sql
SELECT category, SUM(amount) AS total, COUNT(*) AS count
  FROM expenses
 WHERE user_id = ? AND expense_date >= '2026-10-01' AND expense_date < '2026-11-01'
 GROUP BY category
 ORDER BY total DESC
```

- `WHERE` filters rows **before** grouping. `GROUP BY` collapses each category into one
  row, and `SUM` and `COUNT` run per group. To filter **after** grouping (for example,
  categories over ₹1,000), you'd use `HAVING SUM(amount) > 1000`.
- **Why a date range and not `MONTH(expense_date) = 10`?** Wrapping a column in a function
  stops MySQL from using an index on it. A plain range can use the composite index
  `(user_id, expense_date)`, so MySQL jumps straight to that user's rows for that month.
- The end date is **exclusive** (`< '2026-11-01'`), so no month needs to know whether it
  has 28, 30 or 31 days.

## 6. Why do the tax slabs live in the database instead of the code?

- Tax law changes **every year**, but the **logic** (tax each slab, apply the rebate, add
  cess) almost never does. Keeping data and logic apart means a new year is a data change,
  not a code change and redeploy.
- Several years can exist side by side. A user can compare FY 2025-26 and FY 2026-27, and
  old results stay reproducible.
- The calculation is a pure function that takes `rules` and `slabs` as parameters, so the
  tests use their own fixture. No database is needed to test the maths.
- A `NULL` cap means "not allowed in this regime". That's why the **new** regime ignores
  80C, 80D and HRA without a single `if (regime === 'new')` in the code.

## 7. How would you add next year's rules?

1. Read the Finance Act and the incometax.gov.in notices for the new year.
2. In `server/db/seed_tax_rules.sql`, copy the FY 2026-27 block, change the `fy` to
   `'2027-28'`, update any numbers, and add `'2027-28'` to the `DELETE FROM tax_rules WHERE fy IN (...)` line.
3. Run `npm run db:init`. It can safely run again: deleting a year's rules also deletes
   its slabs through `ON DELETE CASCADE`.
4. Add a few unit tests with the new year's numbers at the edges.

The year dropdown fills itself from `GET /api/tax/years`, so the frontend needs no changes.
**Code changes are only needed when the rule's shape changes**, for example a new kind of
deduction. That means a new column in `tax_rules`, one more line in `calculateRegimeTax`,
and a form field.

## 8. Explain the tax calculation. How did you test it?

`calculateRegimeTax(profile, rules, slabs)` works in four steps:

1. **Deductions:** standard deduction (only up to the salary), HRA exemption (the smallest
   of: HRA received, rent − 10% of basic, 50% or 40% of basic), and 80C/80D, each capped.
   Taxable income = max(0, gross − deductions).
2. **Slabs:** for each band, tax the part of income inside it:
   `max(0, min(income, upper) − lower) × rate`.
3. **87A rebate:** if taxable income ≤ the limit, the tax is wiped out up to the maximum
   rebate. In the new regime, **marginal relief** means someone just over ₹12L never pays
   more tax than the income they earned above ₹12L. At ₹12.1L, slab tax is ₹61,500 but
   only ₹10,000 is payable.
4. **Cess:** 4% on what's left. The total is rounded to the nearest rupee.

It's a **pure function**: no database, no HTTP, same input always gives the same output.
That makes it easy to unit-test. There are 29 Jest tests: every slab edge (₹4L, ₹8L, ₹12L,
₹24L, and one rupee into a slab), exactly at the rebate limit and just over it, the
marginal relief at three points, zero income, the caps, the three HRA cases, and both
recommendation outcomes. Every expected number is worked out by hand in a comment.

## 9. What security measures did you take?

- **SQL injection:** every query uses `?` placeholders with `db.execute()`, so values are
  sent separately from the SQL and never concatenated into it.
- **Authorization, not just authentication:** every expense and profile query includes
  `WHERE user_id = ?` taken from the token, never from the request body.
- **404 instead of 403** for another user's expense, so nobody can find out which ids exist.
- **Server-side validation on every route.** The browser's `min="0"` is only a convenience,
  since anyone can call the API with curl.
- Passwords are hashed with bcrypt, login errors are identical either way, and secrets live
  in `.env`, which isn't committed to git.
- The central error handler returns a plain "Something went wrong" with a 500, so stack
  traces never reach the client.

## 10. Where did you use a transaction? Why?

`saveProfile()` writes to two tables: the profile row, then one row per deduction. Without
a transaction, a failure halfway through could leave a profile with outdated deductions.
With `beginTransaction()` → writes → `commit()`, and `rollback()` in the `catch`, it's
all-or-nothing. The `finally` block always returns the connection to the pool.

Each write is an **upsert**:

```sql
INSERT INTO income_profiles (...) VALUES (...) AS incoming
ON DUPLICATE KEY UPDATE gross_salary = incoming.gross_salary, ...
```

The `UNIQUE (user_id, fy)` key makes "insert or update" one atomic statement, with no
SELECT-then-INSERT race. Registration uses the same idea: the UNIQUE index on email rejects
duplicates, and the route turns MySQL's `ER_DUP_ENTRY` into a **409 Conflict**.

---

## If they ask "What would you improve?"

- **Auth:** httpOnly-cookie tokens with refresh tokens, plus rate limiting on `/login`.
- **Tests:** integration tests against a real test database. Today's route tests mock the
  SQL layer, and the SQL was checked by hand against MySQL.
- **Database changes:** a migration tool such as Knex migrations or Flyway instead of
  re-running `schema.sql`.
- **Tax coverage:** surcharge above ₹50L, senior-citizen slabs, employer NPS, 80D for parents.
- **Larger datasets:** pagination for the expense list. TypeScript, or shared validation
  between client and server.

## Honest limitations to mention up front

- It's an **estimate**. The tax numbers came from secondary sources and must be checked on
  incometax.gov.in.
- Section names are the familiar 1961 Act ones (80C, 80D, 87A). From FY 2026-27 the
  Income-tax Act 2025 renumbers them (123, 126, 156).
