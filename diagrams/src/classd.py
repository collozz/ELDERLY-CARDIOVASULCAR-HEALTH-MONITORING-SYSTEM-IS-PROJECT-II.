import sys
from dia import Diagram, uml_class

d = Diagram(2900, 1760)
d.card_size, d.card_weight, d.card_off = 23, 400, (34, 28)
K = {}


def cl(id, x, y, name, attrs, methods, w=None):
    K[id] = uml_class(d, id, x, y, name, attrs, methods, w)


# ---------------- row 1 ----------------
cl("role", 60, 120, "Role", ["- roleId: int", "- roleName: String", "- description: String"], ["+ getPermissions(): List"])
cl("user", 760, 80, "User", ["- userId: int", "- fullName: String", "- email: String", "- phoneNumber: String",
                             "- passwordHash: String"], ["+ login(): boolean", "+ logout(): void", "+ updateProfile(): void"])
cl("log", 1500, 120, "ActivityLog", ["- logId: int", "- action: String", "- details: String", "- loggedAt: DateTime"],
   ["+ record(): void"])

# ---------------- row 2 ----------------
cl("care", 60, 640, "Caregiver", ["- relationship: String"], ["+ viewDashboard(): void", "+ acknowledgeAlert(): void"])
cl("eld", 760, 640, "ElderlyPerson", ["- dateOfBirth: Date", "- gender: String", "- address: String",
                                      "- medicalHistory: String", "- emergencyContact: String"],
   ["+ viewVitals(): void", "+ pressPanicButton(): Alert"])
cl("thr", 1500, 660, "Threshold", ["- thresholdId: int", "- vitalType: String", "- minValue: double", "- maxValue: double"],
   ["+ isExceeded(value: double): boolean"])
cl("prov", 2240, 640, "HealthcareProvider", ["- specialization: String", "- licenseNumber: String"],
   ["+ setThreshold(): void", "+ generateReport(): void"])

# ---------------- row 3 ----------------
cl("dev", 60, 1150, "IoTDevice", ["- deviceId: int", "- deviceType: String", "- serialNumber: String", "- status: String"],
   ["+ sendReading(): HealthReading"])
cl("hr", 760, 1150, "HealthReading", ["- readingId: int", "- heartRateBpm: int", "- temperatureC: double",
                                      "- spo2Percent: double", "- recordedAt: DateTime"], ["+ isAbnormal(): boolean"])
cl("alert", 1500, 1150, "Alert", ["- alertId: int", "- alertType: String", "- severity: String", "- message: String",
                                  "- status: String"], ["+ trigger(): void", "+ resolve(): void"])
cl("notif", 2240, 1150, "Notification", ["- notificationId: int", "- channel: String", "- message: String",
                                         "- status: String", "- sentAt: DateTime"], ["+ send(): boolean"])
cl("sms", 2240, 1510, "SMSGateway", ["- provider: String", "- senderId: String"], ["+ sendSMS(): boolean"])


def L(id): return K[id].kw["x0"]
def R(id): return K[id].kw["x0"] + K[id].w
def T(id): return K[id].kw["y0"]
def B(id): return K[id].kw["y0"] + K[id].h
def CX(id): return K[id].kw["x0"] + K[id].w / 2


# generalisation: Caregiver, ElderlyPerson, HealthcareProvider are Users
BUS = 560
ux = CX("user")
d.link("eld", "user", via=[(ux, T("eld")), (ux, B("user"))], mb="tri")
d.link("care", "user", via=[(CX("care"), T("care")), (CX("care"), BUS), (ux, BUS), (ux, B("user"))], mb="tri")
d.link("prov", "user", via=[(CX("prov"), T("prov")), (CX("prov"), BUS), (ux, BUS), (ux, B("user"))], mb="tri")

# associations
y = 200
d.link("user", "role", ca="*", cb="1", via=[(L("user"), y), (R("role"), y)], label="has")
d.link("user", "log", ca="1", cb="*", via=[(R("user"), y), (L("log"), y)], label="performs")
y = 760
d.link("care", "eld", ca="*", cb="1..*", via=[(R("care"), y), (L("eld"), y)], label="cares for")
d.link("eld", "thr", via=[(R("eld"), y), (L("thr"), y)], ma="dia_f", ca="1", cb="1..*", label="has")
d.link("prov", "thr", via=[(L("prov"), 720), (R("thr"), 720)], ca="1", cb="*", label="sets")
d.link("prov", "eld", ca="*", cb="1..*", via=[(CX("prov"), B("prov")), (CX("prov"), 1060), (CX("eld") + 110, 1060),
                                             (CX("eld") + 110, B("eld"))], label="monitors")
d.link("eld", "dev", ca="1", cb="1..*", via=[(CX("eld") - 150, B("eld")), (CX("eld") - 150, 1080), (CX("dev"), 1080),
                                             (CX("dev"), T("dev"))], label="wears")
y = 1260
d.link("dev", "hr", via=[(R("dev"), y), (L("hr"), y)], ma="dia_f", ca="1", cb="*", label="records")
d.link("hr", "alert", via=[(R("hr"), y), (L("alert"), y)], ca="0..1", cb="0..1", label="triggers")
d.link("alert", "notif", via=[(R("alert"), y), (L("notif"), y)], ma="dia_f", ca="1", cb="1..*", label="generates")
d.link("eld", "alert", ca="1", cb="*", via=[(CX("eld"), B("eld")), (CX("eld"), 1110), (CX("alert"), 1110),
                                           (CX("alert"), T("alert"))], label="raises")
d.link("user", "notif", ca="1", cb="*", via=[(CX("user") + 120, T("user")), (CX("user") + 120, 40), (2860, 40),
                                             (2860, 1360), (R("notif"), 1360)], label="receives")
d.link("notif", "sms", via=[(CX("sms"), B("notif")), (CX("sms"), T("sms"))], mb="open", dashed=True, label="«uses»")

d.save(sys.argv[1], "Class Diagram")
