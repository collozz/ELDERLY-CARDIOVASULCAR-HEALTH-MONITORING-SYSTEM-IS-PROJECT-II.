"""Tiny diagram library: place shapes by hand, export SVG (for PNG) and draw.io XML."""
import math
from xml.sax.saxutils import escape
from PIL import ImageFont

FONT_DIR = "/usr/share/fonts/truetype/liberation/"
_fonts = {}


def font(size, bold=False):
    key = (size, bold)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(FONT_DIR + ("LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf"), size)
    return _fonts[key]


def text_w(s, size, bold=False):
    return font(size, bold).getlength(s)


C = {
    "entity_fill": "#FFFFFF", "entity_stroke": "#000000",
    "attr_fill": "#FFFFFF", "attr_stroke": "#000000",
    "rel_fill": "#FFFFFF", "rel_stroke": "#000000",
    "line": "#000000", "text": "#000000", "card": "#000000",
}


class Shape:
    def __init__(self, id, kind, x, y, w, h, label, **kw):
        self.id, self.kind, self.x, self.y, self.w, self.h, self.label = id, kind, x, y, w, h, label
        self.kw = kw

    def clip(self, px, py):
        """Point on boundary along the ray from centre toward (px, py)."""
        dx, dy = px - self.x, py - self.y
        if dx == 0 and dy == 0:
            return self.x, self.y
        hw, hh = self.w / 2, self.h / 2
        if self.kind in ("attr", "ellipse"):
            t = 1 / math.sqrt((dx / hw) ** 2 + (dy / hh) ** 2)
        elif self.kind in ("rel", "isa"):
            t = 1 / (abs(dx) / hw + abs(dy) / hh)
        else:
            t = min(hw / abs(dx) if dx else 1e9, hh / abs(dy) if dy else 1e9)
        return self.x + dx * t, self.y + dy * t


