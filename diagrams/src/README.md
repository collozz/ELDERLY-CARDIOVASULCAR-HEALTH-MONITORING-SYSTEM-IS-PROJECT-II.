# Diagram sources

Each script draws one diagram and writes `<name>.svg` and `<name>.drawio`. `render.js` turns the SVG into a PNG.

    python3 erd.py out_erd && node render.js out_erd.svg out_erd.png

Scripts: erd.py (01), schema.py (02), classd.py (03), usecase.py (04), seq.py (05). Shared drawing code is in dia.py.
render.js needs Playwright (it loads `/opt/node-tools/node_modules/playwright`; change the path if yours differs).
