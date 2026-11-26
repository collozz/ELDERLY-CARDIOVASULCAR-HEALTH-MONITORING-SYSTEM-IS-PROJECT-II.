// System settings

require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });

module.exports = {
  PORT: process.env.PORT || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'change-this-secret-before-deploying',

  // MySQL database
  DB: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cardiovascular monitoring project',
  },

  // MQTT
  MQTT_URL: process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883',
  MQTT_TOPIC: 'strathmore/167071/elderly-monitor/vitals',

  // Default device
  DEFAULT_DEVICE_SERIAL: 'ESP32-001',

  // Backup simulator timing
  FALLBACK_AFTER_MS: 10000,
  READ_INTERVAL_MS: 3000,

  // Time between alerts
  ALERT_COOLDOWN_MS: 30 * 1000,

  // Critical alert margins
  CRITICAL_MARGIN: { heart_rate_bpm: 20, temperature_c: 0.7, spo2_percent: 2 },

  // Default thresholds
  DEFAULT_THRESHOLDS: {
    heart_rate_bpm: { min_value: 50, max_value: 100 },
    temperature_c: { min_value: 35.5, max_value: 37.8 },
    spo2_percent: { min_value: 92, max_value: 100 },
  },

  VITALS: {
    heart_rate_bpm: { label: 'Heart rate', unit: 'BPM' },
    temperature_c: { label: 'Body temperature', unit: '°C' },
    spo2_percent: { label: 'Blood oxygen (SpO₂)', unit: '%' },
  },

  // SMS gateway (Africa's Talking)
  SMS: {
    USERNAME: process.env.AT_USERNAME || 'sandbox',
    API_KEY: process.env.AT_API_KEY || '',
    SENDER_ID: process.env.AT_SENDER_ID || '',
  },
};