class Diagram:
    def __init__(self, w, h, title=None):
        self.w, self.h, self.title = w, h, title
        self.shapes, self.edges, self.texts, self.rects = {}, [], [], []
        self.card_size, self.card_weight, self.card_off = 27, 700, (30, 20)

    # ---- shapes -------------------------------------------------------
    def entity(self, id, x, y, label, size=28, w=None, h=72):
        w = w or text_w(label, size, True) + 70
        self.shapes[id] = Shape(id, "entity", x, y, w, h, label, size=size)
        return id

    def attr(self, id, x, y, label, pk=False, size=23):
        w = text_w(label, size) + 56
        self.shapes[id] = Shape(id, "attr", x, y, w, 54, label, size=size, pk=pk)
        return id

    def rel(self, id, x, y, label, size=23):
        w = text_w(label, size) * 1.0 + 90
        self.shapes[id] = Shape(id, "rel", x, y, max(w, 150), 86, label, size=size)
        return id

    def isa(self, id, x, y):
        self.shapes[id] = Shape(id, "isa", x, y, 110, 70, "ISA", size=22)
        return id

    def text(self, x, y, s, size=22, bold=False, anchor="start", color=None, underline=False):
        self.texts.append((x, y, s, size, bold, anchor, color or C["text"], underline))

    def box(self, x, y, w, h, stroke="#888", fill="none", dash=None):
        self.rects.append((x, y, w, h, stroke, fill, dash))

    # ---- edges --------------------------------------------------------
    def link(self, a, b, ca=None, cb=None, via=(), double_b=False, ma=None, mb=None, label=None, lpos=None, dashed=False, exact=False):
        self.edges.append(dict(a=a, b=b, ca=ca, cb=cb, via=list(via), double_b=double_b, ma=ma, mb=mb, label=label, lpos=lpos, dashed=dashed, exact=exact))

    def _points(self, e):
        A, B = self.shapes[e["a"]], self.shapes[e["b"]]
        via = list(e["via"])
        if e.get("exact"):
            return via
        def inside(S, p):
            return abs(p[0] - S.x) <= S.w / 2 + 0.5 and abs(p[1] - S.y) <= S.h / 2 + 0.5
        start = via.pop(0) if via and inside(A, via[0]) else None
        end = via.pop() if via and inside(B, via[-1]) else None
        first = via[0] if via else (B.x, B.y)
        last = via[-1] if via else (A.x, A.y)
        p0 = A.clip(*first) if A.kind != "isa" else (A.x, A.y + A.h / 2)
        p1 = B.clip(*last)
        if start: p0 = start
        if end: p1 = end
        return [p0] + via + [p1]

    # ---- SVG ----------------------------------------------------------
    def svg(self):
        o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
             f'viewBox="0 0 {self.w} {self.h}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">',
             f'<rect width="100%" height="100%" fill="#FFFFFF"/>']
        for x, y, w, h, stroke, fill, dash in self.rects:
            d = f' stroke-dasharray="{dash}"' if dash else ""
            o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="2"{d}/>')
        if self.title:
            o.append(f'<text x="{self.w/2}" y="62" text-anchor="middle" font-size="40" font-weight="700" fill="{C["text"]}">{escape(self.title)}</text>')
        labels = []
        for e in self.edges:
            pts = self._points(e)
            d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
            da = ' stroke-dasharray="12 8"' if e.get("dashed") else ""
            o.append(f'<polyline points="{d}" fill="none" stroke="{C["line"]}" stroke-width="2.4"{da}/>')
            if e.get("ma"): labels.append(_marker(e["ma"], pts[0], pts[1]))
            if e.get("mb"): labels.append(_marker(e["mb"], pts[-1], pts[-2]))
            if e.get("label"):
                segs = list(zip(pts, pts[1:]))
                (p, q) = max(segs, key=lambda s: math.hypot(s[1][0]-s[0][0], s[1][1]-s[0][1]))
                mx, my = e["lpos"] or ((p[0]+q[0])/2, (p[1]+q[1])/2)
                tw = text_w(e["label"], 21) + 12
                labels.append(f'<rect x="{mx-tw/2:.1f}" y="{my-15:.1f}" width="{tw:.1f}" height="30" fill="#fff"/>'
                              f'<text x="{mx:.1f}" y="{my+7:.1f}" text-anchor="middle" font-size="21" font-style="italic">{escape(e["label"])}</text>')
            for card, (p, q) in ((e["ca"], (pts[0], pts[1])), (e["cb"], (pts[-1], pts[-2]))):
                if not card:
                    continue
                dx, dy = q[0] - p[0], q[1] - p[1]
                L = math.hypot(dx, dy) or 1
                ux, uy = dx / L, dy / L
                nx, ny = -uy, ux
                if ny > 0 or (ny == 0 and nx < 0):
                    nx, ny = -nx, -ny   # keep label above / right of the line
                lx, ly = p[0] + ux * self.card_off[0] + nx * self.card_off[1], p[1] + uy * self.card_off[0] + ny * self.card_off[1]
                labels.append(f'<text x="{lx:.1f}" y="{ly + 9:.1f}" text-anchor="middle" font-size="{self.card_size}" '
                              f'font-weight="{self.card_weight}" fill="{C["card"]}" stroke="#fff" stroke-width="6" '
                              f'paint-order="stroke">{escape(card)}</text>')
        for s in self.shapes.values():
            o.append(self._svg_shape(s))
        o += labels
        for x, y, s, size, bold, anchor, color, ul in self.texts:
            u = ' text-decoration="underline"' if ul else ""
            o.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}" '
                     f'font-weight="{700 if bold else 400}" fill="{color}"{u}>{escape(s)}</text>')
        o.append("</svg>")
        return "\n".join(o)

    def _svg_shape(self, s):
        x, y, w, h = s.x, s.y, s.w, s.h
        size = s.kw.get("size", 22)
        ty = y + size * 0.36
        lab = escape(s.label)
        if s.kind == "entity":
            return (f'<rect x="{x-w/2:.1f}" y="{y-h/2:.1f}" width="{w:.1f}" height="{h}" fill="{C["entity_fill"]}" '
                    f'stroke="{C["entity_stroke"]}" stroke-width="2"/>'
                    f'<text x="{x}" y="{ty:.1f}" text-anchor="middle" font-size="{size}" font-weight="700">{lab}</text>')
        if s.kind == "attr":
            u = ' text-decoration="underline" font-weight="700"' if s.kw.get("pk") else ""
            return (f'<ellipse cx="{x}" cy="{y}" rx="{w/2:.1f}" ry="{h/2}" fill="{C["attr_fill"]}" '
                    f'stroke="{C["attr_stroke"]}" stroke-width="2"/>'
                    f'<text x="{x}" y="{ty:.1f}" text-anchor="middle" font-size="{size}"{u}>{lab}</text>')
        if s.kind == "rel":
            pts = f"{x},{y-h/2} {x+w/2},{y} {x},{y+h/2} {x-w/2},{y}"
            return (f'<polygon points="{pts}" fill="{C["rel_fill"]}" stroke="{C["rel_stroke"]}" stroke-width="2.6"/>'
                    f'<text x="{x}" y="{ty:.1f}" text-anchor="middle" font-size="{size}" font-style="italic">{lab}</text>')
        if s.kind == "table":
            return svg_table(s)
        if s.kind == "class":
            return svg_class(s)
        if s.kind == "actor":
            return svg_actor(s)
        if s.kind == "ellipse":
            return svg_usecase(s)
        if s.kind == "isa":
            pts = f"{x-w/2},{y-h/2} {x+w/2},{y-h/2} {x},{y+h/2}"
            return (f'<polygon points="{pts}" fill="{C["rel_fill"]}" stroke="{C["rel_stroke"]}" stroke-width="2.6"/>'
                    f'<text x="{x}" y="{y - 6}" text-anchor="middle" font-size="{size}" font-weight="700">ISA</text>')
        return ""

    # ---- draw.io --------------------------------------------------------
    def drawio(self, name="Diagram"):
        cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
        styles = {
            "entity": f"rounded=0;whiteSpace=wrap;html=1;fontStyle=1;fillColor={C['entity_fill']};strokeColor={C['entity_stroke']};strokeWidth=3;",
            "attr": f"ellipse;whiteSpace=wrap;html=1;fillColor={C['attr_fill']};strokeColor={C['attr_stroke']};strokeWidth=2;",
            "rel": f"rhombus;whiteSpace=wrap;html=1;fontStyle=2;fillColor={C['rel_fill']};strokeColor={C['rel_stroke']};strokeWidth=2;",
            "actor": "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;fontStyle=1;",
            "ellipse": "ellipse;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeWidth=2;",
            "isa": f"triangle;direction=south;whiteSpace=wrap;html=1;fontStyle=1;verticalAlign=top;fillColor={C['rel_fill']};strokeColor={C['rel_stroke']};strokeWidth=2;",
        }
        for x, y, w, h, stroke, fill, dash in self.rects:
            st = f"rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor={fill if fill != 'none' else 'none'};strokeColor={stroke};" + ("dashed=1;" if dash else "")
            cells.append(f'<mxCell id="r{len(cells)}" value="" style="{st}" vertex="1" parent="1">'
                         f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        for s in self.shapes.values():
            if s.kind == "class":
                cells += drawio_class(s)
                continue
            if s.kind == "table":
                x0, y0 = s.kw["x0"], s.kw["y0"]
                cells.append(f'<mxCell id="{s.id}" value="{escape(s.label)}" style="swimlane;fontStyle=1;startSize={HEAD_H};html=1;fontSize=25;fontFamily=Helvetica;fillColor=#FFFFFF;swimlaneFillColor=#FFFFFF;" vertex="1" parent="1">'
                             f'<mxGeometry x="{x0}" y="{y0}" width="{s.w:.0f}" height="{s.h:.0f}" as="geometry"/></mxCell>')
                for i, (k, col, typ) in enumerate(s.kw["rows"]):
                    ry = HEAD_H + ROW_H * i
                    for j, (val, cx, cw, extra) in enumerate([(k, 0, 66, "align=center;fontStyle=1;"),
                                                              (col, 70, s.w - 250, "align=left;" + ("fontStyle=5;" if k == "PK" else "")),
                                                              (typ, s.w - 190, 180, "align=right;")]):
                        cells.append(f'<mxCell id="{s.id}_{i}_{j}" value="{escape(val)}" style="text;html=1;fontSize={TFS};fontFamily=Helvetica;spacingLeft=6;spacingRight=6;verticalAlign=middle;{extra}" vertex="1" parent="{s.id}">'
                                     f'<mxGeometry x="{cx}" y="{ry}" width="{cw:.0f}" height="{ROW_H}" as="geometry"/></mxCell>')
                continue
            st = styles[s.kind] + f"fontSize={s.kw.get('size', 22)};fontFamily=Helvetica;"
            if s.kind == "attr" and s.kw.get("pk"):
                st += "fontStyle=5;"
            cells.append(f'<mxCell id="{s.id}" value="{escape(s.label.replace(chr(10), "<br>"), {chr(34): "&quot;"})}" style="{st}" vertex="1" parent="1">'
                         f'<mxGeometry x="{s.x-s.w/2:.0f}" y="{s.y-s.h/2:.0f}" width="{s.w:.0f}" height="{s.h:.0f}" as="geometry"/></mxCell>')
        for i, e in enumerate(self.edges):
            eid = f"e{i}"
            pts = "".join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in e["via"])
            arr = f'<Array as="points">{pts}</Array>' if pts else ""
            ends = ""
            if e.get("ma"): ends += f"startArrow={DRAWIO_END[e['ma']]};startFill={DRAWIO_FILL.get(e['ma'], 0)};startSize=16;"
            if e.get("mb"): ends += f"endArrow={DRAWIO_END[e['mb']]};endFill={DRAWIO_FILL.get(e['mb'], 0)};endSize=16;"
            if e.get("dashed"): ends += "dashed=1;"
            else: ends += "endArrow=none;"
            lab = escape(e.get("label") or "")
            cells.append(f'<mxCell id="{eid}" value="{lab}" style="{ends}html=1;rounded=0;strokeWidth=2;fontSize=21;fontStyle=2;" edge="1" parent="1" '
                         f'source="{e["a"]}" target="{e["b"]}"><mxGeometry relative="1" as="geometry">{arr}</mxGeometry></mxCell>')
            for card, pos in ((e["ca"], -0.8), (e["cb"], 0.8)):
                if card:
                    cells.append(f'<mxCell id="{eid}{"s" if pos < 0 else "t"}" value="{escape(card)}" '
                                 f'style="edgeLabel;html=1;fontSize=24;fontStyle=1;fontColor={C["card"]};" vertex="1" connectable="0" parent="{eid}">'
                                 f'<mxGeometry x="{pos}" relative="1" as="geometry"><mxPoint as="offset"/></mxGeometry></mxCell>')
        for j, (x, y, s, size, bold, anchor, color, ul) in enumerate(self.texts):
            w = text_w(s, size, bold) + 10
            x0 = x - w / 2 if anchor == "middle" else x
            cells.append(f'<mxCell id="t{j}" value="{escape(s)}" style="text;html=1;fontSize={size};fontStyle={(1 if bold else 0) + (4 if ul else 0)};align=left;fontColor={color};" vertex="1" parent="1">'
                         f'<mxGeometry x="{x0:.0f}" y="{y-size:.0f}" width="{w:.0f}" height="{size*1.4:.0f}" as="geometry"/></mxCell>')
        if self.title:
            cells.append(f'<mxCell id="title" value="{escape(self.title)}" style="text;html=1;fontSize=40;fontStyle=1;align=center;" vertex="1" parent="1">'
                         f'<mxGeometry x="0" y="20" width="{self.w}" height="60" as="geometry"/></mxCell>')
        return (f'<mxfile host="app.diagrams.net"><diagram name="{escape(name)}">'
                f'<mxGraphModel dx="{self.w}" dy="{self.h}" grid="1" gridSize="10" page="1" pageWidth="{self.w}" pageHeight="{self.h}">'
                f'<root>{"".join(cells)}</root></mxGraphModel></diagram></mxfile>')

    def save(self, base, name):
        open(base + ".svg", "w").write(self.svg())
        open(base + ".drawio", "w").write(self.drawio(name))


