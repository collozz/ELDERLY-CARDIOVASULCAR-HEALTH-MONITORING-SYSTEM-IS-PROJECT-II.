// Shared helpers

const VITALS = {
  heart_rate_bpm: { label: 'Heart rate', short: 'HR', unit: 'BPM' },
  temperature_c: { label: 'Body temperature', short: 'Temp', unit: '°C' },
  spo2_percent: { label: 'Blood oxygen (SpO₂)', short: 'SpO₂', unit: '%' },
};

const ROLE = {
  ADMIN: 'Administrator',
  ELDERLY: 'Elderly Person',
  CAREGIVER: 'Caregiver',
  PROVIDER: 'Healthcare Provider',
};

// Menus per role
const MENUS = {
  [ROLE.ADMIN]: [['dashboard.html', 'Dashboard'], ['patients.html', 'Elderly'], ['alerts.html', 'Alerts'], ['reports.html', 'Reports'], ['admin.html', 'Administration'], ['settings.html', 'Settings']],
  [ROLE.CAREGIVER]: [['dashboard.html', 'Dashboard'], ['patients.html', 'My Elderly'], ['alerts.html', 'Alerts'], ['reports.html', 'Reports'], ['settings.html', 'Settings']],
  [ROLE.PROVIDER]: [['dashboard.html', 'Dashboard'], ['patients.html', 'My Patients'], ['alerts.html', 'Alerts'], ['reports.html', 'Reports'], ['settings.html', 'Settings']],
  [ROLE.ELDERLY]: [['my-health.html', 'My Health'], ['alerts.html', 'My Alerts'], ['reports.html', 'My Reports'], ['settings.html', 'Settings']],
};

const homePage = (user) => (user.role_name === ROLE.ELDERLY ? 'my-health.html' : 'dashboard.html');

// API
async function api(path, options = {}) {
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && !path.startsWith('/api/auth/login')) {
    location.href = 'login.html';
    throw new Error('Please log in.');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// Form values
function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

// Formatting
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Dates
function parseDate(s) {
  return s ? new Date(String(s).replace(' ', 'T')) : null;
}
function fmtTime(s) {
  const d = parseDate(s);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–';
}
function fmtDateTime(s) {
  const d = parseDate(s);
  return d ? d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–';
}
function timeAgo(s) {
  const d = parseDate(s);
  if (!d) return '';
  const sec = Math.max(0, Math.round((Date.now() - d) / 1000));
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  return `${Math.round(sec / 86400)} days ago`;
}
function initials(name) {
  return String(name || '?').replace(/^Dr\.?\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
// Status labels
function sevClass(severity) {
  return severity ? severity.toLowerCase() : 'normal';
}
function sevText(severity) {
  return severity || 'Normal';
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
}

function showMsg(el, text, ok = false) {
  el.hidden = !text;
  el.className = `msg ${ok ? 'ok' : 'error'}`;
  el.textContent = text || '';
}

// Page setup
async function startPage(active, allowed = []) {
  let user;
  try {
    user = (await api('/api/auth/me')).user;
  } catch (e) {
    return null;
  }
  if (allowed.length && !allowed.includes(user.role_name)) {
    location.href = homePage(user);
    return null;
  }

  $('#topbar').innerHTML = `
    <a class="brand" href="${homePage(user)}"><span class="heart" aria-hidden="true">♥</span> Elderly Heart Monitor</a>
    <div class="user-menu">
      <span class="conn" title="Connection to the ESP32"><span class="dot" id="conn-dot"></span><span class="conn-text" id="conn-text">Connecting…</span></span>
      <span class="who-am-i"><span class="role">${esc(user.role_name)}:</span> ${esc(user.full_name)}</span>
      <button class="btn light small install-btn" type="button" hidden>Install app</button>
      <button class="btn light small" id="logout-btn" type="button">Log out</button>
    </div>`;
  $('#nav').innerHTML = (MENUS[user.role_name] || [])
    .map(([href, label]) => `<a href="${href}" class="${href === active ? 'active' : ''}" data-short="${label === 'Administration' ? 'Admin' : label}">${label}</a>`)
    .join('');
  $('#logout-btn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = 'login.html';
  });
  showInstallButtons();
  return user;
}

// Live updates
function connectLive(handlers = {}) {
  const es = new EventSource('/api/live');
  es.addEventListener('status', (e) => {
    const s = JSON.parse(e.data);
    const dot = $('#conn-dot');
    const text = $('#conn-text');
    if (!dot) return;
    if (s.deviceLive) {
      dot.className = 'dot live';
      text.textContent = 'Live from ESP32';
    } else {
      dot.className = 'dot backup';
      text.textContent = 'Simulated readings';
    }
  });
  es.addEventListener('reading', (e) => handlers.reading && handlers.reading(JSON.parse(e.data)));
  es.addEventListener('alert', (e) => {
    const a = JSON.parse(e.data);
    toast(`${a.alert_type === 'Panic' ? 'PANIC' : a.severity + ' alert'}: ${a.full_name}. ${a.message}`);
    if (handlers.alert) handlers.alert(a);
  });
  es.onerror = () => {
    const dot = $('#conn-dot');
    if (dot) { dot.className = 'dot'; $('#conn-text').textContent = 'Reconnecting…'; }
  };
  return es;
}

// Offline app support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Install button
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  showInstallButtons();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  showInstallButtons();
});
function showInstallButtons() {
  for (const btn of $$('.install-btn')) {
    btn.hidden = !installPrompt;
    btn.onclick = async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      showInstallButtons();
    };
  }
}

// Online / offline notice
function updateOnline() {
  let bar = $('#offline-bar');
  if (navigator.onLine) {
    if (bar) bar.hidden = true;
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'offline-bar';
    bar.className = 'offline-bar';
    bar.textContent = 'You are offline. Readings will update when the connection is back.';
    document.body.prepend(bar);
  }
  bar.hidden = false;
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
window.addEventListener('load', updateOnline);

// Phone notifications
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;

function urlKey(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function currentPushSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function enablePush() {
  if (!pushSupported()) throw new Error('This browser cannot show notifications here. Use Chrome or Edge, on localhost or an https link.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in the browser site settings.');
  await navigator.serviceWorker.register('sw.js');
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api('/api/notify/push-key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlKey(publicKey) });
  await api('/api/notify/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
  return sub;
}

async function disablePush() {
  const sub = await currentPushSub();
  if (!sub) return;
  await api('/api/notify/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}
