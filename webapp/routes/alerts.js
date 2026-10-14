// Alert routes

const express = require('express');
const db = require('../db');
const { ROLES, requireLogin, requireRole, visibleElderlyIds, canSeeElderly, inList } = require('../lib/auth');

const router = express.Router();
router.use(requireLogin);

const STATUSES = ['Open', 'Acknowledged', 'Resolved'];

router.get('/', async (req, res) => {
  const ids = await visibleElderlyIds(req.session.user);
  const where = [`a.elderly_id ${inList(ids)}`];
  const params = [...ids];
  if (STATUSES.includes(req.query.status)) {
    where.push('a.status = ?');
    params.push(req.query.status);
  }
  if (['Threshold', 'Panic'].includes(req.query.type)) {
    where.push('a.alert_type = ?');
    params.push(req.query.type);
  }
  if (req.query.elderly_id) {
    where.push('a.elderly_id = ?');
    params.push(Number(req.query.elderly_id));
  }
  const alerts = await db.query(
    `SELECT a.*, u.full_name
     FROM tbl_alert a
     JOIN tbl_elderly_profile e ON e.elderly_id = a.elderly_id
     JOIN tbl_user u ON u.user_id = e.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.triggered_at DESC, a.alert_id DESC LIMIT 200`,
    params
  );
  // Delivery status
  for (const a of alerts) {
    const rows = await db.query(
      `SELECT n.channel, n.status, u.full_name AS recipient FROM tbl_notification n
       JOIN tbl_user u ON u.user_id = n.recipient_user_id WHERE n.alert_id = ?`,
      [a.alert_id]
    );
    a.notifications = rows;
  }
  res.json({ alerts });
});

// Update alert status
router.post('/:id/status', requireRole(ROLES.CAREGIVER, ROLES.PROVIDER, ROLES.ADMIN), async (req, res) => {
  const status = req.body.status;
  if (!['Acknowledged', 'Resolved'].includes(status)) return res.status(400).json({ error: 'Unknown status.' });
  const alert = await db.one('SELECT elderly_id FROM tbl_alert WHERE alert_id = ?', [req.params.id]);
  if (!alert || !(await canSeeElderly(req.session.user, alert.elderly_id))) {
    return res.status(404).json({ error: 'Alert not found.' });
  }
  await db.query('UPDATE tbl_alert SET status = ? WHERE alert_id = ?', [status, req.params.id]);
  await db.log(req.session.user.user_id, `${status} alert`, `Alert #${req.params.id}`);
  res.json({ ok: true });
});

module.exports = router;
