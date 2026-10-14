// Elderly Heart Rate Monitoring and Emergency Alert System - prototype server (Node.js + Express)
//
// Data path: Wokwi ESP32 -> MQTT broker -> this server -> dashboard (Server-Sent Events)

const express = require('express');
const mqtt = require('mqtt');
const path = require('path');
const config = require('./config');

const SIMULATE_ONLY = process.argv.includes('--simulate');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const history = []; // latest readings, newest last
const alerts = []; // latest alerts, newest first
const clients = new Set(); // open dashboard connections
let lastDeviceReading = 0; // time of last reading from Wokwi
let mqttConnected = false;
let lastMqttError = '';

// ---------- Vital-sign status detection ----------
// Each vital is compared with its configured min_value / max_value.
function evaluate(reading) {
  const statuses = {};
  const problems = [];
  for (const [key, t] of Object.entries(config.THRESHOLDS)) {
    const value = reading[key];
    if (value < t.min_value || value > t.max_value) {
      statuses[key] = 'alert';
      const dir = value > t.max_value ? 'too high' : 'too low';
      problems.push({ vital_type: key, text: `${t.label} ${dir}: ${value} ${t.unit}` });
    } else {
      statuses[key] = 'normal';
    }
  }
  return { statuses, overall: problems.length ? 'alert' : 'normal', problems };
}

// ---------- Handle each new reading ----------
function handleReading(raw, source) {
  const reading = {
    patient_id: raw.patient_id || 'P001',
    heart_rate_bpm: Number(raw.heart_rate_bpm),
    temperature_c: Number(raw.temperature_c),
    spo2_percent: Number(raw.spo2_percent),
    source,
    time: new Date().toISOString(),
  };
  if ([reading.heart_rate_bpm, reading.temperature_c, reading.spo2_percent].some(Number.isNaN)) return;

  Object.assign(reading, evaluate(reading));
  history.push(reading);
  if (history.length > config.HISTORY_SIZE) history.shift();

  if (reading.overall !== 'normal') {
    const alert = {
      time: reading.time,
      level: reading.overall,
      message: reading.problems.map((p) => p.text).join(' · '),
    };
    alerts.unshift(alert);
    if (alerts.length > 20) alerts.pop();
    console.log(`[ALERT] ${alert.message}`);
  }

  broadcast('reading', reading);
}

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

function connectionInfo() {
  const deviceLive = Date.now() - lastDeviceReading < config.FALLBACK_AFTER_MS;
  return { mqttConnected, deviceLive, simulateOnly: SIMULATE_ONLY };
}

// ---------- MQTT: readings from the Wokwi ESP32 ----------
if (!SIMULATE_ONLY) {
  const client = mqtt.connect(config.MQTT_URL, { reconnectPeriod: 3000 });
  client.on('connect', () => {
    mqttConnected = true;
    console.log(`MQTT connected, listening on ${config.MQTT_TOPIC}`);
    client.subscribe(config.MQTT_TOPIC);
    broadcast('status', connectionInfo());
  });
  client.on('close', () => {
    if (mqttConnected) console.log('MQTT disconnected, retrying...');
    mqttConnected = false;
  });
  client.on('error', (err) => {
    if (err.message !== lastMqttError) console.log('MQTT error:', err.message);
    lastMqttError = err.message;
  });
  client.on('message', (_topic, payload) => {
    try {
      lastDeviceReading = Date.now();
      handleReading(JSON.parse(payload.toString()), 'wokwi');
    } catch (e) {
      console.log('Ignored bad message:', payload.toString());
    }
  });
}

// ---------- Built-in simulator (backup when Wokwi is not sending) ----------
const sim = { heart_rate_bpm: 75, temperature_c: 36.6, spo2_percent: 97, episode: 0 };
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const drift = (v, target, step, pull) => v + rand(-step, step) + (target - v) * pull;

function simulateReading() {
  if (sim.episode > 0) {
    sim.heart_rate_bpm = drift(sim.heart_rate_bpm, 128, 4, 0.35);
    sim.temperature_c = drift(sim.temperature_c, 38.6, 0.1, 0.35);
    sim.spo2_percent = drift(sim.spo2_percent, 88, 0.6, 0.35);
    sim.episode--;
  } else {
    sim.heart_rate_bpm = drift(sim.heart_rate_bpm, 74, 3, 0.15);
    sim.temperature_c = drift(sim.temperature_c, 36.7, 0.08, 0.15);
    sim.spo2_percent = drift(sim.spo2_percent, 97, 0.5, 0.15);
    if (Math.random() < 0.01) sim.episode = 8;
  }
  sim.spo2_percent = Math.min(sim.spo2_percent, 100);
  return {
    heart_rate_bpm: Math.round(sim.heart_rate_bpm),
    temperature_c: Math.round(sim.temperature_c * 10) / 10,
    spo2_percent: Math.round(sim.spo2_percent),
  };
}

setInterval(() => {
  if (SIMULATE_ONLY || !connectionInfo().deviceLive) handleReading(simulateReading(), 'simulator');
  broadcast('status', connectionInfo());
}, config.READ_INTERVAL_MS);

// ---------- HTTP API ----------
app.get('/api/config', (_req, res) => res.json({ thresholds: config.THRESHOLDS }));
app.get('/api/latest', (_req, res) => res.json({ history, alerts, status: connectionInfo() }));

// Demo helper: force an abnormal episode in the built-in simulator
app.post('/api/simulate-episode', (_req, res) => {
  sim.episode = 8;
  res.json({ ok: true });
});

// Live stream of readings to the dashboard
app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: status\ndata: ${JSON.stringify(connectionInfo())}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.listen(config.PORT, () => {
  console.log(`Dashboard: http://localhost:${config.PORT}`);
  if (SIMULATE_ONLY) console.log('Running with the built-in simulator only (no Wokwi).');
});
