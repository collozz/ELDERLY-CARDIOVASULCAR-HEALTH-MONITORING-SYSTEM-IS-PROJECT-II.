"""Sequence diagram: SVG + draw.io from one spec."""
import sys
from xml.sax.saxutils import escape
from dia import text_w

FS = 22
P = [  # id, label, kind
    ("admin", "Admin", "actor"),
    ("eld", "Elderly Person", "actor"),
    ("care", "Caregiver", "actor"),
    ("prov", "Healthcare Provider", "actor"),
    ("web", "Web Dashboard", "box"),
    ("srv", "Server", "box"),
    ("db", "Database", "box"),
    ("sms", "SMS Gateway", "box"),
    ("iot", "IoT Device", "box"),
]
X0, DX = 150, 272
X = {p[0]: X0 + i * DX for i, p in enumerate(P)}
W = X0 * 2 + DX * (len(P) - 1)
HEAD_Y, HEAD_H = 50, 80
STEP = 58

SCEN = [
    ("1. Log in (same steps for every user)", [
        ("m", "care", "web", "enter email and password"),
        ("m", "web", "srv", "verify login"),
        ("m", "srv", "db", "find user"),
        ("r", "db", "srv", "user details"),
        ("r", "srv", "web", "login successful"),
        ("r", "web", "care", "open dashboard"),
    ]),
    ("2. Admin manages users and devices", [
        ("m", "admin", "web", "add user / device"),
        ("m", "web", "srv", "save details"),
        ("m", "srv", "db", "store record"),
        ("r", "srv", "web", "saved"),
        ("r", "web", "admin", "show confirmation"),
    ]),
    ("3. Healthcare provider sets thresholds", [
        ("m", "prov", "web", "set health thresholds"),
        ("m", "web", "srv", "save thresholds"),
        ("m", "srv", "db", "update thresholds"),
        ("r", "srv", "web", "saved"),
        ("r", "web", "prov", "show confirmation"),
    ]),
    ("4. IoT device sends readings every 3 seconds", [
        ("m", "iot", "srv", "send reading (HR, temp, SpO2)"),
        ("m", "srv", "db", "save reading"),
        ("s", "srv", "check thresholds"),
        ("m", "srv", "web", "update live readings"),
        ("alt", "[reading is abnormal]"),
        ("m", "srv", "db", "save alert"),
        ("m", "srv", "sms", "send SMS alert"),
        ("m", "sms", "care", "SMS: emergency alert"),
        ("m", "srv", "web", "show health alert"),
        ("r", "web", "prov", "receive emergency alert"),
        ("end",),
    ]),
    ("5. Elderly person presses the panic button", [
        ("m", "eld", "web", "press panic button"),
        ("m", "web", "srv", "raise emergency alert"),
        ("m", "srv", "db", "save alert"),
        ("m", "srv", "sms", "send SMS alert"),
        ("m", "sms", "care", "SMS: emergency alert"),
        ("r", "web", "eld", "help is on the way"),
    ]),
    ("6. Caregiver reviews heart rate data", [
        ("m", "care", "web", "review heart rate data"),
        ("m", "web", "srv", "get readings"),
        ("m", "srv", "db", "fetch readings"),
        ("r", "db", "srv", "readings"),
        ("r", "srv", "web", "readings"),
        ("r", "web", "care", "show charts and health summary"),
    ]),
]

svg, cells = [], []
cid = [0]


def nid():
    cid[0] += 1
    return f"c{cid[0]}"


def svg_text(x, y, s, size=FS, anchor="middle", bold=False, italic=False, bg=False):
    st = (' font-weight="700"' if bold else "") + (' font-style="italic"' if italic else "")
    if bg:
        w = text_w(s, size, bold) + 10
        x0 = x - w / 2 if anchor == "middle" else x - 5
        svg.append(f'<rect x="{x0:.1f}" y="{y - size:.1f}" width="{w:.1f}" height="{size + 8}" fill="#fff"/>')
    svg.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" font-size="{size}"{st}>{escape(s)}</text>')


def dr_text(x, y, w, h, s, style=""):
    cells.append(f'<mxCell id="{nid()}" value="{escape(s)}" style="text;html=1;fontSize={FS};fontFamily=Helvetica;align=center;verticalAlign=middle;{style}" vertex="1" parent="1">'
                 f'<mxGeometry x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" as="geometry"/></mxCell>')


