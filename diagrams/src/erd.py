import sys
from dia import Diagram

d = Diagram(2960, 2120)
E, A, R, L = d.entity, d.attr, d.rel, d.link

# ---------- top row: Role / User / Activity Log ----------
E("role", 380, 230, "ROLE")
E("user", 1450, 230, "USER", w=280)
E("log", 2560, 230, "ACTIVITY LOG")
R("r_has", 860, 230, "has")
R("r_perf", 2030, 230, "performs")
L("role", "r_has", "1"); L("r_has", "user", None, "M")
L("user", "r_perf", "1"); L("r_perf", "log", None, "M")

for i, (n, x, y, pk) in enumerate([("role_id", 200, 95, True), ("role_name", 420, 80, False), ("description", 380, 370, False)]):
    A(f"ra{i}", x, y, n, pk); L(f"ra{i}", "role")
for i, (n, x, y, pk) in enumerate([("user_id", 1060, 110, True), ("full_name", 1280, 70, False), ("email", 1480, 70, False),
                                   ("phone_number", 1720, 85, False), ("password_hash", 1160, 370, False), ("created_at", 1790, 165, False)]):
    A(f"ua{i}", x, y, n, pk); L(f"ua{i}", "user")
for i, (n, x, y, pk) in enumerate([("log_id", 2380, 95, True), ("action", 2700, 95, False),
                                   ("details", 2400, 360, False), ("logged_at", 2720, 360, False)]):
    A(f"la{i}", x, y, n, pk); L(f"la{i}", "log")

# ---------- specialisation of USER ----------
d.isa("isa", 1450, 480)
L("user", "isa")
E("care", 380, 740, "CAREGIVER")
E("eld", 1450, 740, "ELDERLY PERSON", w=440)
E("prov", 2560, 740, "HEALTHCARE PROVIDER")
L("isa", "care", via=[(1450, 590), (380, 590)])
L("isa", "eld")
L("isa", "prov", via=[(1450, 590), (2560, 590)])

R("r_cares", 880, 740, "cares for")
R("r_mon", 2030, 740, "monitors")
L("care", "r_cares", "M"); L("r_cares", "eld", None, "N")
L("eld", "r_mon", "M"); L("r_mon", "prov", None, "N")
A("ca_as", 860, 648, "assigned_at"); L("ca_as", "r_cares")
A("mo_as", 2050, 648, "assigned_at"); L("mo_as", "r_mon")

A("cga0", 300, 880, "relationship"); L("cga0", "care")
A("pa0", 2420, 890, "specialization"); L("pa0", "prov")
A("pa1", 2690, 970, "license_number"); L("pa1", "prov")

for i, (n, x, y) in enumerate([("date_of_birth", 1100, 655), ("gender", 1810, 655),
                               ("address", 1250, 895), ("medical_history", 1260, 990)]):
    A(f"ea{i}", x, y, n); L(f"ea{i}", "eld")
A("ec", 1650, 895, "emergency_contact"); L("ec", "eld")
A("ec1", 1560, 1030, "contact_name"); L("ec1", "ec")
A("ec2", 1790, 1030, "contact_phone"); L("ec2", "ec")

# ---------- device and readings ----------
E("dev", 640, 1330, "IoT DEVICE")
R("r_wears", 860, 1130, "wears")
L("eld", "r_wears", "1", via=[(1250, 776)]); L("r_wears", "dev", None, "M")
for i, (n, x, y, pk) in enumerate([("device_id", 250, 1180, True), ("device_type", 220, 1265, False),
                                   ("serial_number", 215, 1350, False), ("status", 250, 1435, False),
                                   ("last_synced_at", 330, 1520, False)]):
    A(f"da{i}", x, y, n, pk); L(f"da{i}", "dev")

E("hr", 640, 1780, "HEALTH READING")
R("r_rec", 640, 1560, "records")
L("dev", "r_rec", "1"); L("r_rec", "hr", None, "M")
for i, (n, x, y, pk) in enumerate([("reading_id", 250, 1665, True), ("heart_rate_bpm", 215, 1775, False),
                                   ("temperature_c", 240, 1885, False), ("spo2_percent", 430, 1970, False),
                                   ("recorded_at", 760, 1970, False)]):
    A(f"ha{i}", x, y, n, pk); L(f"ha{i}", "hr")

# ---------- alerts and notifications ----------
E("alert", 1450, 1780, "ALERT")
R("r_trig", 1060, 1780, "triggers")
R("r_raise", 1450, 1300, "raises")
L("hr", "r_trig", "1"); L("r_trig", "alert", None, "0..1")
L("eld", "r_raise", "1"); L("r_raise", "alert", None, "M")
for i, (n, x, y, pk) in enumerate([("alert_id", 1250, 1620, True), ("alert_type", 1660, 1590, False),
                                   ("severity", 1230, 1930, False), ("message", 1450, 1990, False),
                                   ("status", 1660, 1930, False), ("triggered_at", 1720, 1670, False)]):
    A(f"aa{i}", x, y, n, pk); L(f"aa{i}", "alert")

E("notif", 2260, 1780, "NOTIFICATION")
R("r_gen", 1880, 1780, "generates")
L("alert", "r_gen", "1"); L("r_gen", "notif", None, "M")
for i, (n, x, y, pk) in enumerate([("notification_id", 2060, 1630, True), ("channel", 2050, 1930, False),
                                   ("message", 2260, 1990, False), ("status", 2470, 1930, False),
                                   ("sent_at", 2500, 1650, False)]):
    A(f"na{i}", x, y, n, pk); L(f"na{i}", "notif")

R("r_recv", 2860, 1300, "receives")
L("user", "r_recv", "1", via=[(1560, 266), (1560, 440), (2860, 440)])
L("r_recv", "notif", None, "M", via=[(2860, 1780)])

# ---------- thresholds ----------
E("thr", 2330, 1380, "THRESHOLD")
R("r_hasT", 2120, 1140, "has")
R("r_sets", 2560, 1130, "sets")
L("eld", "r_hasT", "1", via=[(1650, 776)]); L("r_hasT", "thr", None, "M")
L("prov", "r_sets", "1"); L("r_sets", "thr", None, "M")
for i, (n, x, y, pk) in enumerate([("threshold_id", 2050, 1470, True), ("vital_type", 2600, 1300, False), ("min_value", 2220, 1530, False),
                                   ("max_value", 2460, 1530, False), ("updated_at", 2620, 1440, False)]):
    A(f"ta{i}", x, y, n, pk); L(f"ta{i}", "thr")

out = sys.argv[1]
d.save(out, "ERD")
