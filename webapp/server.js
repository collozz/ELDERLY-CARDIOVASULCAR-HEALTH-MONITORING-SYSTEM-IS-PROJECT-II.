// Main server

const express = require('express');
const session = require('express-session');
const mqtt = require('mqtt');
const path = require('path');
const config = require('./config');
const db = require('./db');
const live = require('./lib/live');
const { saveReading } = require('./lib/ingest');
const { requireLogin } = require('./lib/auth');

const SIMULATE_ONLY = process.argv.includes('--simulate');

const app = express();
app.use(express.json());
app.use(
  session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
  })
);

app.get('/', (req, res) => res.redirect('/login.html'));
// App files
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders(res, file) {
      if (file.endsWith('sw.js')) res.set('Cache-Control', 'no-cache');
      if (file.endsWith('.webmanifest')) res.set('Content-Type', 'application/manifest+json');
    },
  })
);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notify', require('./routes/notify'));
app.get('/api/live', requireLogin, live.connect);
app.get('/api/status', requireLogin, (req, res) => res.json(live.getStatus()));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  const dbDown = ['ECONNREFUSED', 'ER_BAD_DB_ERROR', 'ER_ACCESS_DENIED_ERROR'].includes(err.code);
  res.status(500).json({
    error: dbDown ? 'Cannot reach the database. Check that MySQL is running in XAMPP.' : 'Something went wrong on the server.',
  });
});

// MQTT readings from Wokwi
let lastDeviceReading = 0;
let lastMqttError = '';

if (!SIMULATE_ONLY) {
  const client = mqtt.connect(config.MQTT_URL, { reconnectPeriod: 3000 });
  client.on('connect', () => {
    console.log(`MQTT connected, listening on ${config.MQTT_TOPIC}`);
    client.subscribe(config.MQTT_TOPIC);
    live.setStatus({ mqttConnected: true });
  });
  client.on('close', () => live.setStatus({ mqttConnected: false }));
  client.on('error', (err) => {
    if (err.message !== lastMqttError) console.log('MQTT error:', err.message);
    lastMqttError = err.message;
  });
  client.on('message', async (_topic, payload) => {
    try {
      lastDeviceReading = Date.now();
      await saveReading(JSON.parse(payload.toString()), 'wokwi');
    } catch (err) {
      console.log('Could not save reading:', err.message);
    }
  });
}

// Backup simulator
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

// Start an abnormal episode
app.post('/api/simulate-episode', require('./lib/auth').requireRole('Administrator'), (req, res) => {
  sim.episode = 8;
  res.json({ ok: true });
});

setInterval(async () => {
  const deviceLive = !SIMULATE_ONLY && Date.now() - lastDeviceReading < config.FALLBACK_AFTER_MS;
  live.setStatus({ deviceLive, simulateOnly: SIMULATE_ONLY });
  if (deviceLive) return;
  try {
    await saveReading(simulateReading(), 'simulator');
  } catch (err) {
    console.log('Simulator could not save reading:', err.message);
  }
}, config.READ_INTERVAL_MS);

// Start server
db.query('SELECT 1')
  .then(() => console.log(`Connected to MySQL database "${config.DB.database}"`))
  .catch((err) =>
    console.log(`\n*** Cannot connect to MySQL (${err.code}). Start MySQL in XAMPP and check DB settings in config.js ***\n`)
  );

app.listen(config.PORT, () => {
  console.log(`Open http://localhost:${config.PORT} in your browser`);
  if (SIMULATE_ONLY) console.log('Running with the built-in simulator only (no Wokwi).');
});
