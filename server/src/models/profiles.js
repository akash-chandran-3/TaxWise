// SQL for income_profiles + deductions.
const db = require('../db');

const DEDUCTION_SECTIONS = ['80C', '80D'];

// One profile row joined to its deduction rows. LEFT JOIN so a profile with
// no deductions still comes back (section/amount are just NULL).
async function findProfile(userId, fy) {
  const [rows] = await db.execute(
    `SELECT p.fy, p.gross_salary, p.other_income, p.basic_salary,
            p.hra_received, p.rent_paid, p.is_metro, d.section, d.amount
       FROM income_profiles p
       LEFT JOIN deductions d ON d.profile_id = p.id
      WHERE p.user_id = ? AND p.fy = ?`,
    [userId, fy]
  );
  if (rows.length === 0) return null;

  const deductions = { '80C': 0, '80D': 0 };
  for (const row of rows) {
    if (row.section) deductions[row.section] = row.amount;
  }

  const p = rows[0];
  return {
    fy: p.fy,
    grossSalary: p.gross_salary,
    otherIncome: p.other_income,
    basicSalary: p.basic_salary,
    hraReceived: p.hra_received,
    rentPaid: p.rent_paid,
    isMetro: Boolean(p.is_metro),
    deductions,
  };
}

// Insert-or-update the profile and its deductions. A transaction makes the
// writes all-or-nothing: we never end up with a profile but stale deductions.
async function saveProfile(userId, fy, profile) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO income_profiles
         (user_id, fy, gross_salary, other_income, basic_salary, hra_received, rent_paid, is_metro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) AS incoming
       ON DUPLICATE KEY UPDATE
         gross_salary = incoming.gross_salary,
         other_income = incoming.other_income,
         basic_salary = incoming.basic_salary,
         hra_received = incoming.hra_received,
         rent_paid    = incoming.rent_paid,
         is_metro     = incoming.is_metro`,
      [userId, fy, profile.grossSalary, profile.otherIncome, profile.basicSalary,
        profile.hraReceived, profile.rentPaid, profile.isMetro]
    );

    // insertId isn't reliable after an UPDATE, so look the id up.
    const [[{ id: profileId }]] = await conn.execute(
      'SELECT id FROM income_profiles WHERE user_id = ? AND fy = ?',
      [userId, fy]
    );

    for (const section of DEDUCTION_SECTIONS) {
      await conn.execute(
        `INSERT INTO deductions (profile_id, section, amount) VALUES (?, ?, ?) AS incoming
         ON DUPLICATE KEY UPDATE amount = incoming.amount`,
        [profileId, section, profile.deductions[section]]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release(); // always hand the connection back to the pool
  }
}

module.exports = { DEDUCTION_SECTIONS, findProfile, saveProfile };
