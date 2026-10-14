import sys
from dia import Diagram, table, row_y

d = Diagram(2880, 1620)
X = [40, 760, 1480, 2200]
W = 520

T = {}
def tb(id, col, y, name, rows):
    T[id] = table(d, id, X[col], y, name, rows, W)

tb("role", 0, 80, "tbl_role", [("PK", "role_id", "INT"), ("", "role_name", "VARCHAR(50)"), ("", "description", "VARCHAR(255)")])
tb("user", 1, 80, "tbl_user", [("PK", "user_id", "INT"), ("FK", "role_id", "INT"), ("", "full_name", "VARCHAR(100)"),
                               ("", "email", "VARCHAR(150)"), ("", "phone_number", "VARCHAR(20)"),
                               ("", "password_hash", "VARCHAR(255)"), ("", "created_at", "DATETIME")])
tb("log", 2, 80, "tbl_activity_log", [("PK", "log_id", "INT"), ("FK", "user_id", "INT"), ("", "action", "VARCHAR(100)"),
                                      ("", "details", "TEXT"), ("", "logged_at", "DATETIME")])

tb("care", 0, 520, "tbl_caregiver", [("PK", "caregiver_id", "INT"), ("FK", "user_id", "INT"), ("", "relationship", "VARCHAR(50)")])
tb("eld", 1, 560, "tbl_elderly_profile", [("PK", "elderly_id", "INT"), ("FK", "user_id", "INT"), ("", "date_of_birth", "DATE"),
                                          ("", "gender", "VARCHAR(10)"), ("", "address", "VARCHAR(255)"),
                                          ("", "medical_history", "TEXT"), ("", "emergency_contact_name", "VARCHAR(100)"),
                                          ("", "emergency_contact_phone", "VARCHAR(20)")])
tb("thr", 2, 520, "tbl_threshold", [("PK", "threshold_id", "INT"), ("FK", "elderly_id", "INT"), ("FK", "provider_id", "INT"),
                                    ("", "vital_type", "VARCHAR(20)"), ("", "min_value", "DECIMAL(5,1)"),
                                    ("", "max_value", "DECIMAL(5,1)"), ("", "updated_at", "DATETIME")])
tb("prov", 3, 480, "tbl_healthcare_provider", [("PK", "provider_id", "INT"), ("FK", "user_id", "INT"),
                                              ("", "specialization", "VARCHAR(100)"), ("", "license_number", "VARCHAR(50)")])
tb("cga", 0, 760, "tbl_caregiver_assignment", [("PK", "assignment_id", "INT"), ("FK", "caregiver_id", "INT"),
                                               ("FK", "elderly_id", "INT"), ("", "assigned_at", "DATETIME")])
tb("pva", 3, 760, "tbl_provider_assignment", [("PK", "assignment_id", "INT"), ("FK", "provider_id", "INT"),
                                              ("FK", "elderly_id", "INT"), ("", "assigned_at", "DATETIME")])

tb("dev", 0, 1180, "tbl_device", [("PK", "device_id", "INT"), ("FK", "elderly_id", "INT"), ("", "device_type", "VARCHAR(50)"),
                                  ("", "serial_number", "VARCHAR(50)"), ("", "status", "VARCHAR(20)"),
                                  ("", "last_synced_at", "DATETIME")])
tb("hr", 1, 1180, "tbl_health_reading", [("PK", "reading_id", "INT"), ("FK", "device_id", "INT"), ("", "heart_rate_bpm", "INT"),
                                         ("", "temperature_c", "DECIMAL(4,1)"), ("", "spo2_percent", "DECIMAL(5,2)"),
                                         ("", "recorded_at", "DATETIME")])
tb("alert", 2, 1180, "tbl_alert", [("PK", "alert_id", "INT"), ("FK", "elderly_id", "INT"), ("FK", "reading_id", "INT"),
                                   ("", "alert_type", "VARCHAR(20)"), ("", "severity", "VARCHAR(20)"),
                                   ("", "message", "VARCHAR(255)"), ("", "status", "VARCHAR(20)"), ("", "triggered_at", "DATETIME")])
