// Patient page

const id = Number(new URLSearchParams(location.search).get('id'));
let user;
let data;
let hours = 24;

function thresholdOf(vital) {
  return data.thresholds.find((t) => t.vital_type === vital);
}

function showReading(r, check) {
  if (!r) return;
  const statuses = (check && check.statuses) || {};
  for (const vital of Object.keys(VITALS)) {
    const card = $(`#v-${vital}`);
    const status = statuses[vital] || 'normal';
    card.className = `card vital ${status}`;
    $('.value', card).innerHTML = `${r[vital] ?? '–'} <span class="unit">${VITALS[vital].unit === 'BPM' ? 'bpm' : VITALS[vital].unit}</span>`;
    const pill = $('.pill', card);
    pill.className = `pill ${status}`;
    pill.textContent = status === 'alert' ? 'Alert' : 'Normal';
  }
  const sev = check ? check.severity : null;
  $('#overall').className = `pill ${sevClass(sev)}`;
  $('#overall').textContent = `Overall: ${sevText(sev)}`;
  $('#updated').textContent = fmtTime(r.recorded_at);
}

function showProfile() {
  const p = data.profile;
  $('#name').textContent = `${p.full_name} — Profile`;
  document.title = `${p.full_name} · Elderly Heart Monitor`;
  $('#sub').textContent = `${p.age} years · ${p.gender || 'Gender not set'} · ${p.address || 'No address'}`;
  const rows = [
    ['Date of birth', p.date_of_birth],
    ['Phone', p.phone_number || '–'],
    ['Email', p.email],
    ['Emergency contact', `${p.emergency_contact_name} (${p.emergency_contact_phone})`],
    ['Medical history', p.medical_history || '–'],
  ];
  $('#profile-view').innerHTML = rows.map(([k, v]) => `<dt class="muted">${k}</dt><dd style="margin:0">${esc(v)}</dd>`).join('');
  for (const key of ['full_name', 'phone_number', 'date_of_birth', 'gender', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'medical_history']) {
    $(`#pf_${key}`).value = p[key] || '';
  }

  const d = data.devices[0];
  $('#device-line').textContent = d ? `${d.device_type} · ${d.serial_number} · ${d.status}` : 'No device registered';
}

function showThresholds() {
  const canEdit = [ROLE.PROVIDER, ROLE.ADMIN].includes(user.role_name);
  $('#threshold-rows').innerHTML = Object.entries(VITALS)
    .map(([vital, v]) => {
      const t = thresholdOf(vital) || {};
      const step = vital === 'temperature_c' ? '0.1' : '1';
      const cell = (k) => canEdit
        ? `<input type="number" step="${step}" name="${vital}.${k}" id="${vital}_${k}" value="${t[k] ?? ''}" required aria-label="${v.label} ${k === 'min_value' ? 'minimum' : 'maximum'}" />`
        : `${t[k] ?? '–'}`;
      return `<tr><td>${v.label} <span class="muted small">(${v.unit})</span></td><td>${cell('min_value')}</td><td>${cell('max_value')}</td></tr>`;
    })
    .join('');
  const t = data.thresholds[0];
  $('#threshold-note').textContent = canEdit
    ? 'A reading outside these values raises an alert and notifies the care team.'
    : `Set by ${t && t.set_by ? t.set_by : 'the system defaults'}. Only a healthcare provider can change them.`;
  $('#threshold-actions').hidden = !canEdit;

  for (const vital of Object.keys(VITALS)) {
    const th = thresholdOf(vital);
    $(`#v-${vital} .range`).textContent = th ? `Normal range: ${th.min_value} – ${th.max_value}` : '';
  }
}

function showTeam() {
  const cg = data.caregivers.map((c) => `<li>${esc(c.full_name)} <span class="muted">· ${esc(c.relationship || 'Caregiver')} · ${esc(c.phone_number || 'no phone')}</span></li>`).join('');
  const pv = data.providers.map((p) => `<li>${esc(p.full_name)} <span class="muted">· ${esc(p.specialization || 'Healthcare provider')}</span></li>`).join('');
  $('#team').innerHTML = `
    <div class="section-label">Caregivers (receive SMS alerts)</div><ul style="margin-top:0">${cg || '<li class="muted">None assigned</li>'}</ul>
    <div class="section-label">Healthcare providers</div><ul style="margin:0">${pv || '<li class="muted">None assigned</li>'}</ul>`;
}

