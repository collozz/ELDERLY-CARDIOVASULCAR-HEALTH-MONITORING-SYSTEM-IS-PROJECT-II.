import sys
from dia import Diagram, actor, usecase

d = Diagram(2400, 1600)

d.box(600, 120, 1200, 1420, stroke="#000")
d.text(1200, 178, "Web-Based IoT-Enabled Heart Rate Monitoring and Emergency Alert System", 27, True, anchor="middle")

LX, RX = 300, 2100
actor(d, "admin", LX, 330, "Admin")
actor(d, "eld", LX, 1010, "Elderly Person")
actor(d, "sms", LX, 1420, "SMS Gateway")
actor(d, "prov", RX, 330, "Healthcare\nProvider")
actor(d, "care", RX, 1020, "Caregiver /\nFamily Member")
actor(d, "iot", RX, 1420, "IoT Device\n(ESP32)")

CL, CC, CR = 860, 1200, 1540
for id, x, y, label, w in [
    ("login", CC, 680, "Login", 240),
    ("reg", CC, 830, "Register", 240),
    ("users", CL, 270, "Manage Users", 320), ("devices", CL, 380, "Manage Devices", 320),
    ("vitals", CL, 980, "View Vital Signs", 320), ("panic", CL, 1100, "Press Panic Button", 320),
    ("thr", CR, 240, "Set Health Thresholds", 320), ("report", CR, 345, "Generate Health Report", 320),
    ("recv", CR, 450, "Receive Emergency Alert", 320),
    ("review", CR, 980, "Review Heart Rate Data", 320), ("summary", CR, 1100, "Provide Health Summary", 320),
    ("monitor", CR, 1310, "Monitor Heart Rate", 320), ("send", CC, 1460, "Send Alerts", 300),
]:
    usecase(d, id, x, y, label, w=w, h=90)

for a, ucs in [("admin", ["users", "devices", "login"]), ("eld", ["login", "reg", "vitals", "panic"]),
               ("sms", ["send"]), ("prov", ["thr", "report", "recv", "login"]),
               ("care", ["login", "reg", "review", "summary"]), ("iot", ["monitor", "send"])]:
    for u in ucs:
        d.link(a, u, mb="open")

d.save(sys.argv[1], "Use Case Diagram")
