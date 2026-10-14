// Small line-chart helper drawn on <canvas> (no internet or library needed).
//
// lineChart(canvas, {
//   series: [{ name, color, points: [{ x: Date, y: Number }] }],
//   band: { lo, hi },      // optional shaded "normal range"
//   unit: 'BPM',
//   xFormat: 'time' | 'day',
//   xRange: { from: Date, to: Date },  // optional fixed x range; with 'day' gives one tick per day
// })

const CHART_COLORS = ['#b91c1c', '#1d4ed8', '#047857', '#7c3aed', '#c2410c', '#0f766e'];

function lineChart(canvas, opts) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  ctx.font = '12px system-ui, sans-serif';

  const pad = { l: 44, r: 24, t: 12, b: 28 };
  const all = opts.series.flatMap((s) => s.points);
  if (all.length < 1) {
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText('No readings in this period yet', W / 2, H / 2);
    return;
  }

  let yMin = Math.min(...all.map((p) => p.y));
  let yMax = Math.max(...all.map((p) => p.y));
  if (opts.band) {
    yMin = Math.min(yMin, opts.band.lo);
    yMax = Math.max(yMax, opts.band.hi);
  }
  const span = yMax - yMin || 1;
  yMin -= span * 0.1;
  yMax += span * 0.1;
  let xMin = opts.xRange ? +opts.xRange.from : Math.min(...all.map((p) => +p.x));
  let xMax = opts.xRange ? +opts.xRange.to : Math.max(...all.map((p) => +p.x));
  if (xMin === xMax) { xMin -= 60000; xMax += 60000; }

  const x = (v) => pad.l + ((+v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

  // Normal range band
  if (opts.band) {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.10)';
    ctx.fillRect(pad.l, y(opts.band.hi), W - pad.l - pad.r, y(opts.band.lo) - y(opts.band.hi));
  }

  // Y grid and labels
  ctx.strokeStyle = '#e5e7eb';
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + ((yMax - yMin) * i) / ticks;
    const yy = y(v);
    ctx.beginPath();
    ctx.moveTo(pad.l, yy);
    ctx.lineTo(W - pad.r, yy);
    ctx.stroke();
    ctx.fillText(v.toFixed(span < 5 ? 1 : 0), pad.l - 6, yy);
  }

  // X labels: one per day for day charts, evenly spaced times otherwise
  ctx.textBaseline = 'top';
  let xs = [];
  if (opts.xFormat === 'day') {
    const d = new Date(xMin); d.setHours(12, 0, 0, 0);
    if (+d < xMin) d.setDate(d.getDate() + 1);
    for (; +d <= xMax; d.setDate(d.getDate() + 1)) xs.push(new Date(d));
    const step = Math.ceil(xs.length / Math.max(2, Math.floor((W - pad.l) / 70)));
    xs = xs.filter((_, i) => i % step === 0);
  } else {
    const xt = Math.max(2, Math.min(6, Math.floor((W - pad.l) / 90)));
    for (let i = 0; i <= xt; i++) xs.push(new Date(xMin + ((xMax - xMin) * i) / xt));
  }
  xs.forEach((t) => {
    const label = opts.xFormat === 'day'
      ? t.toLocaleDateString([], { weekday: 'short', day: 'numeric' })
      : t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const xx = x(t);
    const w = ctx.measureText(label).width;
    // keep labels inside the canvas
    ctx.textAlign = xx + w / 2 > W ? 'right' : xx - w / 2 < 0 ? 'left' : 'center';
    ctx.fillText(label, ctx.textAlign === 'right' ? W - 2 : ctx.textAlign === 'left' ? 2 : xx, H - pad.b + 8);
  });

  // Lines
  opts.series.forEach((s, i) => {
    const color = s.color || CHART_COLORS[i % CHART_COLORS.length];
    const pts = [...s.points].sort((a, b) => a.x - b.x);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, j) => (j ? ctx.lineTo(x(p.x), y(p.y)) : ctx.moveTo(x(p.x), y(p.y))));
    ctx.stroke();
    // Emphasise the latest point
    const last = pts[pts.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x(last.x), y(last.y), pts.length === 1 ? 4 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function legendHtml(series) {
  return series
    .map((s, i) => `<span style="--c:${s.color || CHART_COLORS[i % CHART_COLORS.length]}">${esc(s.name)}</span>`)
    .join('');
}
