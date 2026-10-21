// Unit tests for the pure tax function. Expected numbers are worked out by hand
// in the comments so each one can be checked with a calculator.
const { calculateRegimeTax, compareRegimes, hraExemption } = require('../src/tax/calculateTax');
const config = require('./fixtures/taxConfig');

function makeProfile(overrides = {}) {
  return {
    grossSalary: 0,
    otherIncome: 0,
    basicSalary: 0,
    hraReceived: 0,
    rentPaid: 0,
    isMetro: false,
    deductions: { '80C': 0, '80D': 0 },
    ...overrides,
  };
}

// Income with nothing to deduct (no salary means no standard deduction),
// so taxable income equals the amount passed in. Handy for slab-edge tests.
const taxable = (amount) => makeProfile({ otherIncome: amount });

const newTax = (profile) => calculateRegimeTax(profile, config.new.rules, config.new.slabs);
const oldTax = (profile) => calculateRegimeTax(profile, config.old.rules, config.old.slabs);

describe('zero income', () => {
  test('pays no tax in either regime', () => {
    expect(newTax(makeProfile()).totalTax).toBe(0);
    expect(oldTax(makeProfile()).totalTax).toBe(0);
    expect(newTax(makeProfile()).taxableIncome).toBe(0);
  });

  test('deductions larger than income never make taxable income negative', () => {
    const result = oldTax(makeProfile({ grossSalary: 40000, deductions: { '80C': 150000, '80D': 0 } }));
    expect(result.taxableIncome).toBe(0);
    expect(result.totalTax).toBe(0);
  });
});

describe('new regime slab edges', () => {
  test.each([
    // [taxable income, slab tax before rebate]
    [400000, 0], //        top of the 0% slab
    [800000, 20000], //    4L x 5%
    [1200000, 60000], //   20,000 + 4L x 10%
    [1600000, 120000], //  60,000 + 4L x 15%
    [2400000, 300000], //  60k + 60k + 80k + 100k
  ])('taxable %i has slab tax %i', (income, expectedSlabTax) => {
    expect(newTax(taxable(income)).slabTax).toBe(expectedSlabTax);
  });

  test('one rupee into the 5% slab is taxed at 5%', () => {
    expect(newTax(taxable(400001)).slabTax).toBe(0.05);
  });

  test('top slab: 30 lakh -> (300,000 + 6L x 30%) x 1.04 = 499,200', () => {
    expect(newTax(taxable(3000000)).totalTax).toBe(499200);
  });

  test('breakdown shows how much income falls in each slab', () => {
    const rows = newTax(taxable(1000000)).slabBreakdown;
    expect(rows[0]).toMatchObject({ from: 0, to: 400000, rate: 0, amountInSlab: 400000, tax: 0 });
    expect(rows[1]).toMatchObject({ amountInSlab: 400000, tax: 20000 });
    expect(rows[2]).toMatchObject({ amountInSlab: 200000, tax: 20000 });
    expect(rows[3]).toMatchObject({ amountInSlab: 0, tax: 0 });
    expect(rows[6].to).toBeNull(); // top slab has no upper limit
  });

  test('slab order in the input does not matter', () => {
    const reversed = [...config.new.slabs].reverse();
    const result = calculateRegimeTax(taxable(1000000), config.new.rules, reversed);
    expect(result.slabTax).toBe(40000);
    expect(result.slabBreakdown[0].from).toBe(0);
  });
});

describe('new regime 87A rebate and marginal relief', () => {
  test('taxable income exactly at the 12 lakh limit pays zero', () => {
    const result = newTax(taxable(1200000));
    expect(result.rebate).toBe(60000);
    expect(result.totalTax).toBe(0);
  });

  test('salary of 12.75 lakh is tax-free after the 75,000 standard deduction', () => {
    const result = newTax(makeProfile({ grossSalary: 1275000 }));
    expect(result.taxableIncome).toBe(1200000);
    expect(result.totalTax).toBe(0);
  });

  test('12.1 lakh: tax capped at the 10,000 earned above the limit, plus cess = 10,400', () => {
    // slab tax 61,500; payable cannot exceed 10,000, so relief = 51,500
    const result = newTax(taxable(1210000));
    expect(result.rebate).toBe(0);
    expect(result.marginalRelief).toBe(51500);
    expect(result.totalTax).toBe(10400);
  });

  test('12.7 lakh: relief is nearly used up (70,500 - 70,000 = 500)', () => {
    const result = newTax(taxable(1270000));
    expect(result.marginalRelief).toBe(500);
    expect(result.totalTax).toBe(72800); // 70,000 x 1.04
  });

  test('13 lakh: no relief, full slab tax 75,000 x 1.04 = 78,000', () => {
    const result = newTax(taxable(1300000));
    expect(result.marginalRelief).toBe(0);
    expect(result.totalTax).toBe(78000);
  });
});

