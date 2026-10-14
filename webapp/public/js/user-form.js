// The "create a user" form, shared by Register and the admin "Add user" tab.
// Shows the extra fields that belong to the chosen role.

function userFormHtml({ includeAdmin = false } = {}) {
  return `
    <div class="form-grid">
      <label>I am registering as
        <select name="role_name" id="role_name" required>
          <option value="">Choose a role…</option>
          <option>Caregiver</option>
          <option>Elderly Person</option>
          <option>Healthcare Provider</option>
          ${includeAdmin ? '<option>Administrator</option>' : ''}
        </select>
      </label>
      <label>Full name <input name="full_name" id="full_name" required /></label>
      <label>Email address <input type="email" name="email" id="reg_email" required /></label>
      <label>Phone number <input name="phone_number" id="phone_number" placeholder="+2547…" /></label>
      <label>Password <input type="password" name="password" id="reg_password" minlength="8" required autocomplete="new-password" /></label>
    </div>

    <fieldset data-role="Elderly Person" hidden>
      <legend>Elderly person's details</legend>
      <div class="form-grid">
        <label>Date of birth <input type="date" name="date_of_birth" id="date_of_birth" /></label>
        <label>Gender
          <select name="gender" id="gender"><option value="">–</option><option>Female</option><option>Male</option><option>Other</option></select>
        </label>
        <label>Address <input name="address" id="address" /></label>
        <label>Emergency contact name <input name="emergency_contact_name" id="emergency_contact_name" /></label>
        <label>Emergency contact phone <input name="emergency_contact_phone" id="emergency_contact_phone" /></label>
      </div>
      <label>Medical history <textarea name="medical_history" id="medical_history" placeholder="e.g. Hypertension, medication"></textarea></label>
    </fieldset>

    <fieldset data-role="Caregiver" hidden>
      <legend>Caregiver details</legend>
      <label>Relationship to the elderly person <input name="relationship" id="relationship" placeholder="e.g. Daughter, Son, Nurse" /></label>
    </fieldset>

    <fieldset data-role="Healthcare Provider" hidden>
      <legend>Healthcare provider details</legend>
      <div class="form-grid">
        <label>Specialization <input name="specialization" id="specialization" placeholder="e.g. Cardiology" /></label>
        <label>Medical license number <input name="license_number" id="license_number" /></label>
      </div>
    </fieldset>`;
}

function wireUserForm(form) {
  const select = $('#role_name', form);
  const update = () => {
    for (const fs of $$('fieldset[data-role]', form)) {
      const on = fs.dataset.role === select.value;
      fs.hidden = !on;
      // Required fields only apply to the visible role section
      for (const input of $$('input', fs)) {
        if (['date_of_birth', 'emergency_contact_name', 'emergency_contact_phone', 'license_number'].includes(input.name)) {
          input.required = on;
        }
      }
    }
  };
  select.addEventListener('change', update);
  update();
}
