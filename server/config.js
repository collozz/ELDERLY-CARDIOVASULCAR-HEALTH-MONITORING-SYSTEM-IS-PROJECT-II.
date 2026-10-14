// Prototype settings

module.exports = {
  PORT: process.env.PORT || 3000,

  // MQTT
  MQTT_URL: process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883',
  MQTT_TOPIC: 'strathmore/167071/elderly-monitor/vitals',

  // Backup simulator timing
  FALLBACK_AFTER_MS: 10000,
  READ_INTERVAL_MS: 3000,

  HISTORY_SIZE: 60,

  // Thresholds
  THRESHOLDS: {
    heart_rate_bpm: { vital_type: 'heart_rate_bpm', label: 'Heart rate', unit: 'BPM', min_value: 50, max_value: 100 },
    temperature_c: { vital_type: 'temperature_c', label: 'Body temperature', unit: '°C', min_value: 35.5, max_value: 37.8 },
    spo2_percent: { vital_type: 'spo2_percent', label: 'Blood oxygen (SpO₂)', unit: '%', min_value: 92, max_value: 100 },
  },
};
