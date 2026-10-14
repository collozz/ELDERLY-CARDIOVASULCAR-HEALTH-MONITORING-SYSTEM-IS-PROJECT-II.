// Login and access checks

const db = require('../db');

const ROLES = {
  ADMIN: 'Administrator',
  ELDERLY: 'Elderly Person',
  CAREGIVER: 'Caregiver',
  PROVIDER: 'Healthcare Provider',
};

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Please log in.' });
    if (!roles.includes(req.session.user.role_name)) {
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }
    next();
  };
}

// Elderly people this user can see
async function visibleElderlyIds(user) {
  let rows;
  if (user.role_name === ROLES.ADMIN) {
    rows = await db.query('SELECT elderly_id FROM tbl_elderly_profile');
  } else if (user.role_name === ROLES.ELDERLY) {
    rows = await db.query('SELECT elderly_id FROM tbl_elderly_profile WHERE user_id = ?', [user.user_id]);
  } else if (user.role_name === ROLES.CAREGIVER) {
    rows = await db.query(
      `SELECT ca.elderly_id FROM tbl_caregiver_assignment ca
       JOIN tbl_caregiver c ON c.caregiver_id = ca.caregiver_id WHERE c.user_id = ?`,
      [user.user_id]
    );
  } else if (user.role_name === ROLES.PROVIDER) {
    rows = await db.query(
      `SELECT pa.elderly_id FROM tbl_provider_assignment pa
       JOIN tbl_healthcare_provider p ON p.provider_id = pa.provider_id WHERE p.user_id = ?`,
      [user.user_id]
    );
  } else {
    rows = [];
  }
  return rows.map((r) => r.elderly_id);
}

async function canSeeElderly(user, elderlyId) {
  return (await visibleElderlyIds(user)).includes(Number(elderlyId));
}

// SQL IN list
function inList(ids) {
  return ids.length ? `IN (${ids.map(() => '?').join(', ')})` : 'IN (NULL)';
}

module.exports = { ROLES, requireLogin, requireRole, visibleElderlyIds, canSeeElderly, inList };
