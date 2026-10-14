// Dashboard page

const VITALS = ['heart_rate_bpm', 'temperature_c', 'spo2_percent'];
const STATUS_TEXT = { normal: 'Normal', alert: 'Alert' };
const COLORS = { normal: '#1f9d55', alert: '#c53030' };

let thresholds = {};
let history = [];
let alerts = [];

const $ = (sel, root = document) => root.querySelector(sel);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString();

async function init() {
  thresholds = (await (await fetch('/api/config')).json()).thresholds;
  for (const key of VITALS) {
    const t = thresholds[key];
    $(`#vital-${key} .range`).textContent = `Normal range: ${t.min_value} – ${t.max_value} ${t.unit}`;
  }

  const latest = await (await fetch('/api/latest')).json();
  history = latest.history;
  alerts = latest.alerts;
  showStatus(latest.status);
  if (history.length) showReading(history[history.length - 1]);
  renderAlerts();

  const events = new EventSource('/events');
  events.addEventListener('reading', (e) => {
    const reading = JSON.parse(e.data);
    history.push(reading);
    if (history.length > 60) history.shift();
    if (reading.overall !== 'normal') {
      alerts.unshift({ time: reading.time, level: reading.overall, message: reading.problems.map((p) => p.text).join(' · ') });
      alerts = alerts.slice(0, 20);
      renderAlerts();
    }
    showReading(reading);
  });
  events.addEventListener('status', (e) => showStatus(JSON.parse(e.data)));
  events.onerror = () => showStatus(null);
}

function showReading(r) {
  for (const key of VITALS) {
    const card = $(`#vital-${key}`);
    const status = r.statuses[key];
    $('.value', card).textContent = r[key];
    card.className = `card vital ${status}`;
    const pill = $('.pill', card);
    pill.className = `pill ${status}`;
    pill.textContent = STATUS_TEXT[status];
    drawChart($('canvas', card), key);
  }

  const banner = $('#banner');
  banner.className = `banner ${r.overall}`;
  if (r.overall === 'normal') {
    $('#banner-title').textContent = 'All readings normal';
    $('#banner-detail').textContent = '';
  } else {
    $('#banner-title').textContent = '⚠ EMERGENCY ALERT';
    $('#banner-detail').textContent = r.problems.map((p) => p.text).join(' · ');
  }

  $('#last-update').textContent = fmtTime(r.time);
  $('#source').textContent = r.source === 'wokwi' ? 'Wokwi ESP32 (MQTT)' : 'Built-in simulator';
}

function showStatus(s) {
  const dot = $('#conn-dot');
  const text = $('#conn-text');
  if (!s) {
    dot.className = 'dot';
    text.textContent = 'Server offline, reconnecting…';
  } else if (s.deviceLive) {
    dot.className = 'dot live';
    text.textContent = 'Live from Wokwi ESP32';
  } else {
    dot.className = 'dot backup';
    text.textContent = s.simulateOnly ? 'Built-in simulator' : 'Waiting for Wokwi, using built-in simulator';
  }
}

function renderAlerts() {
  const list = $('#alerts');
  if (!alerts.length) {
    list.innerHTML = '<li class="muted">No alerts yet.</li>';
    return;
  }
  list.innerHTML = '';
  for (const a of alerts) {
    const li = document.createElement('li');
    li.className = a.level;
    li.innerHTML = `<span class="time">${fmtTime(a.time)}</span>${STATUS_TEXT[a.level]}: `;
    li.append(document.createTextNode(a.message));
    list.append(li);
  }
}

// Chart
function drawChart(canvas, key) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = 60;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const values = history.map((r) => r[key]);
  if (values.length < 2) return;
  const t = thresholds[key];
  const lo = Math.min(...values, t.min_value) - 1;
  const hi = Math.max(...values, t.max_value) + 1;
  const pad = 4;
  const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (h - 2 * pad);

  ctx.fillStyle = 'rgba(31,157,85,0.08)';
  ctx.fillRect(0, y(t.max_value), w, y(t.min_value) - y(t.max_value));

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / 59) * w;
    i ? ctx.lineTo(x, y(v)) : ctx.moveTo(x, y(v));
  });
  ctx.strokeStyle = COLORS[history[history.length - 1].statuses[key]];
  ctx.lineWidth = 2;
  ctx.stroke();
}

$('#episode-btn').addEventListener('click', () => fetch('/api/simulate-episode', { method: 'POST' }));

init();