def dr_line(x1, y1, x2, y2, style, label="", pts=()):
    arr = "".join(f'<mxPoint x="{a}" y="{b}"/>' for a, b in pts)
    arr = f'<Array as="points">{arr}</Array>' if arr else ""
    cells.append(f'<mxCell id="{nid()}" value="{escape(label)}" style="html=1;rounded=0;fontSize={FS};fontFamily=Helvetica;labelBackgroundColor=#FFFFFF;{style}" edge="1" parent="1">'
                 f'<mxGeometry relative="1" as="geometry"><mxPoint x="{x1:.0f}" y="{y1:.0f}" as="sourcePoint"/>'
                 f'<mxPoint x="{x2:.0f}" y="{y2:.0f}" as="targetPoint"/>{arr}</mxGeometry></mxCell>')


def dr_rect(x, y, w, h, style, value=""):
    cells.append(f'<mxCell id="{nid()}" value="{escape(value)}" style="html=1;whiteSpace=wrap;fontFamily=Helvetica;{style}" vertex="1" parent="1">'
                 f'<mxGeometry x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" as="geometry"/></mxCell>')


def arrow_head(x2, y2, dirx, filled):
    a = f"{x2:.1f},{y2:.1f} {x2 - dirx * 18:.1f},{y2 - 8:.1f} {x2 - dirx * 18:.1f},{y2 + 8:.1f}"
    if filled:
        svg.append(f'<polygon points="{a}" fill="#000"/>')
    else:
        svg.append(f'<polyline points="{x2 - dirx * 18:.1f},{y2 - 8:.1f} {x2:.1f},{y2:.1f} {x2 - dirx * 18:.1f},{y2 + 8:.1f}" fill="none" stroke="#000" stroke-width="2"/>')


# ---- layout pass ------------------------------------------------------------
y = HEAD_Y + HEAD_H + 50
msgs, acts, frames, alts = [], [], [], []
for title, steps in SCEN:
    y += 20
    frame_top = y
    y += 50
    touched = {}
    alt_open = None
    for st in steps:
        k = st[0]
        if k == "alt":
            alt_open = (y, st[1]); y += 46; continue
        if k == "end":
            alts.append((alt_open[0], y - 14, alt_open[1])); alt_open = None; y += 10; continue
        msgs.append((y, st))
        ids = [st[1]] if k == "s" else [st[1], st[2]]
        for i in ids:
            lo, hi = touched.get(i, (y, y))
            touched[i] = (min(lo, y), max(hi, y + (36 if k == "s" else 0)))
        y += STEP + (24 if k == "s" else 0)
    for i, (lo, hi) in touched.items():
        acts.append((i, lo - 14, hi + 14))
    frames.append((frame_top, y, title))
    y += 30
H = y + 40

# ---- draw -------------------------------------------------------------------
svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
           f'font-family="Liberation Sans, Arial, Helvetica, sans-serif"><rect width="100%" height="100%" fill="#fff"/>')

# scenario frames
for top, bot, title in frames:
    tw = text_w(title, FS, True) + 30
    svg.append(f'<rect x="30" y="{top}" width="{W-60}" height="{bot-top}" fill="none" stroke="#000" stroke-width="1.6"/>')
    dr_rect(30, top, W - 60, bot - top, f"shape=umlFrame;width={tw:.0f};height=40;fontSize={FS};fontStyle=1;align=left;spacingLeft=10;fillColor=none;", title)

# lifelines and heads
for pid, label, kind in P:
    x = X[pid]
    svg.append(f'<line x1="{x}" y1="{HEAD_Y + HEAD_H}" x2="{x}" y2="{H - 30}" stroke="#000" stroke-width="1.6" stroke-dasharray="10 7"/>')
    lines = label.split("\n")
    if kind == "actor":
        t = HEAD_Y - 10
        svg.append(f'<circle cx="{x}" cy="{t+12}" r="12" fill="#fff" stroke="#000" stroke-width="2.2"/>'
                   f'<line x1="{x}" y1="{t+24}" x2="{x}" y2="{t+56}" stroke="#000" stroke-width="2.2"/>'
                   f'<line x1="{x-22}" y1="{t+36}" x2="{x+22}" y2="{t+36}" stroke="#000" stroke-width="2.2"/>'
                   f'<line x1="{x}" y1="{t+56}" x2="{x-18}" y2="{t+84}" stroke="#000" stroke-width="2.2"/>'
                   f'<line x1="{x}" y1="{t+56}" x2="{x+18}" y2="{t+84}" stroke="#000" stroke-width="2.2"/>')
        svg.append(f'<rect x="{x-110}" y="{t+88}" width="220" height="30" fill="#fff"/>')
        svg_text(x, t + 110, label, bold=True)
        dr_rect(x - 20, HEAD_Y - 10, 40, 84, f"shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;fontSize={FS};fontStyle=1;", label)
    else:
        bw = 230
        svg.append(f'<rect x="{x-bw/2}" y="{HEAD_Y}" width="{bw}" height="{HEAD_H}" fill="#fff" stroke="#000" stroke-width="2"/>')
        for i, ln in enumerate(lines):
            svg_text(x, HEAD_Y + HEAD_H / 2 + 8 + (i - (len(lines) - 1) / 2) * 28, ln, bold=(i == 0))
        dr_rect(x - bw / 2, HEAD_Y, bw, HEAD_H, f"fontSize={FS};fontStyle=1;", "<br>".join(lines))
    dr_line(x, HEAD_Y + HEAD_H, x, H - 30, "endArrow=none;dashed=1;strokeWidth=1.6;")

