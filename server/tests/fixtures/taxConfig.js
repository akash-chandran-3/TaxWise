// FY 2026-27 rules in the same shape loadTaxConfig() returns.
// A copy of db/seed_tax_rules.sql so the unit tests don't need a database.
module.exports = {
  old: {
    rules: {
      standardDeduction: 50000,
      rebateIncomeLimit: 500000,
      rebateMax: 12500,
      rebateMarginalRelief: false,
      cessPct: 4,
      cap80C: 150000,
      cap80D: 25000,
      hraMetroPct: 50,
      hraNonMetroPct: 40,
      hraRentOffsetPct: 10,
    },
    slabs: [
      { lowerLimit: 0, upperLimit: 250000, rate: 0 },
      { lowerLimit: 250000, upperLimit: 500000, rate: 5 },
      { lowerLimit: 500000, upperLimit: 1000000, rate: 20 },
      { lowerLimit: 1000000, upperLimit: null, rate: 30 },
    ],
  },
  new: {
    rules: {
      standardDeduction: 75000,
      rebateIncomeLimit: 1200000,
      rebateMax: 60000,
      rebateMarginalRelief: true,
      cessPct: 4,
      cap80C: null,
      cap80D: null,
      hraMetroPct: null,
      hraNonMetroPct: null,
      hraRentOffsetPct: null,
    },
    slabs: [
      { lowerLimit: 0, upperLimit: 400000, rate: 0 },
      { lowerLimit: 400000, upperLimit: 800000, rate: 5 },
      { lowerLimit: 800000, upperLimit: 1200000, rate: 10 },
      { lowerLimit: 1200000, upperLimit: 1600000, rate: 15 },
      { lowerLimit: 1600000, upperLimit: 2000000, rate: 20 },
      { lowerLimit: 2000000, upperLimit: 2400000, rate: 25 },
      { lowerLimit: 2400000, upperLimit: null, rate: 30 },
    ],
  },
};