tb("notif", 3, 1180, "tbl_notification", [("PK", "notification_id", "INT"), ("FK", "alert_id", "INT"),
                                          ("FK", "recipient_user_id", "INT"), ("", "channel", "VARCHAR(10)"),
                                          ("", "message", "VARCHAR(255)"), ("", "status", "VARCHAR(20)"), ("", "sent_at", "DATETIME")])


def left(t): return T[t].kw["x0"]
def right(t): return T[t].kw["x0"] + W
def top(t): return T[t].kw["y0"]
def bottom(t): return T[t].kw["y0"] + T[t].h
def ry(t, c): return row_y(d, t, c)
def cx(t, off=0): return T[t].kw["x0"] + W / 2 + off


def side(a, ca, b, cb, label, ma="1", mb="0M"):
    """Parent a (row ca) to child b (row cb), leaving from facing sides with one jog."""
    if right(a) < left(b):
        x1, x2 = right(a), left(b)
    else:
        x1, x2 = left(a), right(b)
    y1, y2 = ry(a, ca), ry(b, cb)
    mx = (x1 + x2) / 2
    pts = [(x1, y1), (x2, y2)] if y1 == y2 else [(x1, y1), (mx, y1), (mx, y2), (x2, y2)]
    d.link(a, b, via=pts, ma=ma, mb=mb, label=label, lpos=(mx, (y1 + y2) / 2))


side("role", "role_id", "user", "role_id", "has")
side("user", "user_id", "log", "user_id", "performs")
# user -> subtypes
d.link("user", "care", via=[(left("user"), 390), (cx("care"), 390), (cx("care"), top("care"))], ma="1", mb="01", label="is a")
d.link("user", "eld", via=[(cx("user"), bottom("user")), (cx("user"), top("eld"))], ma="1", mb="01", label="is a")
d.link("user", "prov", via=[(right("user"), 390), (cx("prov"), 390), (cx("prov"), top("prov"))], ma="1", mb="01", label="is a")
# assignments
d.link("care", "cga", via=[(cx("care"), bottom("care")), (cx("care"), top("cga"))], ma="1", mb="0M")
d.link("eld", "cga", via=[(left("eld"), ry("cga", "elderly_id")), (right("cga"), ry("cga", "elderly_id"))], ma="1", mb="0M", label="assigned")
d.link("prov", "pva", via=[(cx("prov"), bottom("prov")), (cx("prov"), top("pva"))], ma="1", mb="0M")
d.link("eld", "pva", via=[(right("eld"), ry("pva", "elderly_id")), (left("pva"), ry("pva", "elderly_id"))], ma="1", mb="0M", label="assigned")
# thresholds
side("eld", "gender", "thr", "elderly_id", "has")
side("prov", "provider_id", "thr", "provider_id", "sets")
# device, readings, alerts
d.link("eld", "dev", via=[(cx("eld", -140), bottom("eld")), (cx("eld", -140), 1100), (cx("dev"), 1100), (cx("dev"), top("dev"))], ma="1", mb="0M", label="wears")
side("dev", "device_id", "hr", "device_id", "records")
side("hr", "reading_id", "alert", "reading_id", "triggers", ma="01", mb="01")
d.link("eld", "alert", via=[(cx("eld", 140), bottom("eld")), (cx("eld", 140), 1100), (cx("alert"), 1100), (cx("alert"), top("alert"))], ma="1", mb="0M", label="raises")
side("alert", "alert_id", "notif", "alert_id", "generates")
d.link("user", "notif", via=[(cx("user", 160), top("user")), (cx("user", 160), 40), (2820, 40), (2820, ry("notif", "recipient_user_id")),
                             (right("notif"), ry("notif", "recipient_user_id"))], ma="1", mb="0M", label="receives")

d.save(sys.argv[1], "Database Schema")