# alt fragments
for top, bot, guard in alts:
    xs = [X["eld"] + 40, X["iot"] + 70]
    svg.append(f'<rect x="{xs[0]}" y="{top}" width="{xs[1]-xs[0]}" height="{bot-top}" fill="none" stroke="#000" stroke-width="1.8"/>')
    svg.append(f'<polygon points="{xs[0]},{top} {xs[0]+70},{top} {xs[0]+70},{top+22} {xs[0]+58},{top+34} {xs[0]},{top+34}" fill="#fff" stroke="#000" stroke-width="1.8"/>')
    svg_text(xs[0] + 30, top + 25, "alt", bold=True)
    svg_text(xs[0] + 84, top + 26, guard, anchor="start", italic=True, bg=True)
    dr_rect(xs[0], top, xs[1] - xs[0], bot - top, f"shape=umlFrame;width=70;height=34;fontSize={FS};fontStyle=1;fillColor=none;", "alt")
    dr_text(xs[0] + 80, top + 2, text_w(guard, FS) + 20, 32, guard, "align=left;fontStyle=2;")

# activation bars
for pid, lo, hi in acts:
    x = X[pid]
    svg.append(f'<rect x="{x-9}" y="{lo}" width="18" height="{hi-lo}" fill="#fff" stroke="#000" stroke-width="1.8"/>')
    dr_rect(x - 9, lo, 18, hi - lo, "fillColor=#FFFFFF;")

# frame tabs on top of lifelines
for top, bot, title in frames:
    tw = text_w(title, FS, True) + 30
    svg.append(f'<polygon points="30,{top} {30+tw},{top} {30+tw},{top+26} {16+tw},{top+40} 30,{top+40}" fill="#fff" stroke="#000" stroke-width="1.6"/>')
    svg_text(45, top + 28, title, anchor="start", bold=True)

# messages
for y, st in msgs:
    k = st[0]
    if k == "s":
        x = X[st[1]] + 9
        svg.append(f'<polyline points="{x},{y} {x+60},{y} {x+60},{y+36} {x+2},{y+36}" fill="none" stroke="#000" stroke-width="2"/>')
        arrow_head(x, y + 36, -1, True)
        svg_text(x + 72, y + 24, st[2], anchor="start", bg=True)
        dr_line(x, y, x, y + 36, "endArrow=block;endFill=1;strokeWidth=2;align=left;spacingLeft=70;", st[2],
                pts=[(x + 60, y), (x + 60, y + 36)])
        continue
    a, b = X[st[1]], X[st[2]]
    d = 1 if b > a else -1
    x1, x2 = a + 9 * d, b - 9 * d
    ret = k == "r"
    da = ' stroke-dasharray="10 6"' if ret else ""
    svg.append(f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="#000" stroke-width="2"{da}/>')
    arrow_head(x2, y, d, not ret)
    svg_text((x1 + x2) / 2, y - 10, st[3], bg=True)
    style = "endArrow=open;endSize=12;dashed=1;strokeWidth=2;" if ret else "endArrow=block;endFill=1;strokeWidth=2;"
    dr_line(x1, y, x2, y, style + "verticalAlign=bottom;", st[3])

svg.append("</svg>")
out = sys.argv[1]
open(out + ".svg", "w").write("\n".join(svg))
open(out + ".drawio", "w").write(
    f'<mxfile host="app.diagrams.net"><diagram name="Sequence Diagram"><mxGraphModel dx="{W}" dy="{H}" grid="1" gridSize="10" '
    f'page="1" pageWidth="{W}" pageHeight="{H}"><root><mxCell id="0"/><mxCell id="1" parent="0"/>{"".join(cells)}</root></mxGraphModel></diagram></mxfile>')
