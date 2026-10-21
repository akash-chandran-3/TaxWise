// Pure tax calculation: no database, no HTTP, no hardcoded tax law.
// Every legal number (slabs, caps, rebate, cess, HRA %) arrives in `rules` and `slabs`,
// so the same code works for any year that has rows in the database.

function roundTo2(n) {
  return Math.round(n * 100) / 100;
}

// HRA exemption = the smallest of:
//   1. HRA actually received
//   2. rent paid minus X% of basic salary
//   3. Y% of basic salary (Y is higher for metro cities)
function hraExemption(profile, rules) {
  const rentMinusOffset = profile.rentPaid - (rules.hraRentOffsetPct / 100) * profile.basicSalary;
  const cityPct = profile.isMetro ? rules.hraMetroPct : rules.hraNonMetroPct;
  const shareOfBasic = (cityPct / 100) * profile.basicSalary;
  return Math.max(0, Math.min(profile.hraReceived, rentMinusOffset, shareOfBasic));
}

// A null cap means the deduction isn't allowed in this regime.
function capped(claimed, cap) {
  return cap == null ? 0 : Math.min(claimed || 0, cap);
}

/**
 * Tax for ONE regime.
 * profile: { grossSalary, otherIncome, basicSalary, hraReceived, rentPaid, isMetro,
 *            deductions: { '80C': number, '80D': number } }
 * rules:   { standardDeduction, rebateIncomeLimit, rebateMax, rebateMarginalRelief, cessPct,
 *            cap80C, cap80D, hraMetroPct, hraNonMetroPct, hraRentOffsetPct }
 * slabs:   [{ lowerLimit, upperLimit (null = no limit), rate (percent) }]
 */
function calculateRegimeTax(profile, rules, slabs) {
  const grossIncome = profile.grossSalary + profile.otherIncome;

  // 1. Deductions. The standard deduction only applies to salary income.
  const deductions = {
    standardDeduction: Math.min(rules.standardDeduction, profile.grossSalary),
    hra: rules.hraMetroPct == null ? 0 : hraExemption(profile, rules),
    section80C: capped(profile.deductions['80C'], rules.cap80C),
    section80D: capped(profile.deductions['80D'], rules.cap80D),
  };
  const totalDeductions = Object.values(deductions).reduce((sum, d) => sum + d, 0);
  const taxableIncome = Math.max(0, grossIncome - totalDeductions);

  // 2. Slab by slab: tax only the part of income that falls inside each band.
  const sortedSlabs = [...slabs].sort((a, b) => a.lowerLimit - b.lowerLimit);
  const slabBreakdown = sortedSlabs.map((slab) => {
    const top = slab.upperLimit == null ? Infinity : slab.upperLimit;
    const amountInSlab = Math.max(0, Math.min(taxableIncome, top) - slab.lowerLimit);
    return {
      from: slab.lowerLimit,
      to: slab.upperLimit,
      rate: slab.rate,
      amountInSlab,
      tax: (amountInSlab * slab.rate) / 100,
    };
  });
  const slabTax = slabBreakdown.reduce((sum, row) => sum + row.tax, 0);

  // 3. Section 87A rebate. Where marginal relief applies, someone just over the
  //    limit never pays more tax than the income they earned above the limit.
  let rebate = 0;
  let marginalRelief = 0;
  if (taxableIncome <= rules.rebateIncomeLimit) {
    rebate = Math.min(slabTax, rules.rebateMax);
  } else if (rules.rebateMarginalRelief) {
    const incomeAboveLimit = taxableIncome - rules.rebateIncomeLimit;
    marginalRelief = Math.max(0, slabTax - incomeAboveLimit);
  }
  const taxAfterRebate = slabTax - rebate - marginalRelief;

  // 4. Health & education cess on the remaining tax.
  const cess = (taxAfterRebate * rules.cessPct) / 100;

  return {
    grossIncome: roundTo2(grossIncome),
    deductions: Object.fromEntries(Object.entries(deductions).map(([k, v]) => [k, roundTo2(v)])),
    totalDeductions: roundTo2(totalDeductions),
    taxableIncome: roundTo2(taxableIncome),
    slabBreakdown: slabBreakdown.map((row) => ({ ...row, amountInSlab: roundTo2(row.amountInSlab), tax: roundTo2(row.tax) })),
    slabTax: roundTo2(slabTax),
    rebate: roundTo2(rebate),
    marginalRelief: roundTo2(marginalRelief),
    cess: roundTo2(cess),
    totalTax: Math.round(taxAfterRebate + cess), // final figure rounded to the rupee
  };
}

// Runs both regimes and says which one costs less.
function compareRegimes(profile, config) {
  const oldRegime = calculateRegimeTax(profile, config.old.rules, config.old.slabs);
  const newRegime = calculateRegimeTax(profile, config.new.rules, config.new.slabs);
  const difference = oldRegime.totalTax - newRegime.totalTax;

  let recommended = 'either';
  if (difference > 0) recommended = 'new';
  if (difference < 0) recommended = 'old';

  return { old: oldRegime, new: newRegime, recommended, savings: Math.abs(difference) };
}

module.exports = { calculateRegimeTax, compareRegimes, hraExemption };
