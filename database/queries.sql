-- Useful queries to show the examiner that the database works.
-- In phpMyAdmin, select your database first, then paste one query into the SQL tab.

-- 1. List every table
SHOW TABLES;

-- 2. All users with their role
SELECT u.user_id, u.full_name, r.role_name, u.email
FROM tbl_user u JOIN tbl_role r ON r.role_id = u.role_id;

-- 3. Latest readings for each elderly person
SELECT u.full_name, h.heart_rate_bpm, h.temperature_c, h.spo2_percent, h.recorded_at
FROM tbl_health_reading h
JOIN tbl_device d          ON d.device_id = h.device_id
JOIN tbl_elderly_profile e ON e.elderly_id = d.elderly_id
JOIN tbl_user u            ON u.user_id = e.user_id
ORDER BY h.recorded_at DESC
LIMIT 10;

-- 4. Readings outside the person's own heart-rate threshold
SELECT u.full_name, h.heart_rate_bpm, t.min_value, t.max_value, h.recorded_at
FROM tbl_health_reading h
JOIN tbl_device d          ON d.device_id = h.device_id
JOIN tbl_elderly_profile e ON e.elderly_id = d.elderly_id
JOIN tbl_user u            ON u.user_id = e.user_id
JOIN tbl_threshold t       ON t.elderly_id = e.elderly_id AND t.vital_type = 'heart_rate_bpm'
WHERE h.heart_rate_bpm < t.min_value OR h.heart_rate_bpm > t.max_value;

-- 5. Open alerts and who was notified
SELECT a.alert_id, pu.full_name AS patient, a.severity, a.message, a.status,
       ru.full_name AS notified, n.channel, n.status AS delivery
FROM tbl_alert a
JOIN tbl_elderly_profile e ON e.elderly_id = a.elderly_id
JOIN tbl_user pu           ON pu.user_id = e.user_id
LEFT JOIN tbl_notification n ON n.alert_id = a.alert_id
LEFT JOIN tbl_user ru        ON ru.user_id = n.recipient_user_id
ORDER BY a.triggered_at DESC;

-- 6. Which caregiver and provider looks after whom
SELECT pu.full_name AS elderly_person, cu.full_name AS caregiver, c.relationship, vu.full_name AS provider
FROM tbl_elderly_profile e
JOIN tbl_user pu ON pu.user_id = e.user_id
LEFT JOIN tbl_caregiver_assignment ca ON ca.elderly_id = e.elderly_id
LEFT JOIN tbl_caregiver c ON c.caregiver_id = ca.caregiver_id
LEFT JOIN tbl_user cu ON cu.user_id = c.user_id
LEFT JOIN tbl_provider_assignment pa ON pa.elderly_id = e.elderly_id
LEFT JOIN tbl_healthcare_provider p ON p.provider_id = pa.provider_id
LEFT JOIN tbl_user vu ON vu.user_id = p.user_id;
