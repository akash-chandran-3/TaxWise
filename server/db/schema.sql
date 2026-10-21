-- TaxWise database schema (MySQL 8.0+)
-- Safe to re-run: every table uses IF NOT EXISTS, so existing data is kept.

CREATE DATABASE IF NOT EXISTS taxwise CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE taxwise;

-- ---------------------------------------------------------------
-- users: one row per account. Passwords are stored only as bcrypt hashes.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash CHAR(60)     NOT NULL,          -- bcrypt hashes are always 60 chars
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)             -- also makes login lookups fast
);

-- ---------------------------------------------------------------
-- income_profiles: a user's income for ONE financial year (e.g. '2025-26').
-- HRA inputs live here because the HRA exemption is calculated from them.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS income_profiles (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED  NOT NULL,
  fy           CHAR(7)       NOT NULL,          -- format 'YYYY-YY'
  gross_salary DECIMAL(14,2) NOT NULL DEFAULT 0,
  other_income DECIMAL(14,2) NOT NULL DEFAULT 0,
  basic_salary DECIMAL(14,2) NOT NULL DEFAULT 0,
  hra_received DECIMAL(14,2) NOT NULL DEFAULT 0,
  rent_paid    DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_metro     BOOLEAN       NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- One profile per user per year. Because user_id is the leftmost column,
  -- this unique index also serves "WHERE user_id = ?" lookups and the FK.
  UNIQUE KEY uq_profile_user_fy (user_id, fy),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_profile_non_negative CHECK (
    gross_salary >= 0 AND other_income >= 0 AND basic_salary >= 0
    AND hra_received >= 0 AND rent_paid >= 0
  )
);

-- ---------------------------------------------------------------
-- deductions: one row per section claimed in a profile ('80C', '80D').
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deductions (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  profile_id INT UNSIGNED  NOT NULL,
  section    VARCHAR(10)   NOT NULL,
  amount     DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_deduction_profile_section (profile_id, section),
  CONSTRAINT fk_deduction_profile FOREIGN KEY (profile_id) REFERENCES income_profiles (id) ON DELETE CASCADE,
  CONSTRAINT chk_deduction_non_negative CHECK (amount >= 0)
);

-- ---------------------------------------------------------------
-- tax_rules: the per-year, per-regime numbers that are NOT slabs
-- (standard deduction, 87A rebate, cess, deduction caps, HRA formula).
-- All percentages are stored as percent (4.00 = 4%).
-- Filled in by seed_tax_rules.sql.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rules (
  fy                     CHAR(7)           NOT NULL,
  regime                 ENUM('old','new') NOT NULL,
  standard_deduction     DECIMAL(14,2)     NOT NULL,
  rebate_income_limit    DECIMAL(14,2)     NOT NULL,  -- 87A applies if taxable income <= this
  rebate_max             DECIMAL(14,2)     NOT NULL,  -- largest rebate allowed
  rebate_marginal_relief BOOLEAN           NOT NULL DEFAULT FALSE,
  cess_pct               DECIMAL(5,2)      NOT NULL,
  cap_80c                DECIMAL(14,2)     NULL,      -- NULL = deduction not allowed in this regime
  cap_80d                DECIMAL(14,2)     NULL,
  hra_metro_pct          DECIMAL(5,2)      NULL,      -- % of basic (metro city); NULL = no HRA exemption
  hra_non_metro_pct      DECIMAL(5,2)      NULL,      -- % of basic (other cities)
  hra_rent_offset_pct    DECIMAL(5,2)      NULL,      -- rent paid minus this % of basic
  PRIMARY KEY (fy, regime)
);

-- ---------------------------------------------------------------
-- tax_slabs: income bands and their rates for each year + regime.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_slabs (
  id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  fy          CHAR(7)           NOT NULL,
  regime      ENUM('old','new') NOT NULL,
  lower_limit DECIMAL(14,2)     NOT NULL,
  upper_limit DECIMAL(14,2)     NULL,             -- NULL = no upper limit (top slab)
  rate        DECIMAL(5,2)      NOT NULL,         -- percent, e.g. 5.00
  PRIMARY KEY (id),
  KEY idx_slabs_fy_regime (fy, regime, lower_limit),
  CONSTRAINT fk_slab_rules FOREIGN KEY (fy, regime) REFERENCES tax_rules (fy, regime) ON DELETE CASCADE
);

-- ---------------------------------------------------------------
-- expenses: everyday spending a user logs.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED  NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  category     VARCHAR(30)   NOT NULL,
  expense_date DATE          NOT NULL,
  note         VARCHAR(255)  NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Matches the common query "this user's expenses within a date range".
  KEY idx_expenses_user_date (user_id, expense_date),
  CONSTRAINT fk_expense_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_expense_positive CHECK (amount > 0)
);
