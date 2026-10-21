// Route tests for /api/profile and /api/tax. The model modules (which hold the SQL)
// are mocked, so these tests focus on validation, status codes and response shape.
jest.mock('../src/models/profiles', () => ({
  DEDUCTION_SECTIONS: ['80C', '80D'],
  findProfile: jest.fn(),
  saveProfile: jest.fn(),
}));
jest.mock('../src/models/taxConfig', () => ({
  listTaxYears: jest.fn(),
  loadTaxConfig: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { findProfile, saveProfile } = require('../src/models/profiles');
const { listTaxYears, loadTaxConfig } = require('../src/models/taxConfig');
const taxConfig = require('./fixtures/taxConfig');

const auth = `Bearer ${jwt.sign({ userId: 5 }, 'test-secret')}`;

const savedProfile = {
  fy: '2026-27',
  grossSalary: 1200000,
  otherIncome: 0,
  basicSalary: 0,
  hraReceived: 0,
  rentPaid: 0,
  isMetro: false,
  deductions: { '80C': 200000, '80D': 30000 },
};

beforeEach(() => {
  jest.resetAllMocks();
  listTaxYears.mockResolvedValue(['2026-27', '2025-26']);
});

describe('GET /api/profile/:fy', () => {
  test('requires a token (401)', async () => {
    const res = await request(app).get('/api/profile/2026-27');
    expect(res.status).toBe(401);
  });

  test('rejects a badly formed year (400)', async () => {
    const res = await request(app).get('/api/profile/2026-28').set('Authorization', auth);
    expect(res.status).toBe(400);
  });

  test('returns 404 when nothing is saved yet', async () => {
    findProfile.mockResolvedValue(null);
    const res = await request(app).get('/api/profile/2026-27').set('Authorization', auth);
    expect(res.status).toBe(404);
    expect(findProfile).toHaveBeenCalledWith(5, '2026-27'); // scoped to the token's user
  });

  test('returns the saved profile (200)', async () => {
    findProfile.mockResolvedValue(savedProfile);
    const res = await request(app).get('/api/profile/2026-27').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.profile).toEqual(savedProfile);
  });
});

describe('PUT /api/profile/:fy', () => {
  test('saves the profile, filling blanks with 0 (200)', async () => {
    const res = await request(app)
      .put('/api/profile/2026-27')
      .set('Authorization', auth)
      .send({ grossSalary: 1200000, deductions: { '80C': 50000 } });

    expect(res.status).toBe(200);
    expect(saveProfile).toHaveBeenCalledWith(5, '2026-27', {
      grossSalary: 1200000,
      otherIncome: 0,
      basicSalary: 0,
      hraReceived: 0,
      rentPaid: 0,
      isMetro: false,
      deductions: { '80C': 50000, '80D': 0 },
    });
  });

  test.each([
    ['a negative amount', { grossSalary: -1 }],
    ['a string amount', { grossSalary: '1200000' }],
    ['a non-boolean isMetro', { grossSalary: 100, isMetro: 'yes' }],
    ['a negative deduction', { grossSalary: 100, deductions: { '80C': -5 } }],
    ['basic salary above gross salary', { grossSalary: 100, basicSalary: 200 }],
  ])('rejects %s (400)', async (_label, body) => {
    const res = await request(app).put('/api/profile/2026-27').set('Authorization', auth).send(body);
    expect(res.status).toBe(400);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  test('rejects a year with no tax rules (400)', async () => {
    const res = await request(app)
      .put('/api/profile/2030-31')
      .set('Authorization', auth)
      .send({ grossSalary: 100 });
    expect(res.status).toBe(400);
    expect(saveProfile).not.toHaveBeenCalled();
  });
});

describe('GET /api/tax/compare/:fy', () => {
  test('returns 404 when the year has no tax rules', async () => {
    loadTaxConfig.mockResolvedValue(null);
    const res = await request(app).get('/api/tax/compare/2030-31').set('Authorization', auth);
    expect(res.status).toBe(404);
  });

  test('returns 404 when the user has not saved income for that year', async () => {
    loadTaxConfig.mockResolvedValue(taxConfig);
    findProfile.mockResolvedValue(null);
    const res = await request(app).get('/api/tax/compare/2026-27').set('Authorization', auth);
    expect(res.status).toBe(404);
  });

  test('returns both regimes and the recommendation (200)', async () => {
    loadTaxConfig.mockResolvedValue(taxConfig);
    findProfile.mockResolvedValue(savedProfile);

    const res = await request(app).get('/api/tax/compare/2026-27').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.old.totalTax).toBe(111800);
    expect(res.body.new.totalTax).toBe(0);
    expect(res.body.recommended).toBe('new');
    expect(res.body.savings).toBe(111800);
    expect(res.body.new.slabBreakdown).toHaveLength(7);
  });
});

describe('GET /api/tax/years', () => {
  test('lists the years that have rules', async () => {
    const res = await request(app).get('/api/tax/years').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.years).toEqual(['2026-27', '2025-26']);
  });
});
