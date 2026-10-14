# Elderly Heart Rate Monitoring and Emergency Alert System: 30% prototype

Prototype for the IS project *A Web-Based IoT-Enabled Heart Rate Monitoring and Emergency Alert System for Elderly Patients* (Gitonga Cyrus Collins, 167071).

The focus is cardiovascular: heart rate is the main reading, with temperature and SpO₂ as supporting vital signs.

It covers the five 30% milestone requirements:

| Requirement | Where it is |
|---|---|
| 1. Online IoT emulator | `wokwi/` holds an ESP32 project for the Wokwi online emulator |
| 2. Simulated health data | ESP32 generates heart rate (BPM), body temperature (°C) and SpO₂ (%) |
| 3. Continuously moving data | A new reading every 3 seconds, drifting realistically |
| 4. Web dashboard | `server/public/` shows live values, charts and an alert log |
| 5. Health-status detection | `server/config.js` holds the thresholds; readings outside them raise an emergency alert |

## How the data flows

```
Wokwi ESP32  --MQTT-->  broker.hivemq.com  --MQTT-->  Node.js/Express server  --Server-Sent Events-->  Dashboard
```

MQTT through a free public broker is used because Wokwi's simulated ESP32 can reach the internet but cannot reach a server running on your own laptop, and the broker lets both sides meet without deploying anything.

Field names match the ERD: a reading has `heart_rate_bpm`, `temperature_c` and `spo2_percent`, and each threshold has `vital_type`, `min_value` and `max_value`.

## Running it

New to Wokwi? Follow the step-by-step [SETUP-GUIDE.md](../SETUP-GUIDE.md). The short version is below.

You need Node.js (version 18 or newer).

1. **Start the server**
   ```
   cd server
   npm install
   npm start
   ```
   Open http://localhost:3000.

2. **Start the ESP32 in Wokwi**
   - Go to https://wokwi.com and create a new **ESP32** project.
   - Replace `sketch.ino` and `diagram.json` with the files from `wokwi/`.
   - Add a new file called `libraries.txt` with the contents of `wokwi/libraries.txt`.
   - Press the green **Play** button. The Serial Monitor shows each reading as it is sent.
   - Save the project so you can open it from a link on demo day.

3. Within a few seconds the dashboard's top-right indicator turns green ("Live from Wokwi ESP32") and the values update every 3 seconds.

## Demo script for the examiner

1. Show the Wokwi ESP32 running and the readings in its Serial Monitor.
2. Show the dashboard updating every 3 seconds, all readings Normal.
3. Press the green **Abnormal episode** button on the Wokwi circuit. The red LED lights, heart rate and temperature rise and SpO₂ falls.
4. The dashboard shows a red **EMERGENCY ALERT** banner, the affected cards turn red, and the alert is logged with its time.
5. Open `server/config.js` to show where the thresholds are configured.

## Backup if the internet is unreliable

If no reading arrives from Wokwi for 10 seconds, the server generates readings itself, so the dashboard never goes blank (the indicator turns yellow). To run only the built-in simulator, use `npm run simulate`. The **Simulate abnormal episode** button on the dashboard triggers an episode in the built-in simulator.

## Not in this milestone

User login, patient profiles, a database, SMS alerts and the panic button come in later sprints. Readings are kept in memory for now.

## Next stage: full web app

`webapp/` is the full system linked to the MySQL database in `database/`: login for all four roles, dashboards, patient pages, alerts, reports, administration and the panic button. See `webapp/README.md` for the VS Code steps. The 30% demo in `server/` is left unchanged.
