// Creating alerts and the notifications (dashboard + SMS) that go with them.

const db = require('../db');
const config = require('../config');
const live = require('./live');

// Everyone who should hear about this elderly person's alerts:
// assigned caregivers (SMS + dashboard) and assigned providers (dashboard).
async function recipients(elderlyId) {
  const caregivers = await db.query(
    `SELECT u.user_id, u.full_name, u.phone_number FROM tbl_caregiver_assignment ca
     JOIN tbl_caregiver c ON c.caregiver_id = ca.caregiver_id
     JOIN tbl_user u ON u.user_id = c.user_id WHERE ca.elderly_id = ?`,
    [elderlyId]
  );
  const providers = await db.query(
    `SELECT u.user_id, u.full_name, u.phone_number FROM tbl_provider_assignment pa
     JOIN tbl_healthcare_provider p ON p.provider_id = pa.provider_id
     JOIN tbl_user u ON u.user_id = p.user_id WHERE pa.elderly_id = ?`,
    [elderlyId]
  );
  return { caregivers, providers };
}

// SMS gateway. In 'simulate' mode the message is printed and marked as Sent.
async function sendSms(phone, message) {
  if (config.SMS_MODE === 'simulate') {
    console.log(`[SMS to ${phone || 'no phone'}] ${message}`);
    return phone ? 'Sent' : 'Failed';
  }
  // A real gateway (e.g. Africa's Talking) would be called here.
  return 'Pending';
}

async function createAlert({ elderlyId, readingId = null, alertType, severity, message }) {
  const result = await db.query(
    `INSERT INTO tbl_alert (elderly_id, reading_id, alert_type, severity, message) VALUES (?, ?, ?, ?, ?)`,
    [elderlyId, readingId, alertType, severity, message]
  );
  const alertId = result.insertId;

  const person = await db.one(
    `SELECT u.full_name FROM tbl_elderly_profile e JOIN tbl_user u ON u.user_id = e.user_id WHERE e.elderly_id = ?`,
    [elderlyId]
  );
  const name = person ? person.full_name : `Patient ${elderlyId}`;
  const { caregivers, providers } = await recipients(elderlyId);
  const smsText = `${alertType === 'Panic' ? 'PANIC' : 'ALERT'}: ${name} - ${message}. Please check on them.`.slice(0, 255);

  for (const u of [...caregivers, ...providers]) {
    await db.query(
      `INSERT INTO tbl_notification (alert_id, recipient_user_id, channel, message, status, sent_at)
       VALUES (?, ?, 'Dashboard', ?, 'Sent', NOW())`,
      [alertId, u.user_id, `${severity} alert for ${name}: ${message}`.slice(0, 255)]
    );
  }
  for (const u of caregivers) {
    const status = await sendSms(u.phone_number, smsText);
    await db.query(
      `INSERT INTO tbl_notification (alert_id, recipient_user_id, channel, message, status, sent_at)
       VALUES (?, ?, 'SMS', ?, ?, ${status === 'Sent' ? 'NOW()' : 'NULL'})`,
      [alertId, u.user_id, smsText, status]
    );
  }

  const alert = await db.one('SELECT * FROM tbl_alert WHERE alert_id = ?', [alertId]);
  live.send('alert', { ...alert, full_name: name }, elderlyId);
  return alert;
}

module.exports = { createAlert };
