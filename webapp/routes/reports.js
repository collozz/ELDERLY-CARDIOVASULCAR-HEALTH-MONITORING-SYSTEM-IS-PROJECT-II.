// Report routes

const express = require('express');
const db = require('../db');
const { requireLogin, canSeeElderly } = require('../lib/auth');

const router = express.Router();
router.use(requireLogin);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validate filters
async function params(req, res) {
  const { elderly_id, from, to } = req.query;
  if (!elderly_id || !DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
    res.status(400).json({ error: 'Choose a person and a date range.' });
    return null;
  }
  if (from > to) {
    res.status(400).json({ error: 'The start date must be before the end date.' });
    return null;
  }
  if (!(await canSeeElderly(req.session.user, elderly_id))) {
    res.status(403).json({ error: 'You are not assigned to this person.' });
    return null;
  }
  return [Number(elderly_id), `${from} 00:00:00`, `${to} 23:59:59`];
}

router.get('/summary', async (req, res) => {
  const p = await params(req, res);
  if (!p) return;

  const stats = await db.one(
    `SELECT COUNT(*) AS readings,
            ROUND(AVG(h.heart_rate_bpm), 1) AS hr_avg, MIN(h.heart_rate_bpm) AS hr_min, MAX(h.heart_rate_bpm) AS hr_max,
            ROUND(AVG(h.temperature_c), 1) AS temp_avg, MIN(h.temperature_c) AS temp_min, MAX(h.temperature_c) AS temp_max,
            ROUND(AVG(h.spo2_percent), 1) AS spo2_avg, MIN(h.spo2_percent) AS spo2_min, MAX(h.spo2_percent) AS spo2_max
     FROM tbl_health_reading h JOIN tbl_device d ON d.device_id = h.device_id
     WHERE d.elderly_id = ? AND h.recorded_at BETWEEN ? AND ?`,
    p
  );

  // Out of range counts
  const outside = await db.query(
    `SELECT t.vital_type, t.min_value, t.max_value,
            SUM(CASE t.vital_type
                  WHEN 'heart_rate_bpm' THEN h.heart_rate_bpm NOT BETWEEN t.min_value AND t.max_value
                  WHEN 'temperature_c'  THEN h.temperature_c  NOT BETWEEN t.min_value AND t.max_value
                  WHEN 'spo2_percent'   THEN h.spo2_percent   NOT BETWEEN t.min_value AND t.max_value
                END) AS count_outside
     FROM tbl_threshold t
     JOIN tbl_device d ON d.elderly_id = t.elderly_id
     JOIN tbl_health_reading h ON h.device_id = d.device_id
     WHERE t.elderly_id = ? AND h.recorded_at BETWEEN ? AND ?
     GROUP BY t.vital_type, t.min_value, t.max_value`,
    p
  );

  const alerts = await db.query(
    `SELECT alert_type, severity, status, COUNT(*) AS count FROM tbl_alert
     WHERE elderly_id = ? AND triggered_at BETWEEN ? AND ?
     GROUP BY alert_type, severity, status ORDER BY alert_type, severity, status`,
    p
  );

  const daily = await db.query(
    `SELECT DATE_FORMAT(h.recorded_at, '%Y-%m-%d') AS day,
            ROUND(AVG(h.heart_rate_bpm), 1) AS hr_avg, MIN(h.heart_rate_bpm) AS hr_min, MAX(h.heart_rate_bpm) AS hr_max,
            ROUND(AVG(h.temperature_c), 1) AS temp_avg, ROUND(AVG(h.spo2_percent), 1) AS spo2_avg, COUNT(*) AS readings
     FROM tbl_health_reading h JOIN tbl_device d ON d.device_id = h.device_id
     WHERE d.elderly_id = ? AND h.recorded_at BETWEEN ? AND ?
     GROUP BY day ORDER BY day`,
    p
  );

  // Notifications sent
  const notifications = await db.query(
    `SELECT n.channel, n.status, COUNT(*) AS count FROM tbl_notification n
     JOIN tbl_alert a ON a.alert_id = n.alert_id
     WHERE a.elderly_id = ? AND a.triggered_at BETWEEN ? AND ?
     GROUP BY n.channel, n.status ORDER BY n.channel, n.status`,
    p
  );

  // Alert log
  const alertLog = await db.query(
    `SELECT alert_id, alert_type, severity, message, status, triggered_at FROM tbl_alert
     WHERE elderly_id = ? AND triggered_at BETWEEN ? AND ? ORDER BY triggered_at DESC LIMIT 50`,
    p
  );

  res.json({ stats, outside, alerts, daily, notifications, alertLog });
});

router.get('/export.csv', async (req, res) => {
  const p = await params(req, res);
  if (!p) return;
  const person = await db.one(
    'SELECT u.full_name FROM tbl_elderly_profile e JOIN tbl_user u ON u.user_id = e.user_id WHERE e.elderly_id = ?',
    [p[0]]
  );
  const rows = await db.query(
    `SELECT h.recorded_at, h.heart_rate_bpm, h.temperature_c, h.spo2_percent, d.serial_number
     FROM tbl_health_reading h JOIN tbl_device d ON d.device_id = h.device_id
     WHERE d.elderly_id = ? AND h.recorded_at BETWEEN ? AND ? ORDER BY h.recorded_at`,
    p
  );
  const lines = ['recorded_at,heart_rate_bpm,temperature_c,spo2_percent,device_serial'];
  for (const r of rows) lines.push([r.recorded_at, r.heart_rate_bpm, r.temperature_c ?? '', r.spo2_percent ?? '', r.serial_number].join(','));
  const name = person.full_name.replace(/[^A-Za-z0-9]+/g, '-');
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', `attachment; filename="readings-${name}-${req.query.from}-to-${req.query.to}.csv"`);
  res.send(lines.join('\n'));
});

module.exports = router;
