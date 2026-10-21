-- Tax reference data for resident individuals below 60 years of age.
--
-- SOURCES (secondary; the official pages could not be fetched automatically):
--   * Budget 2025 / Finance Act 2025 rates for FY 2025-26, as summarised by
--     cleartax.in/s/income-tax-slabs and axismaxlife.com.
--   * Budget 2026 made no change to slabs, rebate, standard deduction or cess
--     for FY 2026-27, the first "tax year" under the Income-tax Act, 2025
--     (hdfc.bank.in Budget 2026-27 summary; taxguru.in Finance Bill 2026 notes).
--   * Under the 2025 Act the sections are renumbered (80C -> 123, 80D -> 126,
--     87A -> 156, 115BAC -> 202). The old names are kept here because they're familiar.
--
-- !! VERIFY EVERY NUMBER BELOW AGAINST incometax.gov.in BEFORE RELYING ON IT !!
--
-- Simplifications: 80D uses the "self & family, below 60" cap only; HRA uses a
-- simple metro / non-metro switch; surcharge (income above Rs 50 lakh) is not modelled.
--
-- Re-runnable: deleting a year's rules also deletes its slabs (ON DELETE CASCADE).
-- To add a new year: copy one block, change the fy and any numbers, run `npm run db:init`.

USE taxwise;

DELETE FROM tax_rules WHERE fy IN ('2025-26', '2026-27');

-- ---------------------------------------------------------------
-- FY 2026-27 (tax year 2026-27, Income-tax Act 2025)
-- ---------------------------------------------------------------
INSERT INTO tax_rules
  (fy, regime, standard_deduction, rebate_income_limit, rebate_max, rebate_marginal_relief,
   cess_pct, cap_80c, cap_80d, hra_metro_pct, hra_non_metro_pct, hra_rent_offset_pct)
VALUES
  ('2026-27', 'old', 50000,  500000, 12500, FALSE, 4.00, 150000, 25000, 50.00, 40.00, 10.00),
  ('2026-27', 'new', 75000, 1200000, 60000, TRUE,  4.00, NULL,   NULL,  NULL,  NULL,  NULL);

INSERT INTO tax_slabs (fy, regime, lower_limit, upper_limit, rate) VALUES
  ('2026-27', 'old',       0,  250000,  0),
  ('2026-27', 'old',  250000,  500000,  5),
  ('2026-27', 'old',  500000, 1000000, 20),
  ('2026-27', 'old', 1000000,    NULL, 30),

  ('2026-27', 'new',       0,  400000,  0),
  ('2026-27', 'new',  400000,  800000,  5),
  ('2026-27', 'new',  800000, 1200000, 10),
  ('2026-27', 'new', 1200000, 1600000, 15),
  ('2026-27', 'new', 1600000, 2000000, 20),
  ('2026-27', 'new', 2000000, 2400000, 25),
  ('2026-27', 'new', 2400000,    NULL, 30);

-- ---------------------------------------------------------------
-- FY 2025-26 (Income Tax Act 1961, Finance Act 2025) - same numbers
-- ---------------------------------------------------------------
INSERT INTO tax_rules
  (fy, regime, standard_deduction, rebate_income_limit, rebate_max, rebate_marginal_relief,
   cess_pct, cap_80c, cap_80d, hra_metro_pct, hra_non_metro_pct, hra_rent_offset_pct)
VALUES
  ('2025-26', 'old', 50000,  500000, 12500, FALSE, 4.00, 150000, 25000, 50.00, 40.00, 10.00),
  ('2025-26', 'new', 75000, 1200000, 60000, TRUE,  4.00, NULL,   NULL,  NULL,  NULL,  NULL);

INSERT INTO tax_slabs (fy, regime, lower_limit, upper_limit, rate) VALUES
  ('2025-26', 'old',       0,  250000,  0),
  ('2025-26', 'old',  250000,  500000,  5),
  ('2025-26', 'old',  500000, 1000000, 20),
  ('2025-26', 'old', 1000000,    NULL, 30),

  ('2025-26', 'new',       0,  400000,  0),
  ('2025-26', 'new',  400000,  800000,  5),
  ('2025-26', 'new',  800000, 1200000, 10),
  ('2025-26', 'new', 1200000, 1600000, 15),
  ('2025-26', 'new', 1600000, 2000000, 20),
  ('2025-26', 'new', 2000000, 2400000, 25),
  ('2025-26', 'new', 2400000,    NULL, 30);
