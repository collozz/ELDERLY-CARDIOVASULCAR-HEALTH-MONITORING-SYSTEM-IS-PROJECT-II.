// Elderly heart monitor: ESP32 with MAX30100 and DHT22

#include <WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include "MAX30100_PulseOximeter.h"

// Wi-Fi (2.4 GHz only)
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// MQTT
const char* MQTT_BROKER = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* MQTT_TOPIC  = "strathmore/167071/elderly-monitor/vitals";
const char* PATIENT_ID  = "P001";

const unsigned long READ_INTERVAL_MS = 3000;

// Pins
const int DHT_PIN    = 27;
const int BUTTON_PIN = 4;
const int LED_PIN    = 2;

// DHT22 reads skin or air, so add a fixed offset to get body range
const float TEMP_OFFSET = 3.5;

// Connections and sensors
WiFiClient espClient;
PubSubClient mqtt(espClient);
PulseOximeter pox;
DHT dht(DHT_PIN, DHT22);

unsigned long lastRead = 0;
unsigned long lastMqttTry = 0;
unsigned long lastBeat = 0;
unsigned long panicUntil = 0;
unsigned long readingNo = 0;
float temperature = 36.6;
bool lastButton = HIGH;

// Flash LED on each heartbeat
void onBeat() {
  lastBeat = millis();
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.print(" connected, IP ");
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  if (mqtt.connected() || millis() - lastMqttTry < 5000) return;
  lastMqttTry = millis();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost, reconnecting");
    WiFi.reconnect();
    return;
  }
  String clientId = "esp32-elderly-" + String(random(0xffff), HEX);
  Serial.print("Connecting to MQTT broker... ");
  if (mqtt.connect(clientId.c_str())) {
    Serial.println("connected");
  } else {
    Serial.print("failed, rc=");
    Serial.println(mqtt.state());
  }
}

void startSensor() {
  Serial.print("Starting MAX30100... ");
  if (!pox.begin()) {
    Serial.println("FAILED, check wiring and pull-up resistors");
    while (true) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      delay(200);
    }
  }
  Serial.println("ok");
  pox.setIRLedCurrent(MAX30100_LED_CURR_7_6MA);
  pox.setOnBeatDetectedCallback(onBeat);
}

void readTemperature() {
  float t = dht.readTemperature();
  if (!isnan(t)) temperature = t + TEMP_OFFSET;
}

void publishReadings() {
  int heartRate = (int)round(pox.getHeartRate());
  int spo2 = pox.getSpO2();

  StaticJsonDocument<200> doc;
  doc["patient_id"] = PATIENT_ID;
  doc["seq"] = readingNo;
  // No finger: send without heart rate so the server ignores it
  if (heartRate > 0 && spo2 > 0) {
    doc["heart_rate_bpm"] = heartRate;
    doc["spo2_percent"] = spo2;
  } else {
    Serial.println("Place finger on the sensor");
  }
  doc["temperature_c"] = round(temperature * 10) / 10.0;

  char payload[200];
  serializeJson(doc, payload);
  mqtt.publish(MQTT_TOPIC, payload);
  Serial.println(payload);
}

void sendPanic() {
  StaticJsonDocument<100> doc;
  doc["patient_id"] = PATIENT_ID;
  doc["panic"] = true;

  char payload[100];
  serializeJson(doc, payload);
  mqtt.publish(MQTT_TOPIC, payload);
  Serial.println("Panic button pressed");
  panicUntil = millis() + 5000;
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  randomSeed(esp_random());

  dht.begin();
  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  connectMQTT();
  startSensor();
}

void loop() {
  pox.update();

  connectMQTT();
  mqtt.loop();

  // Panic button
  bool button = digitalRead(BUTTON_PIN);
  if (button == LOW && lastButton == HIGH && millis() > panicUntil) sendPanic();
  lastButton = button;

  // LED: on after panic, short flash on each beat
  bool ledOn = millis() < panicUntil || millis() - lastBeat < 100;
  digitalWrite(LED_PIN, ledOn ? HIGH : LOW);

  if (millis() - lastRead >= READ_INTERVAL_MS) {
    lastRead = millis();
    readingNo++;
    readTemperature();
    publishReadings();
  }
}
