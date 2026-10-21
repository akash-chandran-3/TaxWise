// GET /api/tax/years and GET /api/tax/compare/:fy
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { requireValidFy } = require('../validation');
const { findProfile } = require('../models/profiles');
const { listTaxYears, loadTaxConfig } = require('../models/taxConfig');
const { compareRegimes } = require('../tax/calculateTax');

const router = express.Router();
router.use(requireAuth);

// Which financial years have tax rules in the database (for the year dropdown).
router.get('/years', async (req, res) => {
  res.json({ years: await listTaxYears() });
});

router.get('/compare/:fy', requireValidFy, async (req, res) => {
  const { fy } = req.params;

  const config = await loadTaxConfig(fy);
  if (!config) {
    return res.status(404).json({ error: `No tax rules available for FY ${fy}` });
  }

  const profile = await findProfile(req.userId, fy);
  if (!profile) {
    return res.status(404).json({ error: `Save your income details for FY ${fy} first` });
  }

  res.json({ fy, profile, ...compareRegimes(profile, config) });
});

module.exports = router;
