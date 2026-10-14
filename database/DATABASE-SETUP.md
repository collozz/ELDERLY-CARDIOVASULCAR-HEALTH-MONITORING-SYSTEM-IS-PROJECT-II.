# Setting up the database on your laptop

The database is MySQL and follows the corrected schema diagram exactly: 13 tables with the same names and columns. You'll use **XAMPP**, a free package that installs MySQL together with **phpMyAdmin**, a web page where you can see and manage the database. phpMyAdmin is also a good way to show the database to your examiner.

There are three files in `prototype/database/`:

| File | What it does |
|---|---|
| `schema.sql` | Creates all 13 tables, keys and rules inside the database you select |
| `seed.sql` | Adds sample data: 5 users, 2 elderly people, a caregiver, a doctor, thresholds, readings, alerts |
| `queries.sql` | Ready-made queries to show that the database works |

---

## Step 1: Install XAMPP (one time only)

1. Go to **https://www.apachefriends.org** and download **XAMPP for Windows**.
2. Run the installer. When it asks which components to install, keep **Apache**, **MySQL** and **phpMyAdmin** ticked. You can untick the rest.
3. Install it to the default folder, `C:\xampp`.
4. If Windows Firewall asks for permission, click **Allow access**.

## Step 2: Start MySQL

1. Open **XAMPP Control Panel** from the Start menu.
2. Click **Start** next to **Apache**, then **Start** next to **MySQL**.
3. Both names turn green. Leave the Control Panel open while you work.

## Step 3: Save the SQL files

Put `schema.sql`, `seed.sql` and `queries.sql` in a new folder:
```
C:\Users\pc\OneDrive\Documents\prototype\database
```
You can copy them from the prototype files page, or unzip them from `prototype.zip`.

## Step 4: Create your database

If you already made one (for example *cardiovascular monitoring project*), skip to Step 5.

1. In your browser, go to **http://localhost/phpmyadmin**.
2. Click **New** at the top of the left panel.
3. Type a name, for example `cardiovascular_monitoring_project`, and click **Create**.

## Step 5: Create the tables, then add the sample data

1. **Click your database's name in the left panel**, so it is selected. This matters, because the files create the tables inside whichever database is selected.
2. Click the **Import** tab at the top.
3. Under *File to import*, click **Choose File**, pick `schema.sql`, scroll down and click **Import** (or **Go**). A green success message appears.
4. With your database still selected, click **Import** again, choose `seed.sql`, and click **Import**.

## Step 6: Check it worked

1. On the left, click your database. You should see 13 tables, from `tbl_activity_log` to `tbl_user`.
2. Click **tbl_user**. It shows 5 users: an administrator, two elderly people, a caregiver and a doctor.
3. Click **tbl_health_reading** to see the heart-rate readings.

## Step 7: See the relationships (good for the examiner)

1. Click your database on the left.
2. At the top, click **More**, then **Designer**.
3. phpMyAdmin draws the tables with lines between them. This matches your schema diagram, which shows that the database was built from the design.

## Step 8: Run the demo queries

1. Click your database, then the **SQL** tab.
2. Open `queries.sql` in Notepad, copy one query (from `SELECT` to the `;`), paste it in, and click **Go**.
3. The most useful ones to show:
   - **Query 4** lists readings outside the patient's own heart-rate threshold. This is your alert rule written as SQL.
   - **Query 5** lists open alerts and who was notified by SMS.

---

## Things to know

- **Running `schema.sql` again deletes all 13 tables and their data** and recreates them empty, so run `seed.sql` again afterwards. This is handy for resetting before a demo.
- **The rules are built in.** For example, the database refuses a threshold for an unknown vital sign, a reading from a device that doesn't exist, or a threshold whose minimum is higher than its maximum.
- **The sample login password** for every sample user is `Password123`. Only its secure hash is stored in the database, never the password itself.
- **Your proposal** (section 3.5.2) still says NoSQL. Change it to **MySQL (relational database)** so it matches the diagrams and this database.

## Troubleshooting

| Problem | Fix |
|---|---|
| MySQL won't start, and the log mentions port 3306 | Another MySQL is already running. Open *Services* in Windows, stop **MySQL80**, then press Start in XAMPP again. |
| Apache won't start, and the log mentions port 80 | Another program (often Skype or IIS) uses port 80. Close it, or in XAMPP click **Config → httpd.conf** next to Apache and change `Listen 80` to `Listen 8080`. Then use **http://localhost:8080/phpmyadmin**. |
| Import error: *Unknown collation utf8mb4_unicode_ci* | Your XAMPP is very old. Install the latest version. |
| `#1046 No database selected` | Click your database in the left panel first, then Import. |
| `#1049 Unknown database` | You have an old copy of the files. Use the latest `schema.sql` and `seed.sql`. |
