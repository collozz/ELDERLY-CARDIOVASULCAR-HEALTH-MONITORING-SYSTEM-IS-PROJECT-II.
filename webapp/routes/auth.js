// Login, logout, registration and password change

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ROLES, requireLogin } = require('../lib/auth');
const { createUser } = require('../lib/users');

const router = express.Router();

async function loadSessionUser(userId) {
  return db.one(
    `SELECT u.user_id, u.full_name, u.email, u.phone_number, r.role_name, e.elderly_id
     FROM tbl_user u JOIN tbl_role r ON r.role_id = u.role_id
     LEFT JOIN tbl_elderly_profile e ON e.user_id = u.user_id
     WHERE u.user_id = ?`,
    [userId]
  );
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const row = await db.one('SELECT user_id, password_hash FROM tbl_user WHERE email = ?', [String(email || '').trim()]);
  if (!row || !(await bcrypt.compare(String(password || ''), row.password_hash))) {
    return res.status(400).json({ error: 'Wrong email or password.' });
  }
  req.session.user = await loadSessionUser(row.user_id);
  await db.log(row.user_id, 'Logged in');
  res.json({ user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireLogin, (req, res) => res.json({ user: req.session.user }));

// Self-registration. Administrators are only created by another administrator.
router.post('/register', async (req, res) => {
  if (req.body.role_name === ROLES.ADMIN) return res.status(400).json({ error: 'Choose a role.' });
  const result = await createUser(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  await db.log(result.userId, 'Registered', `Role: ${req.body.role_name}`);
  req.session.user = await loadSessionUser(result.userId);
  res.json({ user: req.session.user });
});

router.post('/change-password', requireLogin, async (req, res) => {
  const { current_password, new_password } = req.body;
  const row = await db.one('SELECT password_hash FROM tbl_user WHERE user_id = ?', [req.session.user.user_id]);
  if (!(await bcrypt.compare(String(current_password || ''), row.password_hash))) {
    return res.status(400).json({ error: 'Your current password is wrong.' });
  }
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'The new password must be at least 8 characters.' });
  }
  await db.query('UPDATE tbl_user SET password_hash = ? WHERE user_id = ?', [
    await bcrypt.hash(new_password, 10),
    req.session.user.user_id,
  ]);
  await db.log(req.session.user.user_id, 'Changed password');
  res.json({ ok: true });
});

router.post('/profile', requireLogin, async (req, res) => {
  const full_name = String(req.body.full_name || '').trim();
  const phone_number = String(req.body.phone_number || '').trim() || null;
  if (!full_name) return res.status(400).json({ error: 'Enter your full name.' });
  await db.query('UPDATE tbl_user SET full_name = ?, phone_number = ? WHERE user_id = ?', [
    full_name,
    phone_number,
    req.session.user.user_id,
  ]);
  req.session.user = await loadSessionUser(req.session.user.user_id);
  res.json({ user: req.session.user });
});

module.exports = router;
