# Cardiovascular Monitoring System: full web app (VS Code + MySQL)

This is the full version of the system: login, dashboards, forms and pages, all saving to and reading from your MySQL database **cardiovascular monitoring project**.

It sits next to the 30% demo. The demo in `prototype\server` is unchanged, so you can still show it on Thursday.

```
prototype\
  server\      <- 30% demo (unchanged)
  wokwi\       <- ESP32 sketch (unchanged, works with both)
  database\    <- schema.sql, seed.sql
  webapp\      <- THIS app
```

## What you need (you already have all of these)

- Node.js (the same one you used for the 30% demo)
- XAMPP with MySQL, and the database **cardiovascular monitoring project** with `schema.sql` and `seed.sql` imported
- VS Code

## Step 1. Put the files on your laptop

1. Download **prototype.zip** from the project and open it.
2. Copy the `webapp` folder into `C:\Users\pc\OneDrive\Documents\prototype\`
   so you end up with `C:\Users\pc\OneDrive\Documents\prototype\webapp\server.js`.

## Step 2. Start MySQL

1. Open the **XAMPP Control Panel**.
2. Click **Start** next to **MySQL** (and Apache if you want phpMyAdmin).
3. If you have not imported the database yet, follow `database\DATABASE-SETUP.md` first.

> Want a clean start with the sample data? In phpMyAdmin select your database, then Import `schema.sql`, then Import `seed.sql`. This deletes everything and puts the sample data back.

## Step 3. Open the project in VS Code

1. Open VS Code.
2. **File > Open Folder...** and choose `C:\Users\pc\OneDrive\Documents\prototype\webapp`.
3. If VS Code asks "Do you trust the authors?", click **Yes, I trust the authors**.
4. Open the terminal: **Terminal > New Terminal** (or press `` Ctrl + ` ``).

## Step 4. Install and start (type these in the VS Code terminal)

Only the first time:

```
npm install
```

Every time you want to run it:

```
npm start
```

You should see:

```
Connected to MySQL database "cardiovascular monitoring project"
Open http://localhost:3000 in your browser
```

Then open **http://localhost:3000** in Chrome.

To stop the server: click in the terminal and press `Ctrl + C`.

## Step 5. Log in

All sample accounts use the password **Password123**.

| Role | Email | Lands on |
|---|---|---|
| Administrator | admin@heartmonitor.test | Dashboard + Administration (users, devices, assignments, activity log) |
| Caregiver | peter.kamau@heartmonitor.test | Dashboard with his assigned elderly, alerts, reports |
| Healthcare Provider | grace.otieno@heartmonitor.test | Same as caregiver, and can change alert thresholds |
| Elderly Person | mary.kamau@heartmonitor.test | My Health page with the panic button |

## The pages

| Page | What it does | Tables it uses |
|---|---|---|
| Login / Register | Sign in, create an account (caregiver, provider or elderly) | tbl_user, tbl_role, tbl_caregiver, tbl_healthcare_provider, tbl_elderly_profile |
| Dashboard | Live status of each elderly person, alert banner, weekly heart rate trend | tbl_health_reading, tbl_alert |
| My Elderly / Patient | Live vitals, heart rate chart (1 h, 24 h, 7 days), profile form, threshold form, care team, recent alerts | tbl_elderly_profile, tbl_threshold, tbl_caregiver_assignment, tbl_provider_assignment |
| My Health (elderly) | Big vitals and a press-and-hold panic button | tbl_alert (Panic), tbl_notification |
| Alerts | Filter, acknowledge and resolve alerts; see SMS and dashboard delivery | tbl_alert, tbl_notification |
| Reports | Summary for a person and date range, chart, CSV download | tbl_health_reading, tbl_alert |
| Administration | Add/delete users, register devices, assign caregivers and providers, activity log | tbl_user, tbl_device, the assignment tables, tbl_activity_log |
| Settings | Change your name, phone number and password | tbl_user |

## Where the readings come from

- **Wokwi running:** the ESP32 readings arrive over MQTT and are saved in `tbl_health_reading` for device `WOKWI-ESP32-001` (Mary). The top bar shows a green dot "Live from ESP32".
- **Wokwi not running:** after 10 seconds the server's built-in simulator saves readings for the same device every 3 seconds, so the pages still update. The top bar shows a yellow dot "Simulated readings".
- To use only the simulator: `npm run simulate`.
- Administrators have a **Simulate abnormal episode** button on the dashboard, to show alerts during a demo.

When a reading is outside a person's thresholds, the server saves an alert in `tbl_alert`, a dashboard notification for each caregiver and provider, and an SMS for each caregiver in `tbl_notification`. SMS sending is simulated: the message is printed in the VS Code terminal and saved with status "Sent".

## If something goes wrong

| You see | Fix |
|---|---|
| `Cannot connect to MySQL (ECONNREFUSED)` or "Cannot reach the database" | MySQL is not started. Start it in XAMPP. |
| `Unknown database` | The name in `config.js` (line `database:`) must match your database name exactly. |
| `Access denied for user 'root'` | You set a MySQL password. Put it in `config.js` on the `password:` line. |
| `EADDRINUSE :::3000` | Another server is running (maybe the 30% demo). Press `Ctrl + C` in that terminal, then `npm start` again. |
| `'npm' is not recognized` | Close and reopen VS Code after installing Node.js. |
| Login says "Wrong email or password" for the sample accounts | Import `seed.sql` again. |
