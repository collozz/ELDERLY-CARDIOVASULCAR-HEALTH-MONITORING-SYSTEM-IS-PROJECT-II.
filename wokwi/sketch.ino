/*
 * Elderly Heart Rate Monitor - simulated ESP32 sensor node (Wokwi)
 * IS Project: Web-Based IoT-Enabled Heart Rate Monitoring and
 * Emergency Alert System for Elderly Patients
 *
 * Every 3 seconds the ESP32 generates a new set of readings
 * (heart rate, body temperature, SpO2) and publishes them as JSON
 * over MQTT. The Node.js server subscribes to the same topic and
 * pushes the readings to the web dashboard.
 *
 * Pressing the green button starts a short "abnormal episode"
 * (high heart rate, fever, low SpO2) so the alert can be shown
 * on demand during a demo. The red LED is on during an episode.
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ---------- Settings ----------
const char* WIFI_SSID     = "Wokwi-GUEST";   // Wokwi's built-in internet access
const char* WIFI_PASSWORD = "";
const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
// Must match MQTT_TOPIC in server/config.js
const char* MQTT_TOPIC    = "strathmore/167071/elderly-monitor/vitals";
const char* PATIENT_ID    = "P001";

const unsigned long READ_INTERVAL_MS = 3000;   // new reading every 3 s
const int EPISODE_LENGTH             = 8;      // readings per abnormal episode (~24 s)

const int BUTTON_PIN = 4;
const int LED_PIN    = 2;

// ---------- State ----------
WiFiClient espClient;
PubSubClient mqtt(espClient);

float heartRate   = 75.0;   // BPM
float temperature = 36.6;   // degrees C
float spo2        = 97.0;   // %
int episodeLeft   = 0;
unsigned long lastRead = 0;
unsigned long readingNo = 0;

// Random float in [lo, hi]
float randRange(float lo, float hi) {
  return lo + (hi - lo) * (random(0, 10001) / 10000.0);
}

// Move value a small random step, pulled gently towards a target
float drift(float value, float target, float step, float pull) {
  value += randRange(-step, step);
  value += (target - value) * pull;
  return value;
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println(" connected");
}

void connectMQTT() {
  while (!mqtt.connected()) {
    String clientId = "esp32-elderly-" + String(random(0xffff), HEX);
    Serial.print("Connecting to MQTT broker... ");
    if (mqtt.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
  }
}

void generateReadings() {
  if (episodeLeft > 0) {
    // Abnormal episode: values move towards unhealthy targets
    heartRate   = drift(heartRate, 128, 4, 0.35);
    temperature = drift(temperature, 38.6, 0.1, 0.35);
    spo2        = drift(spo2, 88, 0.6, 0.35);
    episodeLeft--;
  } else {
    // Normal resting values for an elderly person
    heartRate   = drift(heartRate, 74, 3, 0.15);
    temperature = drift(temperature, 36.7, 0.08, 0.15);
    spo2        = drift(spo2, 97, 0.5, 0.15);

    // Small chance of a spontaneous abnormal episode
    if (random(0, 100) < 1) episodeLeft = EPISODE_LENGTH;
  }

  heartRate   = constrain(heartRate, 35, 180);
  temperature = constrain(temperature, 34.0, 41.0);
  spo2        = constrain(spo2, 80, 100);
}

void publishReadings() {
  StaticJsonDocument<200> doc;
  doc["patient_id"]   = PATIENT_ID;
  doc["seq"]         = readingNo;
  doc["heart_rate_bpm"]   = (int)round(heartRate);
  doc["temperature_c"] = round(temperature * 10) / 10.0;
  doc["spo2_percent"]        = (int)round(spo2);

  char payload[200];
  serializeJson(doc, payload);
  mqtt.publish(MQTT_TOPIC, payload);

  Serial.println(payload);
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  randomSeed(esp_random());

  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  connectMQTT();
}

void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  // Button pressed: start an abnormal episode
  if (digitalRead(BUTTON_PIN) == LOW && episodeLeft == 0) {
    episodeLeft = EPISODE_LENGTH;
    Serial.println("Button pressed: simulating abnormal episode");
  }
  digitalWrite(LED_PIN, episodeLeft > 0 ? HIGH : LOW);

  if (millis() - lastRead >= READ_INTERVAL_MS) {
    lastRead = millis();
    readingNo++;
    generateReadings();
    publishReadings();
  }
}
