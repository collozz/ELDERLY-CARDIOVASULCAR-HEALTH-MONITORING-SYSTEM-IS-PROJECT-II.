-- =====================================================================
-- Sample data for demos and testing (fictional people).
-- phpMyAdmin: with YOUR database selected on the left, Import this file
-- after schema.sql.
-- Every sample account's password is: Password123
-- =====================================================================

SET @pw = '$2a$10$qvZSsPYfEFZWwHOnFDgOfeiGzaMl/9nGMpTOuACfqkExZbsmCHbza'; -- bcrypt of Password123

INSERT INTO tbl_role (role_id, role_name, description) VALUES
  (1, 'Administrator',       'Manages users, devices and system settings'),
  (2, 'Elderly Person',      'Patient whose vital signs are monitored'),
  (3, 'Caregiver',           'Family member or carer who receives alerts'),
  (4, 'Healthcare Provider', 'Clinician who reviews readings and sets thresholds');

INSERT INTO tbl_user (user_id, role_id, full_name, email, phone_number, password_hash) VALUES
  (1, 1, 'System Administrator', 'admin@heartmonitor.test',   '+254700000001', @pw),
  (2, 2, 'Mary Wanjiru Kamau',   'mary.kamau@heartmonitor.test', '+254700000002', @pw),
  (3, 3, 'Peter Kamau',          'peter.kamau@heartmonitor.test', '+254700000003', @pw),
  (4, 4, 'Dr. Grace Otieno',     'grace.otieno@heartmonitor.test', '+254700000004', @pw),
  (5, 2, 'John Mwangi Njoroge',  'john.njoroge@heartmonitor.test', '+254700000005', @pw);

INSERT INTO tbl_elderly_profile
  (elderly_id, user_id, date_of_birth, gender, address, medical_history, emergency_contact_name, emergency_contact_phone) VALUES
  (1, 2, '1948-03-12', 'Female', 'Kileleshwa, Nairobi', 'Hypertension, takes amlodipine daily', 'Peter Kamau', '+254700000003'),
  (2, 5, '1951-11-02', 'Male',   'Karen, Nairobi',      'Atrial fibrillation (2019)',           'Peter Kamau', '+254700000003');

INSERT INTO tbl_caregiver (caregiver_id, user_id, relationship) VALUES
  (1, 3, 'Son');

INSERT INTO tbl_healthcare_provider (provider_id, user_id, specialization, license_number) VALUES
  (1, 4, 'Cardiology', 'KMPDC-A12345');

INSERT INTO tbl_caregiver_assignment (caregiver_id, elderly_id) VALUES (1, 1), (1, 2);
INSERT INTO tbl_provider_assignment  (provider_id, elderly_id)  VALUES (1, 1), (1, 2);

-- Same values as server/config.js in the prototype
INSERT INTO tbl_threshold (elderly_id, provider_id, vital_type, min_value, max_value) VALUES
  (1, 1, 'heart_rate_bpm', 50.0, 100.0),
  (1, 1, 'temperature_c',  35.5,  37.8),
  (1, 1, 'spo2_percent',   92.0, 100.0),
  (2, 1, 'heart_rate_bpm', 55.0,  95.0),
  (2, 1, 'temperature_c',  35.5,  37.8),
  (2, 1, 'spo2_percent',   92.0, 100.0);

INSERT INTO tbl_device (device_id, elderly_id, device_type, serial_number, status, last_synced_at) VALUES
  (1, 1, 'ESP32 (Wokwi simulated)', 'WOKWI-ESP32-001', 'Active', '2026-10-14 08:00:09'),
  (2, 2, 'ESP32 (Wokwi simulated)', 'WOKWI-ESP32-002', 'Inactive', NULL);

INSERT INTO tbl_health_reading (reading_id, device_id, heart_rate_bpm, temperature_c, spo2_percent, recorded_at) VALUES
  (1, 1,  74, 36.6, 97.00, '2026-10-14 08:00:00'),
  (2, 1,  76, 36.7, 97.00, '2026-10-14 08:00:03'),
  (3, 1, 108, 37.6, 93.00, '2026-10-14 08:00:06'),
  (4, 1, 121, 38.3, 90.00, '2026-10-14 08:00:09');

INSERT INTO tbl_alert (alert_id, elderly_id, reading_id, alert_type, severity, message, status, triggered_at) VALUES
  (1, 1, 3,    'Threshold', 'Warning',  'Heart rate too high: 108 BPM', 'Resolved', '2026-10-14 08:00:06'),
  (2, 1, 4,    'Threshold', 'Critical', 'Heart rate too high: 121 BPM; Body temperature too high: 38.3 C; Blood oxygen too low: 90 %', 'Open', '2026-10-14 08:00:09'),
  (3, 2, NULL, 'Panic',     'Critical', 'Panic button pressed', 'Acknowledged', '2026-10-13 19:42:00');

INSERT INTO tbl_notification (alert_id, recipient_user_id, channel, message, status, sent_at) VALUES
  (2, 3, 'SMS',       'ALERT: Mary Wanjiru Kamau - heart rate 121 BPM, SpO2 90%. Please check on her.', 'Sent', '2026-10-14 08:00:10'),
  (2, 4, 'Dashboard', 'Critical alert for Mary Wanjiru Kamau', 'Sent', '2026-10-14 08:00:10'),
  (3, 3, 'SMS',       'PANIC: John Mwangi Njoroge pressed the panic button.', 'Sent', '2026-10-13 19:42:01');

INSERT INTO tbl_activity_log (user_id, action, details) VALUES
  (1, 'Created user',      'Registered Mary Wanjiru Kamau'),
  (4, 'Updated threshold', 'Set heart rate range 50-100 BPM for Mary Wanjiru Kamau'),
  (3, 'Acknowledged alert','Alert #3 (panic button)');
