# Setting up the emulator and dashboard

This guide gets the Wokwi ESP32 sending readings to your dashboard. It takes about 20 minutes the first time. You need two things running at once:

- **Wokwi** (in your browser): the simulated ESP32 that makes the readings.
- **The dashboard server** (on your laptop): it receives the readings and shows them.

They talk through a free public MQTT broker (broker.hivemq.com), so both need internet.

---

## Part A: Set up the ESP32 in Wokwi

### 1. Create a Wokwi account
Go to **https://wokwi.com** and click **Sign in** (top right). Signing in with Google is the quickest way. It's free, and you need an account to save your project.

### 2. Start a new ESP32 project
Open **https://wokwi.com/projects/new/esp32**. You'll see an editor with code on the left and an ESP32 board on the right. The left side has two tabs: `sketch.ino` and `diagram.json`.

### 3. Paste the code
1. Click the **sketch.ino** tab, select everything (Ctrl+A), and delete it.
2. Open `prototype/wokwi/sketch.ino` from the project files, copy all of it, and paste it in.

### 4. Paste the circuit
1. Click the **diagram.json** tab, select everything (Ctrl+A), and delete it.
2. Paste in everything from `prototype/wokwi/diagram.json`.
3. The board on the right now has a **green button** and a **red LED** connected to it.

### 5. Add the libraries
The code needs two libraries: PubSubClient (for MQTT) and ArduinoJson.

1. Click the small **down arrow (▾)** at the end of the tab row and choose **New file…**.
2. Name it exactly `libraries.txt` and press Enter.
3. Paste in the contents of `prototype/wokwi/libraries.txt`:
   ```
   # Wokwi Library List
   PubSubClient
   ArduinoJson@6.21.5
   ```

### 6. Run it
1. Click the green **▶ Play** button above the board.
2. The first build takes up to a minute. When it's done, the **Serial Monitor** opens under the board and shows:
   ```
   Connecting to WiFi...... connected
   Connecting to MQTT broker... connected
   {"patient_id":"P001","seq":1,"heart_rate_bpm":75,"temperature_c":36.6,"spo2_percent":97}
   ```
3. A new line appears every 3 seconds. That means the ESP32 is working.

### 7. Save the project
Press **Ctrl+S** (or click **Save**) and give it a name such as *Elderly Heart Monitor*. Copy the page link (it looks like `wokwi.com/projects/123...`) so you can open it straight away on demo day.

---

## Part B: Run the dashboard on your laptop

### 1. Install Node.js (one time only)
Go to **https://nodejs.org** and install the **LTS** version, accepting the defaults. To check it worked, open a terminal (on Windows, *Command Prompt*) and type:
```
node -v
```
It should print a version number such as `v22.x.x`.

### 2. Get the prototype files
Download the `prototype` folder from the project files to your laptop, for example to `Documents\prototype`.

### 3. Start the server
In the terminal, go to the `server` folder and start it:
```
cd Documents\prototype\server
npm install
npm start
```
`npm install` is only needed the first time, and it takes a minute. When the server is running, you'll see:
```
Dashboard: http://localhost:3000
MQTT connected, listening on strathmore/167071/elderly-monitor/vitals
```
Leave this terminal window open, because closing it stops the dashboard.

### 4. Open the dashboard
Go to **http://localhost:3000** in your browser.

- **Green dot, "Live from Wokwi ESP32"**: it's working. The values match the Wokwi Serial Monitor and change every 3 seconds.
- **Yellow dot, "Waiting for Wokwi"**: no readings are coming from Wokwi. The server is filling in with its own simulated readings. See *Troubleshooting* below.

### 5. Test the alert
In Wokwi, click the **green button** on the circuit. The red LED lights up, and within a few readings the dashboard shows the red **EMERGENCY ALERT** banner. After about 24 seconds the readings go back to normal.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| Dashboard stays yellow | Make sure Wokwi is still running (the Play button shows ■ Stop). Keep the Wokwi tab **visible**, because browsers slow down background tabs and the simulation can pause. Put the two windows side by side. |
| Serial Monitor stuck on `Connecting to WiFi....` | Stop and press Play again. |
| `failed, rc=-2` in the Serial Monitor | The broker is busy. It retries on its own. If it keeps failing, change `broker.hivemq.com` to `test.mosquitto.org` in **both** `sketch.ino` and `server/config.js`, then restart both. |
| Build error mentioning a library | Check that `libraries.txt` is spelled exactly like that and contains the lines above. |
| `npm` is not recognised | Close and reopen the terminal after installing Node.js. |
| `EADDRINUSE` when starting the server | The dashboard is already running in another terminal. Use that one, or close it first. |

**No internet on demo day?** Run `npm run simulate` instead of `npm start`. The dashboard then uses its built-in simulator, and the **Simulate abnormal episode** button on the dashboard triggers the alert.
