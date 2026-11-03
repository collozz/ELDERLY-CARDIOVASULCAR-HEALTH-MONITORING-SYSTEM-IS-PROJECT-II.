// Dashboard page

let people = [];

function vitalsText(r) {
  if (!r) return '<span class="muted">No readings yet</span>';
  return `HR <strong>${r.heart_rate_bpm}</strong> bpm · Temp ${r.temperature_c ?? '–'}°C · SpO₂ ${r.spo2_percent ?? '–'}%`;
}

function renderPeople() {
  const box = $('#people');
  if (!people.length) {
    box.innerHTML = '<p class="muted card">No elderly people are assigned to you yet. An administrator can assign them.</p>';
    return;
  }
  box.innerHTML = people
    .map((p) => {
      const sev = p.check ? p.check.severity : null;
      return `
      <a class="person" href="patient.html?id=${p.elderly_id}" id="person-${p.elderly_id}">
        <span class="avatar">${esc(initials(p.full_name))}</span>
        <span class="who">
          <span class="name">${esc(p.full_name)}</span> <span class="muted small">· ${p.age} yrs</span><br />
          <span class="vitals">${vitalsText(p.latest)}</span>
          ${p.latest ? `<span class="muted small"> · ${timeAgo(p.latest.recorded_at)}</span>` : ''}
        </span>
        ${p.open_alerts ? `<span class="pill Open">${p.open_alerts} open alert${p.open_alerts > 1 ? 's' : ''}</span>` : ''}
        ${p.latest ? `<span class="pill ${sevClass(sev)}">${sevText(sev)}</span>
        <span class="dot big ${sevClass(sev)}" aria-hidden="true"></span>` : '<span class="pill">No data</span>'}
      </a>`;
    })
    .join('');
}

async function renderBanner() {
  const { alerts } = await api('/api/alerts?status=Open');
  const el = $('#banner');
  if (!alerts.length) {
    el.innerHTML = '<div class="banner normal">✓ No open alerts. Everyone is within their normal range.</div>';
    return;
  }
  const a = alerts[0];
  const cls = a.severity === 'Critical' ? 'critical' : 'warning';
  el.innerHTML = `<div class="banner ${cls}">
    <strong>⚠ ${a.alert_type === 'Panic' ? 'PANIC' : 'Alert'}: ${esc(a.full_name)}</strong>
    <span>${esc(a.message)} · ${timeAgo(a.triggered_at)}</span>
    <a href="alerts.html">${alerts.length > 1 ? `View all ${alerts.length} open alerts` : 'View alert'} →</a>
  </div>`;
}

async function renderTrend() {
  const { rows } = await api('/api/patients/weekly-trend');
  const byPerson = {};
  for (const r of rows) {
    (byPerson[r.full_name] = byPerson[r.full_name] || []).push({ x: parseDate(`${r.day} 12:00:00`), y: r.avg_hr });
  }
  const series = Object.entries(byPerson).map(([name, points]) => ({ name, points }));
  $('#trend-legend').innerHTML = legendHtml(series);
  const today = new Date(); today.setHours(23, 0, 0, 0);
  const from = new Date(today - 6 * 86400000); from.setHours(1, 0, 0, 0);
  lineChart($('#trend'), { series, band: { lo: 50, hi: 100 }, xFormat: 'day', xRange: { from, to: today } });
}

async function renderOverview() {
  const { counts } = await api('/api/admin/overview');
  const tiles = [
    ['Users', counts.users],
    ['Elderly people', counts.elderly],
    ['Active devices', counts.active_devices],
    ['Open alerts', counts.open_alerts],
    ['Readings today', counts.readings_today],
  ];
  $('#overview').innerHTML = tiles
    .map(([label, value]) => `<div class="card stat-tile"><div class="section-label">${label}</div><div class="value">${value}</div></div>`)
    .join('');
  $('#overview').hidden = false;
}

(async () => {
  const user = await startPage('dashboard.html', [ROLE.ADMIN, ROLE.CAREGIVER, ROLE.PROVIDER]);
  if (!user) return;
  $('#greeting').textContent = `Welcome, ${user.full_name}`;
  $('#today').textContent = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (user.role_name === ROLE.ADMIN) {
    $('#people-label').textContent = 'All elderly · live status';
    $('#episode-btn').hidden = false;
    $('#episode-btn').addEventListener('click', async () => {
      await api('/api/simulate-episode', { method: 'POST' });
      toast('The simulator will send abnormal readings for about 24 seconds.');
    });
    renderOverview();
  }

  // Ask to turn on phone notifications
  if (user.role_name !== ROLE.ADMIN && pushSupported() && Notification.permission === 'default') {
    $('#push-tip').hidden = false;
    $('#push-tip-btn').addEventListener('click', async () => {
      try { await enablePush(); toast('Alert notifications are on for this device.'); } catch (err) { toast(err.message); }
      $('#push-tip').hidden = true;
    });
  }

  people = (await api('/api/patients')).people;
  renderPeople();
  renderBanner();
  renderTrend();

  connectLive({
    reading(r) {
      const p = people.find((x) => x.elderly_id === r.elderly_id);
      if (!p) return;
      p.latest = r;
      p.check = { severity: r.severity, problems: r.problems };
      renderPeople();
    },
    alert() {
      renderBanner();
      api('/api/patients').then((d) => { people = d.people; renderPeople(); });
    },
  });
  // Refresh
  setInterval(renderPeople, 30000);
  setInterval(renderTrend, 5 * 60000);
  window.addEventListener('resize', renderTrend);
})();
