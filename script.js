// --------- UI population (kept from original) ----------
function collectSpecialties() {
  const set = new Set();
  document.querySelectorAll('.card-doctor[data-specialty]').forEach(card => {
    const s = (card.getAttribute('data-specialty') || '').trim();
    if (s) set.add(s);
  });
  return Array.from(set).sort((a,b) => a.localeCompare(b));
}

function populateSpecialtySelect() {
  const select = document.getElementById('specialty');
  if (!select) return;
  const specialties = collectSpecialties();
  select.innerHTML = '';
  if (specialties.length === 0) {
    const fallback = ['General Physician','Pediatrician','Dermatologist'];
    fallback.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
    return;
  }
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Select a specialty —';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);
  specialties.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

function setupHealthConditionLogic() {
  const noneCheckbox = document.getElementById('condNone');
  const conditionCheckboxes = Array.from(document.querySelectorAll('.health-condition'));
  if (!noneCheckbox) return;

  function onNoneChange() {
    if (noneCheckbox.checked) {
      conditionCheckboxes.forEach(cb => {
        if (cb !== noneCheckbox) {
          cb.checked = false;
          cb.disabled = true;
        }
      });
    } else {
      conditionCheckboxes.forEach(cb => {
        if (cb !== noneCheckbox) cb.disabled = false;
      });
    }
  }

  function onOtherChange(e) {
    if (e.target.checked) {
      noneCheckbox.checked = false;
      noneCheckbox.disabled = true;
    } else {
      const anyChecked = conditionCheckboxes.some(cb => cb !== noneCheckbox && cb.checked);
      if (!anyChecked) noneCheckbox.disabled = false;
    }
  }

  noneCheckbox.addEventListener('change', onNoneChange);
  conditionCheckboxes.forEach(cb => {
    if (cb !== noneCheckbox) cb.addEventListener('change', onOtherChange);
  });
}

// ---------- Backend API integration ----------

// POST booking to backend
async function postBooking(payload) {
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Server error');
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
}

// GET appointments for next 3 days
async function fetchNext3DaysAppointments() {
  const res = await fetch('/api/appointments');
  if (!res.ok) throw new Error('Failed to load appointments');
  return await res.json(); // server returns filtered list (next 3 days)
}

// ---------- DOM handlers ----------
document.addEventListener('DOMContentLoaded', () => {
  populateSpecialtySelect();
  setupHealthConditionLogic();

  const bookModalEl = document.getElementById('bookModal');
  if (bookModalEl) {
    bookModalEl.addEventListener('show.bs.modal', () => {
      populateSpecialtySelect();
      const sel = document.getElementById('specialty');
      if (sel && sel.options.length > 0) sel.selectedIndex = 0;
    });
  }

  const bookingForm = document.getElementById('bookingForm');
  bookingForm && bookingForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const ageVal = document.getElementById('age').value;
    const age = ageVal ? parseInt(ageVal, 10) : null;
    const gender = (document.querySelector('input[name="gender"]:checked') || {}).value;
    const bloodGroup = (document.getElementById('bloodGroup') || {}).value;
    const email = document.getElementById('email').value.trim();
    const patientGroup = document.getElementById('patientGroup').value;
    const specialty = document.getElementById('specialty').value;
    const dt = document.getElementById('dt').value;

    const healthCheckboxes = Array.from(document.querySelectorAll('.health-condition'));
    const selectedConditions = healthCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
    const conditions = selectedConditions.length ? selectedConditions : ['None'];

    const errors = [];
    if (!name) errors.push('Full name is required.');
    if (!age || Number.isNaN(age) || age < 0) errors.push('Valid age is required.');
    if (!gender) errors.push('Please select gender.');
    if (!bloodGroup) errors.push('Please select blood group.');
    if (!email) errors.push('Email is required.');
    if (!patientGroup) errors.push('Please select patient group.');
    if (!specialty) errors.push('Please select a specialty.');
    if (!dt) errors.push('Please select preferred date & time.');

    if (errors.length) {
      alert('Please fix the following:\n\n' + errors.join('\n'));
      return;
    }

    const payload = {
      patientName: name,
      age,
      gender,
      bloodGroup,
      patientGroup,
      email,
      specialty,
      conditions,
      time: dt, // ISO-like from datetime-local
      createdAt: new Date().toISOString()
    };

    try {
      const result = await postBooking(payload);
      const modal = bootstrap.Modal.getOrCreateInstance(bookModalEl);
      modal.hide();
      alert('Appointment booked!\n\n' + `Doctor (assigned): ${result.doctorName || 'TBD'}\nTime: ${new Date(result.time).toLocaleString()}`);
      this.reset();
    } catch (err) {
      alert('Failed to book appointment: ' + (err.message || err));
    }
  });

  // ------------- Next 3 days button logic ----------
  const showNext3Btn = document.getElementById('showNext3Btn');
  const appointmentsPanel = document.getElementById('appointmentsPanel');

  showNext3Btn.addEventListener('click', async () => {
    // toggle panel open/close
    const isOpen = appointmentsPanel.style.display === 'block';
    if (isOpen) {
      appointmentsPanel.style.display = 'none';
      appointmentsPanel.setAttribute('aria-hidden', 'true');
      return;
    }

    // fetch appointments from backend
    appointmentsPanel.innerHTML = '<div class="p-3 small text-muted">Loading…</div>';
    appointmentsPanel.style.display = 'block';
    appointmentsPanel.setAttribute('aria-hidden', 'false');

    try {
      const data = await fetchNext3DaysAppointments(); // server returns doctorName, patientName, time
      if (!data.length) {
        appointmentsPanel.innerHTML = '<div class="p-3 small text-muted">No appointments scheduled in the next 3 days.</div>';
        return;
      }
      // build list
      appointmentsPanel.innerHTML = '';
      data.forEach(a => {
        const div = document.createElement('div');
        div.className = 'appointment-item';
        div.innerHTML = `<div class="appointment-title">${escapeHtml(a.doctorName || '—')}</div>
                         <div class="appointment-time">${escapeHtml(a.patientName || '—')} • ${new Date(a.time).toLocaleString()}</div>`;
        appointmentsPanel.appendChild(div);
      });
    } catch (err) {
      appointmentsPanel.innerHTML = `<div class="p-3 small text-danger">Error loading appointments.</div>`;
      console.error(err);
    }
  });
});

// small escape helper
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
}