# ---------------------------------------------------------------------------
# Tables and crow's-foot links (database schema)
ROW_H, HEAD_H, TFS = 40, 52, 22


def table(d, id, x, y, name, rows, w=520):
    """x, y = top-left. rows = [(key, column, type)]."""
    h = HEAD_H + ROW_H * len(rows)
    d.shapes[id] = Shape(id, "table", x + w / 2, y + h / 2, w, h, name, rows=rows, x0=x, y0=y)
    return d.shapes[id]


def row_y(d, id, col):
    s = d.shapes[id]
    names = [r[1] for r in s.kw["rows"]]
    return s.kw["y0"] + HEAD_H + ROW_H * names.index(col) + ROW_H / 2


def _marker(kind, p, q):
    """SVG for a crow's-foot end at point p, line heading toward q."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    L = math.hypot(dx, dy) or 1
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    out = []
    def tick(t, half=13):
        cx, cy = p[0] + ux * t, p[1] + uy * t
        out.append(f'<line x1="{cx+nx*half:.1f}" y1="{cy+ny*half:.1f}" x2="{cx-nx*half:.1f}" y2="{cy-ny*half:.1f}" stroke="#000" stroke-width="2.4"/>')
    def circle(t):
        cx, cy = p[0] + ux * t, p[1] + uy * t
        out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="8" fill="#fff" stroke="#000" stroke-width="2.4"/>')
    def crow():
        bx, by = p[0] + ux * 24, p[1] + uy * 24
        for s in (1, -1):
            out.append(f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{p[0]+nx*15*s:.1f}" y2="{p[1]+ny*15*s:.1f}" stroke="#000" stroke-width="2.4"/>')
    if kind == "1":
        tick(12); tick(22)
    elif kind == "01":
        tick(14); circle(32)
    elif kind == "0M":
        crow(); circle(34)
    elif kind == "1M":
        crow(); tick(30)
    elif kind in ("tri", "dia_f", "dia_o", "open"):
        def P(t, n): return (p[0] + ux * t + nx * n, p[1] + uy * t + ny * n)
        if kind == "tri":
            pts = [P(0, 0), P(26, 16), P(26, -16)]
            fill = "#fff"
        elif kind == "open":
            a1, a2 = P(22, 12), P(22, -12)
            out.append(f'<polyline points="{a1[0]:.1f},{a1[1]:.1f} {p[0]:.1f},{p[1]:.1f} {a2[0]:.1f},{a2[1]:.1f}" fill="none" stroke="#000" stroke-width="2.4"/>')
            return "".join(out)
        else:
            pts = [P(0, 0), P(18, 11), P(36, 0), P(18, -11)]
            fill = "#000" if kind == "dia_f" else "#fff"
        out.append('<polygon points="' + " ".join(f"{a:.1f},{b:.1f}" for a, b in pts) + f'" fill="{fill}" stroke="#000" stroke-width="2.4"/>')
    return "".join(out)


DRAWIO_END = {"1": "ERmandOne", "01": "ERzeroToOne", "0M": "ERzeroToMany", "1M": "ERoneToMany",
              "tri": "block", "dia_f": "diamondThin", "dia_o": "diamondThin", "open": "open"}
DRAWIO_FILL = {"dia_f": 1}


def svg_table(s):
    x, y, w, h = s.kw["x0"], s.kw["y0"], s.w, s.h
    o = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" stroke="#000" stroke-width="2"/>',
         f'<line x1="{x}" y1="{y+HEAD_H}" x2="{x+w}" y2="{y+HEAD_H}" stroke="#000" stroke-width="2"/>',
         f'<text x="{x+w/2}" y="{y+HEAD_H/2+9}" text-anchor="middle" font-size="25" font-weight="700">{escape(s.label)}</text>',
         f'<line x1="{x+66}" y1="{y+HEAD_H}" x2="{x+66}" y2="{y+h}" stroke="#000" stroke-width="1.5"/>']
    last_key = None
    for i, (k, col, typ) in enumerate(s.kw["rows"]):
        ry = y + HEAD_H + ROW_H * i
        if last_key in ("PK", "FK") and k == "" and i:
            o.append(f'<line x1="{x}" y1="{ry}" x2="{x+w}" y2="{ry}" stroke="#000" stroke-width="1.5"/>')
        last_key = k if k else ("" if last_key in ("PK", "FK") else last_key)
        ty = ry + ROW_H / 2 + 8
        u = ' text-decoration="underline" font-weight="700"' if k == "PK" else ""
        o.append(f'<text x="{x+33}" y="{ty}" text-anchor="middle" font-size="{TFS-2}" font-weight="700">{k}</text>')
        o.append(f'<text x="{x+80}" y="{ty}" font-size="{TFS}"{u}>{escape(col)}</text>')
        o.append(f'<text x="{x+w-14}" y="{ty}" text-anchor="end" font-size="{TFS-2}">{escape(typ)}</text>')
    return "".join(o)


# ---------------------------------------------------------------------------
# UML classes
CL_FS, CL_LH, CL_HEAD = 22, 33, 52


def uml_class(d, id, x, y, name, attrs, methods, w=None):
    """x, y = top-left."""
    w = w or max([text_w(name, 25, True)] + [text_w(t, CL_FS) for t in attrs + methods]) + 44
    h = CL_HEAD + CL_LH * len(attrs) + 14 + CL_LH * len(methods) + 14
    d.shapes[id] = Shape(id, "class", x + w / 2, y + h / 2, w, h, name, attrs=attrs, methods=methods, x0=x, y0=y)
    return d.shapes[id]


def svg_class(s):
    x, y, w, h = s.kw["x0"], s.kw["y0"], s.w, s.h
    a, m = s.kw["attrs"], s.kw["methods"]
    ya = y + CL_HEAD
    ym = ya + CL_LH * len(a) + 14
    o = [f'<rect x="{x}" y="{y}" width="{w:.1f}" height="{h}" fill="#fff" stroke="#000" stroke-width="2"/>',
         f'<line x1="{x}" y1="{ya}" x2="{x+w:.1f}" y2="{ya}" stroke="#000" stroke-width="2"/>',
         f'<line x1="{x}" y1="{ym}" x2="{x+w:.1f}" y2="{ym}" stroke="#000" stroke-width="2"/>',
         f'<text x="{x+w/2:.1f}" y="{y+CL_HEAD/2+9}" text-anchor="middle" font-size="25" font-weight="700">{escape(s.label)}</text>']
    for i, t in enumerate(a):
        o.append(f'<text x="{x+16}" y="{ya+8+CL_LH*i+CL_LH/2+7:.1f}" font-size="{CL_FS}">{escape(t)}</text>')
    for i, t in enumerate(m):
        o.append(f'<text x="{x+16}" y="{ym+8+CL_LH*i+CL_LH/2+7:.1f}" font-size="{CL_FS}">{escape(t)}</text>')
    return "".join(o)


def drawio_class(s):
    x0, y0 = s.kw["x0"], s.kw["y0"]
    a, m = s.kw["attrs"], s.kw["methods"]
    ha = CL_LH * len(a) + 14
    hm = CL_LH * len(m) + 14
    base = f"text;html=1;fontSize={CL_FS};fontFamily=Helvetica;align=left;verticalAlign=top;spacingLeft=10;spacingTop=4;whiteSpace=wrap;"
    return [f'<mxCell id="{s.id}" value="{escape(s.label)}" style="swimlane;fontStyle=1;startSize={CL_HEAD};html=1;fontSize=25;fontFamily=Helvetica;fillColor=#FFFFFF;swimlaneFillColor=#FFFFFF;" vertex="1" parent="1">'
            f'<mxGeometry x="{x0}" y="{y0}" width="{s.w:.0f}" height="{s.h:.0f}" as="geometry"/></mxCell>',
            f'<mxCell id="{s.id}_a" value="{escape("<br>".join(escape(t) for t in a))}" style="{base}" vertex="1" parent="{s.id}">'
            f'<mxGeometry y="{CL_HEAD}" width="{s.w:.0f}" height="{ha}" as="geometry"/></mxCell>',
            f'<mxCell id="{s.id}_l" value="" style="line;strokeWidth=2;html=1;" vertex="1" parent="{s.id}">'
            f'<mxGeometry y="{CL_HEAD + ha - 4}" width="{s.w:.0f}" height="8" as="geometry"/></mxCell>',
            f'<mxCell id="{s.id}_m" value="{escape("<br>".join(escape(t) for t in m))}" style="{base}" vertex="1" parent="{s.id}">'
            f'<mxGeometry y="{CL_HEAD + ha}" width="{s.w:.0f}" height="{hm}" as="geometry"/></mxCell>']


# ---------------------------------------------------------------------------
# Use case diagrams
def actor(d, id, x, y, label, size=24):
    """x, y = centre of the stick figure (label drawn underneath)."""
    d.shapes[id] = Shape(id, "actor", x, y, 64, 130, label, size=size)


def usecase(d, id, x, y, label, size=23, w=340, h=104):
    d.shapes[id] = Shape(id, "ellipse", x, y, w, h, label, size=size)


def _wrap(label, size, maxw):
    words, lines, cur = label.split(), [], ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if text_w(t, size) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = wd
    lines.append(cur)
    return lines


def svg_actor(s):
    x, y, size = s.x, s.y, s.kw["size"]
    top = y - 65
    return (f'<circle cx="{x}" cy="{top+16}" r="16" fill="#fff" stroke="#000" stroke-width="2.4"/>'
            f'<line x1="{x}" y1="{top+32}" x2="{x}" y2="{top+82}" stroke="#000" stroke-width="2.4"/>'
            f'<line x1="{x-30}" y1="{top+50}" x2="{x+30}" y2="{top+50}" stroke="#000" stroke-width="2.4"/>'
            f'<line x1="{x}" y1="{top+82}" x2="{x-26}" y2="{top+124}" stroke="#000" stroke-width="2.4"/>'
            f'<line x1="{x}" y1="{top+82}" x2="{x+26}" y2="{top+124}" stroke="#000" stroke-width="2.4"/>'
            + "".join(f'<text x="{x}" y="{top+156+i*(size+4)}" text-anchor="middle" font-size="{size}" font-weight="700">{escape(t)}</text>'
                      for i, t in enumerate(s.label.split("\n"))))


def svg_usecase(s):
    size = s.kw["size"]
    lines = _wrap(s.label, size, s.w - 60)
    lh = size + 5
    y0 = s.y - (len(lines) - 1) * lh / 2 + size * 0.36
    return (f'<ellipse cx="{s.x}" cy="{s.y}" rx="{s.w/2}" ry="{s.h/2}" fill="#fff" stroke="#000" stroke-width="2.2"/>'
            + "".join(f'<text x="{s.x}" y="{y0+i*lh:.1f}" text-anchor="middle" font-size="{size}">{escape(t)}</text>'
                      for i, t in enumerate(lines)))
