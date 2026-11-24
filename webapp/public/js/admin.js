// Admin page

let me;
let options = { elderly: [], caregivers: [], providers: [] };

const optionList = (items) => items.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('');

async function loadOptions() {
  options = await api('/api/admin/options');
  $('#dev_elderly').innerHTML = optionList(options.elderly);
  $('#as_elderly').innerHTML = optionList(options.elderly);
  fillAssignPeople();
}

function fillAssignPeople() {
  $('#as_person').innerHTML = optionList($('#as_type').value === 'caregiver' ? options.caregivers : options.providers);
}

async function loadUsers() {
  const { users } = await api('/api/admin/users');
  $('#users').innerHTML = users
    .map((u) => `<tr>
      <td><strong>${esc(u.full_name)}</strong><br /><span class="muted small">${esc(u.phone_number || '')}</span></td>
      <td>${esc(u.role_name)}</td>
      <td>${esc(u.email)}</td>
      <td>${u.user_id === me.user_id ? '<span class="muted small">You</span>' : `<button class="btn light small" data-delete-user="${u.user_id}" data-name="${esc(u.full_name)}" type="button">Delete</button>`}</td>
    </tr>`)
    .join('');
}

async function loadDevices() {
  const { devices } = await api('/api/admin/devices');
  $('#devices').innerHTML = devices
    .map((d) => `<tr>
      <td><strong>${esc(d.serial_number)}</strong><br /><span class="muted small">${esc(d.device_type)}</span></td>
      <td>${esc(d.full_name)}</td>
      <td>
        <select data-device="${d.device_id}" data-elderly="${d.elderly_id}" aria-label="Status of ${esc(d.serial_number)}">
          ${['Active', 'Inactive', 'Faulty'].map((s) => `<option ${s === d.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>${d.last_synced_at ? timeAgo(d.last_synced_at) : 'Never'}</td>
      <td>${d.status === 'Active' ? '<span class="pill normal">Gets ESP32</span>' : ''}</td>
    </tr>`)
    .join('');
}

async function loadAssignments() {
  const { assignments } = await api('/api/admin/assignments');
  assignments.sort((a, b) => a.elderly.localeCompare(b.elderly));
  $('#assignments').innerHTML = assignments.length
    ? assignments.map((a) => `<tr>
        <td>${esc(a.elderly)}</td>
        <td>${esc(a.person)} <span class="muted small">${esc(a.detail || '')}</span></td>
        <td>${a.type === 'caregiver' ? 'Caregiver' : 'Healthcare provider'}</td>
        <td><button class="btn light small" data-unassign="${a.type}/${a.assignment_id}" type="button">Remove</button></td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="muted">No assignments yet.</td></tr>';
}

async function loadActivity() {
  const { rows } = await api('/api/admin/activity');
  $('#activity').innerHTML = rows
    .map((r) => `<tr><td class="num" style="text-align:left;white-space:nowrap">${fmtDateTime(r.logged_at)}</td><td>${esc(r.full_name)}</td><td>${esc(r.action)}</td><td class="muted">${esc(r.details || '')}</td></tr>`)
    .join('');
}

function showTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
  if (name === 'activity') loadActivity();
  history.replaceState(null, '', `#${name}`);
}

(async () => {
  me = await startPage('admin.html', [ROLE.ADMIN]);
  if (!me) return;

  const userForm = $('#user-form');
  userForm.innerHTML = userFormHtml({ includeAdmin: true }).replace('I am registering as', 'Role') + `
    <p class="msg" id="user-msg" hidden></p>
    <button class="btn primary" type="submit">Add user</button>`;
  wireUserForm(userForm);

  await Promise.all([loadOptions(), loadUsers(), loadDevices(), loadAssignments()]);
  showTab(['users', 'devices', 'assignments', 'activity'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'users');
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  connectLive();

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/users', { method: 'POST', body: formData(userForm) });
      showMsg($('#user-msg'), `${$('#full_name').value} was added.`, true);
      userForm.reset();
      wireUserForm(userForm);
      await Promise.all([loadUsers(), loadOptions()]);
    } catch (err) {
      showMsg($('#user-msg'), err.message);
    }
  });

  // Delete user
  $('#users').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-delete-user]');
    if (!b) return;
    if (b.dataset.confirm !== 'yes') {
      b.dataset.confirm = 'yes';
      b.textContent = 'Click again to delete';
      b.classList.remove('light');
      b.classList.add('primary');
      return;
    }
    try {
      await api(`/api/admin/users/${b.dataset.deleteUser}`, { method: 'DELETE' });
      toast(`${b.dataset.name} was deleted.`);
      await Promise.all([loadUsers(), loadOptions(), loadAssignments(), loadDevices()]);
    } catch (err) {
      toast(err.message);
    }
  });

  $('#device-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/devices', { method: 'POST', body: formData(e.target) });
      showMsg($('#device-msg'), 'Device registered.', true);
      $('#dev_serial').value = '';
      loadDevices();
    } catch (err) {
      showMsg($('#device-msg'), err.message);
    }
  });

  $('#devices').addEventListener('change', async (e) => {
    const s = e.target.closest('select[data-device]');
    if (!s) return;
    try {
      await api(`/api/admin/devices/${s.dataset.device}`, { method: 'PUT', body: { status: s.value, elderly_id: s.dataset.elderly } });
      toast(s.value === 'Active' ? 'The ESP32 now sends readings to this person.' : `Device set to ${s.value}.`);
      loadDevices();
    } catch (err) {
      toast(err.message);
    }
  });

  $('#as_type').addEventListener('change', fillAssignPeople);
  $('#assign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/assignments', { method: 'POST', body: formData(e.target) });
      showMsg($('#assign-msg'), 'Assigned.', true);
      loadAssignments();
    } catch (err) {
      showMsg($('#assign-msg'), err.message);
    }
  });

  $('#assignments').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-unassign]');
    if (!b) return;
    await api(`/api/admin/assignments/${b.dataset.unassign}`, { method: 'DELETE' });
    loadAssignments();
  });
})();
