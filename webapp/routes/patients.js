// Patient routes

const express = require('express');
const db = require('../db');
const config = require('../config');
const { ROLES, requireLogin, requireRole, visibleElderlyIds, canSeeElderly, inList } = require('../lib/auth');
const { evaluate } = require('../lib/ingest');
const { createAlert } = require('../lib/alerts');
const { createUser } = require('../lib/users');

const router = express.Router();
router.use(requireLogin);

// Access check
async function guard(req, res) {
  if (!(await canSeeElderly(req.session.user, req.params.id))) {
    res.status(403).json({ error: 'You are not assigned to this person.' });
    return false;
  }
  return true;
}

// Patient list
router.get('/', async (req, res) => {
  const ids = await visibleElderlyIds(req.session.user);
  const people = await db.query(
    `SELECT e.elderly_id, u.full_name, e.date_of_birth, e.gender,
            TIMESTAMPDIFF(YEAR, e.date_of_birth, CURDATE()) AS age,
            (SELECT COUNT(*) FROM tbl_alert a WHERE a.elderly_id = e.elderly_id AND a.status = 'Open') AS open_alerts
     FROM tbl_elderly_profile e JOIN tbl_user u ON u.user_id = e.user_id
     WHERE e.elderly_id ${inList(ids)} ORDER BY u.full_name`,
    ids
  );
  for (const p of people) {
    p.latest = await db.one(
      `SELECT h.* FROM tbl_health_reading h JOIN tbl_device d ON d.device_id = h.device_id
       WHERE d.elderly_id = ? ORDER BY h.recorded_at DESC, h.reading_id DESC LIMIT 1`,
      [p.elderly_id]
    );
    p.check = p.latest ? await evaluate(p.elderly_id, p.latest) : null;
  }
  res.json({ people });
});

// Register an elderly person
router.post('/', requireRole(ROLES.CAREGIVER, ROLES.PROVIDER, ROLES.ADMIN), async (req, res) => {
  const result = await createUser({ ...req.body, role_name: ROLES.ELDERLY });
  if (result.error) return res.status(400).json({ error: result.error });
  const e = await db.one('SELECT elderly_id FROM tbl_elderly_profile WHERE user_id = ?', [result.userId]);
  const me = req.session.user;
  // Link to the person who registered them
  if (me.role_name === ROLES.CAREGIVER) {
    await db.query(
      'INSERT INTO tbl_caregiver_assignment (caregiver_id, elderly_id) SELECT caregiver_id, ? FROM tbl_caregiver WHERE user_id = ?',
      [e.elderly_id, me.user_id]
    );
  } else if (me.role_name === ROLES.PROVIDER) {
    await db.query(
      'INSERT INTO tbl_provider_assignment (provider_id, elderly_id) SELECT provider_id, ? FROM tbl_healthcare_provider WHERE user_id = ?',
      [e.elderly_id, me.user_id]
    );
  }
  await db.log(me.user_id, 'Registered elderly person', req.body.full_name);
  res.json({ elderly_id: e.elderly_id });
});

// Weekly trend
router.get('/weekly-trend', async (req, res) => {
  const ids = await visibleElderlyIds(req.session.user);
  const rows = await db.query(
    `SELECT d.elderly_id, u.full_name, DATE(h.recorded_at) AS day,
            ROUND(AVG(h.heart_rate_bpm), 1) AS avg_hr
     FROM tbl_health_reading h
     JOIN tbl_device d ON d.device_id = h.device_id
     JOIN tbl_elderly_profile e ON e.elderly_id = d.elderly_id
     JOIN tbl_user u ON u.user_id = e.user_id
     WHERE d.elderly_id ${inList(ids)} AND h.recorded_at >= CURDATE() - INTERVAL 6 DAY
     GROUP BY d.elderly_id, u.full_name, DATE(h.recorded_at) ORDER BY day`,
    ids
  );
  res.json({ rows });
});

router.get('/:id', async (req, res) => {
  if (!(await guard(req, res))) return;
  const id = req.params.id;
  const profile = await db.one(
    `SELECT e.*, u.full_name, u.email, u.phone_number,
            TIMESTAMPDIFF(YEAR, e.date_of_birth, CURDATE()) AS age
     FROM tbl_elderly_profile e JOIN tbl_user u ON u.user_id = e.user_id WHERE e.elderly_id = ?`,
    [id]
  );
  const thresholds = await db.query(
    `SELECT t.vital_type, t.min_value, t.max_value, t.updated_at, u.full_name AS set_by
     FROM tbl_threshold t
     LEFT JOIN tbl_healthcare_provider p ON p.provider_id = t.provider_id
     LEFT JOIN tbl_user u ON u.user_id = p.user_id
     WHERE t.elderly_id = ?`,
    [id]
  );
  const devices = await db.query('SELECT * FROM tbl_device WHERE elderly_id = ?', [id]);
  const caregivers = await db.query(
    `SELECT u.full_name, u.phone_number, c.relationship FROM tbl_caregiver_assignment ca
     JOIN tbl_caregiver c ON c.caregiver_id = ca.caregiver_id JOIN tbl_user u ON u.user_id = c.user_id
     WHERE ca.elderly_id = ?`,
    [id]
  );
  const providers = await db.query(
    `SELECT u.full_name, p.specialization FROM tbl_provider_assignment pa
     JOIN tbl_healthcare_provider p ON p.provider_id = pa.provider_id JOIN tbl_user u ON u.user_id = p.user_id
     WHERE pa.elderly_id = ?`,
    [id]
  );
  res.json({ profile, thresholds, devices, caregivers, providers, vitals: config.VITALS });
});

