// SMS gateway

const config = require('../config');

const mode = () => (config.SMS.API_KEY ? (config.SMS.USERNAME === 'sandbox' ? 'sandbox' : 'live') : 'simulate');

// Kenyan numbers to +254 format
function normalisePhone(phone) {
  let p = String(phone || '').replace(/[\s-]/g, '');
  if (/^0[17]\d{8}$/.test(p)) p = '+254' + p.slice(1);
  if (/^254\d{9}$/.test(p)) p = '+' + p;
  return /^\+\d{9,15}$/.test(p) ? p : null;
}

// Reason the last SMS failed
let lastError = '';

// Send one SMS, returns 'Sent' or 'Failed'
async function sendSms(phone, message) {
  const to = normalisePhone(phone);
  lastError = '';
  if (!to) {
    console.log(`[SMS not sent] invalid phone number "${phone || ''}"`);
    return 'Failed';
  }
  if (mode() === 'simulate') {
    console.log(`[SMS simulated to ${to}] ${message}`);
    return 'Sent';
  }
  const host = mode() === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
  const body = new URLSearchParams({ username: config.SMS.USERNAME, to, message });
  if (config.SMS.SENDER_ID) body.set('from', config.SMS.SENDER_ID);
  try {
    const res = await fetch(`https://${host}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: config.SMS.API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch (e) {}
    const r = ((data.SMSMessageData || {}).Recipients || [])[0];
    const ok = res.ok && r && (r.status === 'Success' || [100, 101, 102].includes(r.statusCode));
    lastError = ok ? '' : r ? r.status : data.errorMessage || text.slice(0, 120);
    console.log(`[SMS ${ok ? 'sent' : 'failed'} to ${to}] ${r ? r.status : text.slice(0, 120)}`);
    return ok ? 'Sent' : 'Failed';
  } catch (err) {
    lastError = err.message;
    console.log(`[SMS failed to ${to}] ${err.message}`);
    return 'Failed';
  }
}

module.exports = { sendSms, normalisePhone, mode, lastError: () => lastError };
