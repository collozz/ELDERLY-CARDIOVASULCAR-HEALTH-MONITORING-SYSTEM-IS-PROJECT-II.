// Administrator: users, devices, assignments and the activity log

const express = require('express');
const db = require('../db');
const { ROLES, requireRole } = require('../lib/auth');
const { createUser } = require('../lib/users');

const router = express.Router();
router.use(requireRole(ROLES.ADMIN));

router.get('/overview', async (req, res) => {
  const counts = await db.one(
    `SELECT (SELECT COUNT(*) FROM tbl_user) AS users,
            (SELECT COUNT(*) FROM tbl_elderly_profile) AS elderly,
            (SELECT COUNT(*) FROM tbl_device WHERE status = 'Active') AS active_devices,
            (SELECT COUNT(*) FROM tbl_alert WHERE status = 'Open') AS open_alerts,
            (SELECT COUNT(*) FROM tbl_health_reading WHERE recorded_at >= CURDATE()) AS readings_today`
  );
  res.json({ counts });
});

// ---------- Users ----------
router.get('/users', async (req, res) => {
  const users = await db.query(
    `SELECT u.user_id, u.full_name, u.email, u.phone_number, u.created_at, r.role_name
     FROM tbl_user u JOIN tbl_role r ON r.role_id = u.role_id ORDER BY r.role_id, u.full_name`
  );
  res.json({ users });
});

router.post('/users', async (req, res) => {
  const result = await createUser(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  await db.log(req.session.user.user_id, 'Created user', `${req.body.full_name} (${req.body.role_name})`);
  res.json({ userId: result.userId });
});

router.delete('/users/:id', async (req, res) => {
  if (Number(req.params.id) === req.session.user.user_id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  const u = await db.one('SELECT full_name FROM tbl_user WHERE user_id = ?', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  await db.query('DELETE FROM tbl_user WHERE user_id = ?', [req.params.id]);
  await db.log(req.session.user.user_id, 'Deleted user', u.full_name);
  res.json({ ok: true });
});

// Lists for the dropdowns on the admin forms
router.get('/options', async (req, res) => {
  const elderly = await db.query(
    `SELECT e.elderly_id AS id, u.full_name AS name FROM tbl_elderly_profile e
     JOIN tbl_user u ON u.user_id = e.user_id ORDER BY u.full_name`
  );
  const caregivers = await db.query(
    `SELECT c.caregiver_id AS id, u.full_name AS name FROM tbl_caregiver c
     JOIN tbl_user u ON u.user_id = c.user_id ORDER BY u.full_name`
  );
  const providers = await db.query(
    `SELECT p.provider_id AS id, u.full_name AS name FROM tbl_healthcare_provider p
     JOIN tbl_user u ON u.user_id = p.user_id ORDER BY u.full_name`
  );
  res.json({ elderly, caregivers, providers });
});

// ---------- Devices ----------
router.get('/devices', async (req, res) => {
  const devices = await db.query(
    `SELECT d.*, u.full_name FROM tbl_device d
     JOIN tbl_elderly_profile e ON e.elderly_id = d.elderly_id
     JOIN tbl_user u ON u.user_id = e.user_id ORDER BY d.device_id`
  );
  res.json({ devices });
});

router.post('/devices', async (req, res) => {
  const { elderly_id, device_type, serial_number } = req.body;
  if (!elderly_id || !device_type || !serial_number) {
    return res.status(400).json({ error: 'Choose a person and enter the device type and serial number.' });
  }
  try {
    await db.query('INSERT INTO tbl_device (elderly_id, device_type, serial_number) VALUES (?, ?, ?)', [
      elderly_id, device_type.trim(), serial_number.trim(),
    ]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'A device with this serial number already exists.' });
    throw err;
  }
  await db.log(req.session.user.user_id, 'Registered device', serial_number);
  res.json({ ok: true });
});

router.put('/devices/:id', async (req, res) => {
  const { status, elderly_id } = req.body;
  if (!['Active', 'Inactive', 'Faulty'].includes(status) || !elderly_id) {
    return res.status(400).json({ error: 'Choose a person and a valid status.' });
  }
  await db.query('UPDATE tbl_device SET status = ?, elderly_id = ? WHERE device_id = ?', [status, elderly_id, req.params.id]);
  await db.log(req.session.user.user_id, 'Updated device', `Device #${req.params.id}: ${status}`);
  res.json({ ok: true });
});

// ---------- Caregiver / provider assignments ----------
const ASSIGN = {
  caregiver: { table: 'tbl_caregiver_assignment', col: 'caregiver_id' },
  provider: { table: 'tbl_provider_assignment', col: 'provider_id' },
};

router.get('/assignments', async (req, res) => {
  const caregivers = await db.query(
    `SELECT a.assignment_id, 'caregiver' AS type, cu.full_name AS person, c.relationship AS detail,
            eu.full_name AS elderly, a.assigned_at
     FROM tbl_caregiver_assignment a
     JOIN tbl_caregiver c ON c.caregiver_id = a.caregiver_id JOIN tbl_user cu ON cu.user_id = c.user_id
     JOIN tbl_elderly_profile e ON e.elderly_id = a.elderly_id JOIN tbl_user eu ON eu.user_id = e.user_id`
  );
  const providers = await db.query(
    `SELECT a.assignment_id, 'provider' AS type, pu.full_name AS person, p.specialization AS detail,
            eu.full_name AS elderly, a.assigned_at
     FROM tbl_provider_assignment a
     JOIN tbl_healthcare_provider p ON p.provider_id = a.provider_id JOIN tbl_user pu ON pu.user_id = p.user_id
     JOIN tbl_elderly_profile e ON e.elderly_id = a.elderly_id JOIN tbl_user eu ON eu.user_id = e.user_id`
  );
  res.json({ assignments: [...caregivers, ...providers] });
});

router.post('/assignments', async (req, res) => {
  const a = ASSIGN[req.body.type];
  const { person_id, elderly_id } = req.body;
  if (!a || !person_id || !elderly_id) return res.status(400).json({ error: 'Choose who to assign and to whom.' });
  try {
    await db.query(`INSERT INTO ${a.table} (${a.col}, elderly_id) VALUES (?, ?)`, [person_id, elderly_id]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'This assignment already exists.' });
    throw err;
  }
  await db.log(req.session.user.user_id, 'Assigned ' + req.body.type, `#${person_id} to elderly #${elderly_id}`);
  res.json({ ok: true });
});

router.delete('/assignments/:type/:id', async (req, res) => {
  const a = ASSIGN[req.params.type];
  if (!a) return res.status(400).json({ error: 'Unknown assignment type.' });
  await db.query(`DELETE FROM ${a.table} WHERE assignment_id = ?`, [req.params.id]);
  await db.log(req.session.user.user_id, 'Removed ' + req.params.type + ' assignment', `#${req.params.id}`);
  res.json({ ok: true });
});

// ---------- Activity log ----------
router.get('/activity', async (req, res) => {
  const rows = await db.query(
    `SELECT l.log_id, l.action, l.details, l.logged_at, u.full_name
     FROM tbl_activity_log l JOIN tbl_user u ON u.user_id = l.user_id
     ORDER BY l.logged_at DESC, l.log_id DESC LIMIT 200`
  );
  res.json({ rows });
});

module.exports = router;
