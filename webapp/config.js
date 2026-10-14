// All system settings live here.

module.exports = {
  PORT: process.env.PORT || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'change-this-secret-before-deploying',

  // MySQL (XAMPP defaults: user root, no password).
  // DB_NAME must match the database you created in phpMyAdmin.
  DB: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cardiovascular monitoring project',
  },

  // Must match MQTT_TOPIC in wokwi/sketch.ino
  MQTT_URL: process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883',
  MQTT_TOPIC: 'strathmore/167071/elderly-monitor/vitals',

  // Readings that arrive without a serial number are saved against this device
  // (it belongs to Mary Wanjiru Kamau in the sample data).
  DEFAULT_DEVICE_SERIAL: 'WOKWI-ESP32-001',

  // If no reading arrives from Wokwi for this long, the built-in simulator
  // sends readings for the default device so the system never goes quiet.
  FALLBACK_AFTER_MS: 10000,
  READ_INTERVAL_MS: 3000,

  // A new threshold alert is not raised for the same person while an
  // earlier one is still open and younger than this.
  ALERT_COOLDOWN_MS: 2 * 60 * 1000,

  // How far outside the threshold a value must be to count as Critical
  // rather than Warning.
  CRITICAL_MARGIN: { heart_rate_bpm: 20, temperature_c: 0.7, spo2_percent: 2 },

  // Thresholds given to a newly registered elderly person
  // (a healthcare provider can change them later).
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

  // SMS is simulated: messages are saved and printed in the terminal.
  // Set to 'africastalking' later and fill in the keys to send real SMS.
  SMS_MODE: 'simulate',
};
