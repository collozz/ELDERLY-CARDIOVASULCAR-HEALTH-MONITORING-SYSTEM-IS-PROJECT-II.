// Phone and browser notifications

const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const DATA_DIR = path.join(__dirname, '..', 'data');
const KEYS_FILE = path.join(DATA_DIR, 'vapid-keys.json');
const SUBS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

// Keys are made once and kept
let keys;
try {
  keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
} catch (e) {
  keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}
webpush.setVapidDetails('mailto:admin@heartmonitor.test', keys.publicKey, keys.privateKey);

let subs = [];
try {
  subs = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
} catch (e) {}
const save = () => fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));

function subscribe(userId, subscription) {
  subs = subs.filter((s) => s.subscription.endpoint !== subscription.endpoint);
  subs.push({ userId, subscription });
  save();
}

function unsubscribe(endpoint) {
  subs = subs.filter((s) => s.subscription.endpoint !== endpoint);
  save();
}

// Send to every device of these users
async function notifyUsers(userIds, payload) {
  const targets = subs.filter((s) => userIds.includes(s.userId));
  let sent = 0;
  await Promise.all(
    targets.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) unsubscribe(s.subscription.endpoint);
        else console.log('Push failed:', err.message);
      }
    })
  );
  return sent;
}

module.exports = { publicKey: keys.publicKey, subscribe, unsubscribe, notifyUsers };
