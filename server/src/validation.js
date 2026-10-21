// Small validation helpers shared by the routes.

// Largest amount we accept; DECIMAL(14,2) can hold up to 999,999,999,999.99.
const MAX_AMOUNT = 100_000_000_000;

// '2026-27' is valid, '2026-28' and '26-27' are not.
function isValidFy(fy) {
  const match = /^(\d{4})-(\d{2})$/.exec(fy);
  return Boolean(match) && (Number(match[1]) + 1) % 100 === Number(match[2]);
}

function isValidAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT;
}

// '2026-10' is valid, '2026-13' and '2026-1' are not.
function isValidMonth(month) {
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

// A real calendar date in 'YYYY-MM-DD' form ('2026-02-30' is rejected).
function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

// '2026-10' -> { start: '2026-10-01', end: '2026-11-01' }  (end is exclusive)
function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
  return { start: `${month}-01`, end: `${next}-01` };
}

// Route middleware for any URL with a :fy parameter.
function requireValidFy(req, res, next) {
  if (!isValidFy(req.params.fy)) {
    return res.status(400).json({ error: 'Financial year must look like 2026-27' });
  }
  next();
}

module.exports = {
  MAX_AMOUNT,
  isValidFy,
  isValidAmount,
  isValidMonth,
  isValidDate,
  monthRange,
  requireValidFy,
};
