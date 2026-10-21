// Reads tax rules and slabs from MySQL and shapes them for calculateTax.js.
const db = require('../db');

async function listTaxYears() {
  const [rows] = await db.execute('SELECT DISTINCT fy FROM tax_rules ORDER BY fy DESC');
  return rows.map((row) => row.fy);
}

// Returns { old: { rules, slabs }, new: { rules, slabs } }, or null if the year isn't set up.
async function loadTaxConfig(fy) {
  const [ruleRows] = await db.execute('SELECT * FROM tax_rules WHERE fy = ?', [fy]);
  const [slabRows] = await db.execute(
    'SELECT regime, lower_limit, upper_limit, rate FROM tax_slabs WHERE fy = ? ORDER BY regime, lower_limit',
    [fy]
  );

  const config = {};
  for (const r of ruleRows) {
    config[r.regime] = {
      rules: {
        standardDeduction: r.standard_deduction,
        rebateIncomeLimit: r.rebate_income_limit,
        rebateMax: r.rebate_max,
        rebateMarginalRelief: Boolean(r.rebate_marginal_relief),
        cessPct: r.cess_pct,
        cap80C: r.cap_80c,
        cap80D: r.cap_80d,
        hraMetroPct: r.hra_metro_pct,
        hraNonMetroPct: r.hra_non_metro_pct,
        hraRentOffsetPct: r.hra_rent_offset_pct,
      },
      slabs: slabRows
        .filter((s) => s.regime === r.regime)
        .map((s) => ({ lowerLimit: s.lower_limit, upperLimit: s.upper_limit, rate: s.rate })),
    };
  }

  // Both regimes, each with at least one slab, are needed to compare.
  const complete = ['old', 'new'].every((regime) => config[regime] && config[regime].slabs.length > 0);
  return complete ? config : null;
}

module.exports = { listTaxYears, loadTaxConfig };
