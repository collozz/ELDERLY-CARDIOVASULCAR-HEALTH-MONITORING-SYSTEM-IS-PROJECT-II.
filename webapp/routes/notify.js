// Notification routes

const express = require('express');
const db = require('../db');
const push = require('../lib/push');
const sms = require('../lib/sms');
const { ROLES, requireLogin, requireRole } = require('../lib/auth');

const router = express.Router();
router.use(requireLogin);

// Phone notifications
router.get('/push-key', (req, res) => res.json({ publicKey: push.publicKey }));

router.post('/subscribe', (req, res) => {
  const sub = req.body.subscription;
  if (!sub || !sub.endpoint || !sub.keys) return res.status(400).json({ error: 'Invalid subscription.' });
  push.subscribe(req.session.user.user_id, sub);
  res.json({ ok: true });
});

router.post('/unsubscribe', (req, res) => {
  if (req.body.endpoint) push.unsubscribe(req.body.endpoint);
  res.json({ ok: true });
});

router.post('/test-push', async (req, res) => {
  const sent = await push.notifyUsers([req.session.user.user_id], {
    title: 'Test notification',
    body: 'Alerts will show up on this device like this.',
    url: '/settings.html',
    tag: 'test',
  });
  if (!sent) return res.status(400).json({ error: 'No device is set up for notifications yet.' });
  res.json({ sent });
});

// SMS gateway
router.get('/sms-status', requireRole(ROLES.ADMIN), (req, res) => res.json({ mode: sms.mode() }));

router.post('/test-sms', requireRole(ROLES.ADMIN), async (req, res) => {
  const phone = req.body.phone || req.session.user.phone_number;
  if (!sms.normalisePhone(phone)) return res.status(400).json({ error: 'Enter a phone number like +2547XXXXXXXX or 07XXXXXXXX.' });
  const status = await sms.sendSms(phone, 'Test message from the Elderly Heart Monitor system.');
  const reason = sms.lastError();
  await db.log(req.session.user.user_id, 'Sent test SMS', `${phone}: ${status}${reason ? ` (${reason})` : ''}`);
  if (status !== 'Sent') {
    const hints = {
      UserInBlacklist: 'This number blocks promotional/bulk SMS. Allow promotional messages on the line or use another number.',
      InsufficientBalance: 'The Africa\'s Talking account has no credit. Top up and try again.',
      InvalidPhoneNumber: 'The phone number is not valid. Use the format +2547XXXXXXXX.',
      'The supplied authentication is invalid': 'The API key or username is wrong. Check AT_USERNAME and AT_API_KEY in .env.',
    };
    return res.status(502).json({ error: `The SMS gateway did not accept the message (${reason || 'unknown reason'}). ${hints[reason] || 'See the server window for details.'}` });
  }
  res.json({ ok: true, mode: sms.mode() });
});

module.exports = router;
