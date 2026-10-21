// GET /api/profile/:fy and PUT /api/profile/:fy (income + deductions)
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { isValidAmount, requireValidFy } = require('../validation');
const { DEDUCTION_SECTIONS, findProfile, saveProfile } = require('../models/profiles');
const { listTaxYears } = require('../models/taxConfig');

const router = express.Router();
router.use(requireAuth);

const AMOUNT_FIELDS = ['grossSalary', 'otherIncome', 'basicSalary', 'hraReceived', 'rentPaid'];

// Turns the request body into a clean profile, or returns an error message.
// Missing amounts default to 0 so the form can leave optional fields blank.
function parseProfile(body) {
  const profile = { deductions: {} };

  for (const field of AMOUNT_FIELDS) {
    const value = body[field] ?? 0;
    if (!isValidAmount(value)) return { error: `${field} must be a non-negative number` };
    profile[field] = value;
  }

  const isMetro = body.isMetro ?? false;
  if (typeof isMetro !== 'boolean') return { error: 'isMetro must be true or false' };
  profile.isMetro = isMetro;

  const deductions = body.deductions ?? {};
  if (typeof deductions !== 'object' || Array.isArray(deductions)) {
    return { error: 'deductions must be an object like { "80C": 150000 }' };
  }
  for (const section of DEDUCTION_SECTIONS) {
    const value = deductions[section] ?? 0;
    if (!isValidAmount(value)) return { error: `Deduction ${section} must be a non-negative number` };
    profile.deductions[section] = value;
  }

  if (profile.basicSalary > profile.grossSalary || profile.hraReceived > profile.grossSalary) {
    return { error: 'Basic salary and HRA are part of gross salary, so neither can exceed it' };
  }

  return { profile };
}

router.get('/:fy', requireValidFy, async (req, res) => {
  const profile = await findProfile(req.userId, req.params.fy);
  if (!profile) {
    return res.status(404).json({ error: `No income details saved for FY ${req.params.fy}` });
  }
  res.json({ profile });
});

router.put('/:fy', requireValidFy, async (req, res) => {
  const { fy } = req.params;
  const { profile, error } = parseProfile(req.body || {});
  if (error) return res.status(400).json({ error });

  const supportedYears = await listTaxYears();
  if (!supportedYears.includes(fy)) {
    return res.status(400).json({ error: `FY ${fy} is not supported. Choose one of: ${supportedYears.join(', ')}` });
  }

  await saveProfile(req.userId, fy, profile);
  res.json({ profile: { fy, ...profile } });
});

module.exports = router;
