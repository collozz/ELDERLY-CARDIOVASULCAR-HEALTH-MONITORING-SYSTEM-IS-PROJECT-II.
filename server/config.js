// All prototype settings live here. Change thresholds in this one place.

module.exports = {
  PORT: process.env.PORT || 3000,

  // Must match MQTT_TOPIC in wokwi/sketch.ino
  MQTT_URL: process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883',
  MQTT_TOPIC: 'strathmore/167071/elderly-monitor/vitals',

  // If no reading arrives from Wokwi for this long, the server generates
  // its own readings so the dashboard never goes blank during a demo.
  // Start with `npm run simulate` to use only the built-in simulator.
  FALLBACK_AFTER_MS: 10000,
  READ_INTERVAL_MS: 3000,

  HISTORY_SIZE: 60, // readings kept for the chart (60 x 3 s = 3 minutes)

  // Vital-sign thresholds for an elderly person at rest (prototype values).
  // Same shape as the Threshold entity in the ERD: one row per vital_type
  // with min_value and max_value. A reading outside the range raises an alert.
  THRESHOLDS: {
    heart_rate_bpm: { vital_type: 'heart_rate_bpm', label: 'Heart rate', unit: 'BPM', min_value: 50, max_value: 100 },
    temperature_c: { vital_type: 'temperature_c', label: 'Body temperature', unit: '°C', min_value: 35.5, max_value: 37.8 },
    spo2_percent: { vital_type: 'spo2_percent', label: 'Blood oxygen (SpO₂)', unit: '%', min_value: 92, max_value: 100 },
  },
};
