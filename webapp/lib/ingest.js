// Save and check readings

const db = require('../db');
const config = require('../config');
const live = require('./live');
const { createAlert } = require('./alerts');

// Check against thresholds
async function evaluate(elderlyId, reading) {
  const thresholds = await db.query(
    `SELECT vital_type, min_value, max_value FROM tbl_threshold WHERE elderly_id = ?
     ORDER BY FIELD(vital_type, 'heart_rate_bpm', 'temperature_c', 'spo2_percent')`,
    [elderlyId]
  );
  const statuses = {};
  const problems = [];
  let severity = null;
  for (const t of thresholds) {
    const value = reading[t.vital_type];
    if (value === null || value === undefined) continue;
    if (value < t.min_value || value > t.max_value) {
      const high = value > t.max_value;
      const margin = config.CRITICAL_MARGIN[t.vital_type] || 0;
      const critical = high ? value > t.max_value + margin : value < t.min_value - margin;
      statuses[t.vital_type] = 'alert';
      const v = config.VITALS[t.vital_type];
      problems.push(`${v.label} too ${high ? 'high' : 'low'}: ${value} ${v.unit}`);
      if (critical) severity = 'Critical';
      else if (!severity) severity = 'Warning';
    } else {
      statuses[t.vital_type] = 'normal';
    }
  }
  return { statuses, problems, severity };
}

// Device that gets the readings
async function findDevice(serial) {
  if (serial) {
    return db.one(`SELECT device_id, elderly_id FROM tbl_device WHERE serial_number = ? AND status = 'Active'`, [serial]);
  }
  // Real ESP32 sends no serial, so use the Active device
  return activeDevice();
}

// The one Active device and who wears it
function activeDevice() {
  return db.one(
    `SELECT d.device_id, d.elderly_id, d.serial_number, u.full_name FROM tbl_device d
     JOIN tbl_elderly_profile e ON e.elderly_id = d.elderly_id JOIN tbl_user u ON u.user_id = e.user_id
     WHERE d.status = 'Active' ORDER BY d.last_synced_at DESC, d.device_id LIMIT 1`
  );
}

async function saveReading(raw, source) {
  if (raw.panic) return savePanic(raw);
  const reading = {
    heart_rate_bpm: Math.round(Number(raw.heart_rate_bpm)),
    temperature_c: raw.temperature_c === undefined ? null : Number(raw.temperature_c),
    spo2_percent: raw.spo2_percent === undefined ? null : Number(raw.spo2_percent),
  };
  if (Number.isNaN(reading.heart_rate_bpm)) return null;

  const device = await findDevice(raw.serial_number);
  if (!device) {
    console.log('Reading ignored: no Active device. Set one to Active on the Admin > Devices page.');
    return null;
  }

  const result = await db.query(
    `INSERT INTO tbl_health_reading (device_id, heart_rate_bpm, temperature_c, spo2_percent) VALUES (?, ?, ?, ?)`,
    [device.device_id, reading.heart_rate_bpm, reading.temperature_c, reading.spo2_percent]
  );
  await db.query('UPDATE tbl_device SET last_synced_at = NOW() WHERE device_id = ?', [device.device_id]);
  const saved = await db.one('SELECT * FROM tbl_health_reading WHERE reading_id = ?', [result.insertId]);

  const check = await evaluate(device.elderly_id, saved);
  let alert = null;
  if (check.severity) {
    // Skip if a recent alert is open
    const recent = await db.one(
      `SELECT alert_id FROM tbl_alert WHERE elderly_id = ? AND alert_type = 'Threshold' AND status <> 'Resolved'
       AND triggered_at > NOW() - INTERVAL ? SECOND`,
      [device.elderly_id, Math.round(config.ALERT_COOLDOWN_MS / 1000)]
    );
    if (!recent) {
      alert = await createAlert({
        elderlyId: device.elderly_id,
        readingId: saved.reading_id,
        alertType: 'Threshold',
        severity: check.severity,
        message: check.problems.join('; ').slice(0, 255),
      });
    }
  }

  live.send('reading', { ...saved, elderly_id: device.elderly_id, source, ...check }, device.elderly_id);
  return { reading: saved, alert };
}

// Panic button on the device
async function savePanic(raw) {
  const device = await findDevice(raw.serial_number);
  if (!device) return null;
  const alert = await createAlert({
    elderlyId: device.elderly_id,
    alertType: 'Panic',
    severity: 'Critical',
    message: 'Panic button pressed on device',
  });
  return { alert };
}

module.exports = { saveReading, evaluate, activeDevice };