// Readings for chart
router.get('/:id/readings', async (req, res) => {
  if (!(await guard(req, res))) return;
  const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 168);
  const rows = await db.query(
    `SELECT DATE_FORMAT(h.recorded_at, '%Y-%m-%d %H:%i:00') AS t,
            ROUND(AVG(h.heart_rate_bpm)) AS heart_rate_bpm,
            ROUND(AVG(h.temperature_c), 1) AS temperature_c,
            ROUND(AVG(h.spo2_percent)) AS spo2_percent
     FROM tbl_health_reading h JOIN tbl_device d ON d.device_id = h.device_id
     WHERE d.elderly_id = ? AND h.recorded_at >= NOW() - INTERVAL ? HOUR
     GROUP BY t ORDER BY t`,
    [req.params.id, hours]
  );
  const latest = await db.query(
    `SELECT h.* FROM tbl_health_reading h JOIN tbl_device d ON d.device_id = h.device_id
     WHERE d.elderly_id = ? ORDER BY h.recorded_at DESC, h.reading_id DESC LIMIT 60`,
    [req.params.id]
  );
  const last = latest[0];
  res.json({ perMinute: rows, recent: latest.reverse(), check: last ? await evaluate(req.params.id, last) : null });
});

// Update profile
router.put('/:id', async (req, res) => {
  if (!(await guard(req, res))) return;
  const f = req.body;
  if (!f.full_name || !f.date_of_birth || !f.emergency_contact_name || !f.emergency_contact_phone) {
    return res.status(400).json({ error: 'Name, date of birth and emergency contact are required.' });
  }
  const p = await db.one('SELECT user_id FROM tbl_elderly_profile WHERE elderly_id = ?', [req.params.id]);
  await db.query('UPDATE tbl_user SET full_name = ?, phone_number = ? WHERE user_id = ?', [
    f.full_name.trim(), f.phone_number || null, p.user_id,
  ]);
  await db.query(
    `UPDATE tbl_elderly_profile SET date_of_birth = ?, gender = ?, address = ?, medical_history = ?,
       emergency_contact_name = ?, emergency_contact_phone = ? WHERE elderly_id = ?`,
    [f.date_of_birth, f.gender || null, f.address || null, f.medical_history || null,
      f.emergency_contact_name, f.emergency_contact_phone, req.params.id]
  );
  await db.log(req.session.user.user_id, 'Updated elderly profile', f.full_name);
  res.json({ ok: true });
});

// Update thresholds
router.put('/:id/thresholds', requireRole(ROLES.PROVIDER, ROLES.ADMIN), async (req, res) => {
  if (!(await guard(req, res))) return;
  const provider = await db.one('SELECT provider_id FROM tbl_healthcare_provider WHERE user_id = ?', [
    req.session.user.user_id,
  ]);
  const changes = [];
  for (const vital of Object.keys(config.VITALS)) {
    const t = (req.body.thresholds || {})[vital];
    if (!t) continue;
    const min = Number(t.min_value);
    const max = Number(t.max_value);
    if (Number.isNaN(min) || Number.isNaN(max) || min >= max) {
      return res.status(400).json({ error: `${config.VITALS[vital].label}: the minimum must be lower than the maximum.` });
    }
    await db.query(
      `INSERT INTO tbl_threshold (elderly_id, provider_id, vital_type, min_value, max_value) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE provider_id = VALUES(provider_id), min_value = VALUES(min_value), max_value = VALUES(max_value)`,
      [req.params.id, provider ? provider.provider_id : null, vital, min, max]
    );
    changes.push(`${config.VITALS[vital].label} ${min}-${max}`);
  }
  await db.log(req.session.user.user_id, 'Updated thresholds', `Elderly #${req.params.id}: ${changes.join(', ')}`);
  res.json({ ok: true });
});

// Panic button
router.post('/panic', requireRole(ROLES.ELDERLY), async (req, res) => {
  const elderlyId = req.session.user.elderly_id;
  if (!elderlyId) return res.status(400).json({ error: 'No elderly profile found for this account.' });
  const alert = await createAlert({
    elderlyId,
    alertType: 'Panic',
    severity: 'Critical',
    message: 'Panic button pressed',
  });
  await db.log(req.session.user.user_id, 'Pressed panic button', `Alert #${alert.alert_id}`);
  res.json({ alert });
});

module.exports = router;