describe('old regime', () => {
  test('taxable 2.5 lakh pays nothing', () => {
    expect(oldTax(taxable(250000)).slabTax).toBe(0);
  });

  test('taxable exactly 5 lakh: slab tax 12,500 fully rebated', () => {
    const result = oldTax(taxable(500000));
    expect(result.slabTax).toBe(12500);
    expect(result.rebate).toBe(12500);
    expect(result.totalTax).toBe(0);
  });

  test('just over 5 lakh loses the whole rebate (no marginal relief in old regime)', () => {
    // 12,500 + 10 x 20% = 12,502; x 1.04 = 13,002.08 -> 13,002
    const result = oldTax(taxable(500010));
    expect(result.rebate).toBe(0);
    expect(result.marginalRelief).toBe(0);
    expect(result.totalTax).toBe(13002);
  });

  test('taxable 10 lakh: (12,500 + 100,000) x 1.04 = 117,000', () => {
    expect(oldTax(taxable(1000000)).totalTax).toBe(117000);
  });

  test('80C and 80D are capped; standard deduction is 50,000', () => {
    const result = oldTax(makeProfile({ grossSalary: 1200000, deductions: { '80C': 200000, '80D': 30000 } }));
    expect(result.deductions).toEqual({ standardDeduction: 50000, hra: 0, section80C: 150000, section80D: 25000 });
    // taxable 9,75,000 -> 12,500 + 4,75,000 x 20% = 107,500; x 1.04 = 111,800
    expect(result.taxableIncome).toBe(975000);
    expect(result.totalTax).toBe(111800);
  });
});

describe('deductions by regime', () => {
  test('new regime ignores 80C, 80D and HRA', () => {
    const result = newTax(makeProfile({
      grossSalary: 1500000, basicSalary: 600000, hraReceived: 300000, rentPaid: 360000,
      deductions: { '80C': 150000, '80D': 25000 },
    }));
    expect(result.deductions).toEqual({ standardDeduction: 75000, hra: 0, section80C: 0, section80D: 0 });
  });

  test('standard deduction never exceeds salary', () => {
    expect(newTax(makeProfile({ grossSalary: 30000 })).deductions.standardDeduction).toBe(30000);
    expect(newTax(taxable(500000)).deductions.standardDeduction).toBe(0);
  });
});

describe('HRA exemption (least of three)', () => {
  const rules = config.old.rules;
  const base = { basicSalary: 600000, hraReceived: 300000, rentPaid: 360000 };

  test('metro: min(300,000 received, 360,000 - 60,000, 50% x 600,000) = 300,000', () => {
    expect(hraExemption({ ...base, isMetro: true }, rules)).toBe(300000);
  });

  test('non-metro: 40% of basic (240,000) is the smallest', () => {
    expect(hraExemption({ ...base, isMetro: false }, rules)).toBe(240000);
  });

  test('rent below 10% of basic gives no exemption', () => {
    expect(hraExemption({ ...base, rentPaid: 50000, isMetro: true }, rules)).toBe(0);
  });
});

describe('compareRegimes', () => {
  test('recommends the new regime when it is cheaper', () => {
    const result = compareRegimes(makeProfile({ grossSalary: 1200000, deductions: { '80C': 200000, '80D': 30000 } }), config);
    expect(result.new.totalTax).toBe(0); // taxable 11,25,000 is under the rebate limit
    expect(result.old.totalTax).toBe(111800);
    expect(result.recommended).toBe('new');
    expect(result.savings).toBe(111800);
  });

  test('recommends the old regime when deductions are large enough', () => {
    // Old: deductions 50k + 12.5L HRA + 1.5L + 25k = 14.75L -> taxable 35.25L -> 904,800
    // New: taxable 49.25L -> 1,099,800
    const result = compareRegimes(makeProfile({
      grossSalary: 5000000, basicSalary: 2500000, hraReceived: 1250000, rentPaid: 1500000, isMetro: true,
      deductions: { '80C': 150000, '80D': 25000 },
    }), config);
    expect(result.old.totalTax).toBe(904800);
    expect(result.new.totalTax).toBe(1099800);
    expect(result.recommended).toBe('old');
    expect(result.savings).toBe(195000);
  });

  test('says "either" when both regimes cost the same', () => {
    const result = compareRegimes(makeProfile(), config);
    expect(result.recommended).toBe('either');
    expect(result.savings).toBe(0);
  });
});
