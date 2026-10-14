// Creating users together with their profile (used by Register and by the admin "Add user" form).

const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { ROLES } = require('./auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v) {
  return typeof v === 'string' ? v.trim() : v;
}

// Returns an error message, or null if the form is valid
function validate(f) {
  if (!f.full_name) return 'Enter the full name.';
  if (!f.email || !EMAIL_RE.test(f.email)) return 'Enter a valid email address.';
  if (!f.password || f.password.length < 8) return 'The password must be at least 8 characters.';
  if (!Object.values(ROLES).includes(f.role_name)) return 'Choose a role.';
  if (f.role_name === ROLES.ELDERLY) {
    if (!f.date_of_birth) return 'Enter the date of birth.';
    if (!f.emergency_contact_name || !f.emergency_contact_phone) return 'Enter an emergency contact name and phone number.';
  }
  if (f.role_name === ROLES.PROVIDER && !f.license_number) return 'Enter the medical license number.';
  return null;
}

async function createUser(form) {
  const f = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, clean(v)]));
  const error = validate(f);
  if (error) return { error };

  if (await db.one('SELECT user_id FROM tbl_user WHERE email = ?', [f.email])) {
    return { error: 'An account with this email already exists.' };
  }
  const role = await db.one('SELECT role_id FROM tbl_role WHERE role_name = ?', [f.role_name]);
  const hash = await bcrypt.hash(f.password, 10);

  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const [u] = await conn.execute(
      'INSERT INTO tbl_user (role_id, full_name, email, phone_number, password_hash) VALUES (?, ?, ?, ?, ?)',
      [role.role_id, f.full_name, f.email, f.phone_number || null, hash]
    );
    const userId = u.insertId;

    if (f.role_name === ROLES.ELDERLY) {
      const [e] = await conn.execute(
        `INSERT INTO tbl_elderly_profile (user_id, date_of_birth, gender, address, medical_history,
           emergency_contact_name, emergency_contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, f.date_of_birth, f.gender || null, f.address || null, f.medical_history || null,
          f.emergency_contact_name, f.emergency_contact_phone]
      );
      for (const [vital, t] of Object.entries(config.DEFAULT_THRESHOLDS)) {
        await conn.execute(
          'INSERT INTO tbl_threshold (elderly_id, vital_type, min_value, max_value) VALUES (?, ?, ?, ?)',
          [e.insertId, vital, t.min_value, t.max_value]
        );
      }
    } else if (f.role_name === ROLES.CAREGIVER) {
      await conn.execute('INSERT INTO tbl_caregiver (user_id, relationship) VALUES (?, ?)', [userId, f.relationship || null]);
    } else if (f.role_name === ROLES.PROVIDER) {
      await conn.execute(
        'INSERT INTO tbl_healthcare_provider (user_id, specialization, license_number) VALUES (?, ?, ?)',
        [userId, f.specialization || null, f.license_number]
      );
    }
    await conn.commit();
    return { userId };
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return { error: 'That license number is already registered.' };
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createUser };
