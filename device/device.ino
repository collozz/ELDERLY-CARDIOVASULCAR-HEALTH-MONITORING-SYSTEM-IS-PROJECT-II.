// Elderly heart monitor: ESP32 with MAX30102 and DS18B20

#include <WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"

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
const int TEMP_PIN   = 27;
const int BUTTON_PIN = 4;
const int LED_PIN    = 2;

// IR level that means a finger is on the sensor
const long FINGER_IR = 50000;

// Connections and sensors
WiFiClient espClient;
PubSubClient mqtt(espClient);
MAX30105 pulseSensor;
OneWire oneWire(TEMP_PIN);
DallasTemperature tempSensor(&oneWire);

// Sample buffers (BUFFER_SIZE = 100 comes from spo2_algorithm.h)
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];
int samples = 0;
bool fingerOn = false;
bool pulseOk = true;

int heartRate = 0;
int spo2 = 0;
float temperature = 0;
unsigned long lastRead = 0;
unsigned long lastMqttTry = 0;
unsigned long lastBeat = 0;
unsigned long panicUntil = 0;
unsigned long readingNo = 0;
bool lastButton = HIGH;
bool abnormal = false;

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

void startSensors() {
  Serial.print("Starting MAX30102... ");
  if (!pulseSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("FAILED, check SDA/SCL/VIN/GND wires");
    pulseOk = false;
  } else {
    Serial.println("ok");
    // Brightness, averaging, red+IR mode, 100 Hz, pulse width, range
    pulseSensor.setup(60, 4, 2, 100, 411, 4096);
  }

  tempSensor.begin();
  tempSensor.setWaitForConversion(false);
  tempSensor.requestTemperatures();
  if (tempSensor.getDeviceCount() == 0) Serial.println("DS18B20 not found, check wires and 4.7k resistor");
}

// Read new samples from the MAX30102
void readPulseSensor() {
  pulseSensor.check();
  while (pulseSensor.available()) {
    uint32_t ir = pulseSensor.getFIFOIR();
    uint32_t red = pulseSensor.getFIFORed();
    pulseSensor.nextSample();

    fingerOn = ir > FINGER_IR;
    if (!fingerOn) {
      samples = 0;
      heartRate = 0;
      spo2 = 0;
      continue;
    }
    if (checkForBeat(ir)) lastBeat = millis();

    irBuffer[samples] = ir;
    redBuffer[samples] = red;
    samples++;
    if (samples == BUFFER_SIZE) {
      calculateVitals();
      // Keep the newest 75 samples, refill 25
      for (int i = 25; i < BUFFER_SIZE; i++) {
        irBuffer[i - 25] = irBuffer[i];
        redBuffer[i - 25] = redBuffer[i];
      }
      samples = 75;
    }
  }
}

// Heart rate and SpO2 from the buffer
void calculateVitals() {
  int32_t newSpo2, newHr;
  int8_t spo2Valid, hrValid;
  maxim_heart_rate_and_oxygen_saturation(irBuffer, BUFFER_SIZE, redBuffer, &newSpo2, &spo2Valid, &newHr, &hrValid);

  if (hrValid && newHr >= 30 && newHr <= 220) {
    heartRate = heartRate == 0 ? newHr : (heartRate * 7 + newHr * 3) / 10;
  }
  if (spo2Valid && newSpo2 >= 70 && newSpo2 <= 100) {
    spo2 = spo2 == 0 ? newSpo2 : (spo2 * 7 + newSpo2 * 3) / 10;
  }
}

void readTemperature() {
  float t = tempSensor.getTempCByIndex(0);
  if (t != DEVICE_DISCONNECTED_C && t != 85.0) temperature = t;
  tempSensor.requestTemperatures();
}

void publishReadings() {
  StaticJsonDocument<200> doc;
  doc["patient_id"] = PATIENT_ID;
  doc["seq"] = readingNo;
  // No finger: send without heart rate so the server ignores it
  if (fingerOn && heartRate > 0 && spo2 > 0) {
    doc["heart_rate_bpm"] = heartRate;
    doc["spo2_percent"] = spo2;
  } else if (!fingerOn) {
    Serial.println("Place finger on the sensor");
  } else {
    Serial.println("Reading pulse, keep finger still");
  }
  // Same limits as the web app defaults
  abnormal = (heartRate > 0 && (heartRate < 50 || heartRate > 100)) ||
             (spo2 > 0 && spo2 < 92) ||
             (temperature > 0 && (temperature < 35.5 || temperature > 37.8));
  if (temperature > 0) doc["temperature_c"] = round(temperature * 10) / 10.0;

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

  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  connectMQTT();
  startSensors();
}

void loop() {
  if (pulseOk) readPulseSensor();

  connectMQTT();
  mqtt.loop();

  // Panic button
  bool button = digitalRead(BUTTON_PIN);
  if (button == LOW && lastButton == HIGH && millis() > panicUntil) sendPanic();
  lastButton = button;

  // LED: on for a panic press or abnormal readings
  bool ledOn = millis() < panicUntil || abnormal;
  digitalWrite(LED_PIN, ledOn ? HIGH : LOW);

  if (millis() - lastRead >= READ_INTERVAL_MS) {
    lastRead = millis();
    readingNo++;
    readTemperature();
    publishReadings();
  }
}