async function showAlerts() {
  const { alerts } = await api(`/api/alerts?elderly_id=${id}`);
  $('#recent-alerts').innerHTML = alerts.length
    ? alerts.slice(0, 5).map((a) => `
      <div class="alert-row" style="padding:10px 12px">
        <span class="pill ${a.alert_type}">${a.alert_type}</span>
        <span class="body">${esc(a.message)}<br /><span class="muted small">${fmtDateTime(a.triggered_at)}</span></span>
        <span class="pill ${a.status}">${a.status}</span>
      </div>`).join('')
    : '<p class="muted">No alerts.</p>';
}

async function drawChart() {
  const d = await api(`/api/patients/${id}/readings?hours=${hours}`);
  const useRecent = hours === 1 && d.recent.length;
  const points = useRecent
    ? d.recent.map((r) => ({ x: parseDate(r.recorded_at), y: r.heart_rate_bpm }))
    : d.perMinute.map((r) => ({ x: parseDate(r.t), y: r.heart_rate_bpm }));
  const th = thresholdOf('heart_rate_bpm');
  lineChart($('#hr-chart'), {
    series: [{ name: 'Heart rate', points }],
    band: th ? { lo: th.min_value, hi: th.max_value } : null,
    xFormat: hours > 24 ? 'day' : 'time',
    xRange: hours > 24 ? { from: new Date(Date.now() - hours * 3600000), to: new Date(new Date().setHours(23, 0, 0, 0)) } : null,
  });
  $('#chart-note').textContent = `${hours === 168 ? 'Last 7 days' : `Last ${hours} hour${hours > 1 ? 's' : ''}`}, ${useRecent ? 'every reading' : 'averaged per minute'}. The green band is the normal range.`;
  if (d.recent.length) showReading(d.recent[d.recent.length - 1], d.check);
}

async function load() {
  data = await api(`/api/patients/${id}`);
  showProfile();
  showThresholds();
  showTeam();
}

(async () => {
  user = await startPage('', []);
  if (!user) return;
  if (user.role_name === ROLE.ELDERLY) { location.href = 'my-health.html'; return; }
  try {
    await load();
  } catch (err) {
    $('#name').textContent = err.message;
    return;
  }
  drawChart();
  showAlerts();

  for (const b of $$('[data-hours]')) {
    b.addEventListener('click', () => {
      hours = Number(b.dataset.hours);
      $$('[data-hours]').forEach((x) => (x.className = `btn small ${x === b ? '' : 'light'}`));
      drawChart();
    });
  }

  $('#edit-btn').addEventListener('click', () => { $('#profile-form').hidden = false; $('#profile-view').hidden = true; });
  $('#cancel-btn').addEventListener('click', () => { $('#profile-form').hidden = true; $('#profile-view').hidden = false; });
  $('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/api/patients/${id}`, { method: 'PUT', body: formData(e.target) });
      await load();
      $('#profile-form').hidden = true;
      $('#profile-view').hidden = false;
      toast('Profile saved.');
    } catch (err) {
      showMsg($('#profile-msg'), err.message);
    }
  });

  $('#threshold-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const thresholds = {};
    for (const vital of Object.keys(VITALS)) {
      thresholds[vital] = { min_value: $(`#${vital}_min_value`).value, max_value: $(`#${vital}_max_value`).value };
    }
    try {
      await api(`/api/patients/${id}/thresholds`, { method: 'PUT', body: { thresholds } });
      await load();
      drawChart();
      showMsg($('#threshold-msg'), 'Thresholds saved. New readings are checked against them.', true);
    } catch (err) {
      showMsg($('#threshold-msg'), err.message);
    }
  });

  let lastChart = Date.now();
  connectLive({
    reading(r) {
      if (r.elderly_id !== id) return;
      showReading(r, r);
      // Refresh chart
      if (Date.now() - lastChart > 15000) { lastChart = Date.now(); drawChart(); }
    },
    alert(a) { if (a.elderly_id === id) showAlerts(); },
  });
  window.addEventListener('resize', drawChart);
})();
