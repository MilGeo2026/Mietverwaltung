// ══════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════
let properties = [];
let units = [];
let tenants = [];
let payments = [];
let currentPage = 'dashboard';
let editingImmobilieId = null;
let currentWohnungenPropertyId = null;
let editingWohnungId = null;
let currentMieterUnitId = null;
let editingMieterId = null;
let currentZahlungenTenantId = null;
let editingZahlungId = null;

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// ══════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════
function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-root').style.display = '';
}
function showAuthScreen() {
  document.getElementById('app-root').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}
function authMessage(msg, isError = true) {
  const errEl = document.getElementById('auth-error');
  const infoEl = document.getElementById('auth-info');
  errEl.style.display = 'none'; infoEl.style.display = 'none';
  const el = isError ? errEl : infoEl;
  el.textContent = msg; el.style.display = 'block';
}

async function handleSignUp() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || password.length < 6) { authMessage('Bitte E-Mail und ein Passwort mit min. 6 Zeichen angeben.'); return; }
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) { authMessage(error.message); return; }
  authMessage('Registrierung erfolgreich! Falls E-Mail-Bestätigung aktiv ist, bitte Posteingang prüfen und danach anmelden.', false);
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { authMessage('Bitte E-Mail und Passwort angeben.'); return; }
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { authMessage(error.message); return; }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    document.getElementById('user-email').textContent = session.user.email;
    showApp();
    loadData();
  } else {
    showAuthScreen();
  }
});

// ══════════════════════════════════════════════════
//  DATEN LADEN
// ══════════════════════════════════════════════════
async function loadData() {
  const [
    { data: pRows, error: pErr },
    { data: uRows, error: uErr },
    { data: tRows, error: tErr },
    { data: zRows, error: zErr },
  ] = await Promise.all([
    supabaseClient.from('properties').select('*').order('created_at'),
    supabaseClient.from('units').select('*').order('created_at'),
    supabaseClient.from('tenants').select('*').order('created_at'),
    supabaseClient.from('payments').select('*').order('due_date'),
  ]);
  const err = pErr || uErr || tErr || zErr;
  if (err) { alert('Fehler beim Laden der Daten: ' + err.message); return; }
  properties = pRows || [];
  units = uRows || [];
  tenants = tRows || [];
  payments = zRows || [];
  refreshAll();
}

function refreshAll() {
  renderDashboard();
  renderImmobilien();
}

// ══════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════
const pageConfig = {
  dashboard:  { title: 'Dashboard',  badge: 'Übersicht',      btn: null },
  immobilien: { title: 'Immobilien', badge: 'Immobilienliste', btn: 'Neue Immobilie' },
};

function showPage(id) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach((n) => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-page="${id}"]`);
  if (navEl) navEl.classList.add('active');
  const cfg = pageConfig[id];
  document.getElementById('topbarTitle').textContent = cfg.title;
  document.getElementById('topbarBadge').textContent = cfg.badge;
  const btnEl = document.getElementById('topbarBtn');
  btnEl.style.display = cfg.btn ? '' : 'none';
  if (cfg.btn) document.getElementById('topbarBtnLabel').textContent = cfg.btn;
  currentPage = id;
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function openTopbarAction() {
  if (currentPage === 'immobilien') openImmobilieModal();
}

// ══════════════════════════════════════════════════
//  MODAL HELPERS
// ══════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.overlay').forEach((o) =>
  o.addEventListener('click', (e) => { if (e.target === o) o.classList.remove('open'); }));

// ══════════════════════════════════════════════════
//  IMMOBILIEN
// ══════════════════════════════════════════════════
function openImmobilieModal(id = null) {
  editingImmobilieId = id;
  document.getElementById('i-name').value = '';
  document.getElementById('i-address').value = '';
  if (id) {
    const p = properties.find((x) => x.id === id);
    if (p) {
      document.getElementById('i-name').value = p.name || '';
      document.getElementById('i-address').value = p.address || '';
    }
    document.getElementById('modal-immobilie-title').textContent = 'Immobilie bearbeiten';
  } else {
    document.getElementById('modal-immobilie-title').textContent = 'Neue Immobilie';
  }
  openModal('modal-immobilie');
}

async function saveImmobilie() {
  const name = document.getElementById('i-name').value.trim();
  const address = document.getElementById('i-address').value.trim();
  if (!name) { alert('Bitte einen Namen angeben.'); return; }

  if (editingImmobilieId) {
    const { error } = await supabaseClient.from('properties')
      .update({ name, address })
      .eq('id', editingImmobilieId);
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  } else {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { error } = await supabaseClient.from('properties')
      .insert({ name, address, user_id: user.id });
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  }
  closeModal('modal-immobilie');
  await loadData();
}

async function deleteImmobilie(id) {
  if (!confirm('Immobilie wirklich löschen? Alle zugehörigen Wohnungen werden mitgelöscht.')) return;
  const { error } = await supabaseClient.from('properties').delete().eq('id', id);
  if (error) { alert('Fehler beim Löschen: ' + error.message); return; }
  await loadData();
}

function unitsForProperty(propertyId) {
  return units.filter((u) => u.property_id === propertyId);
}

function renderImmobilien(filter = '') {
  const tbody = document.getElementById('immobilien-tbody');
  let list = properties;
  if (filter) {
    const f = filter.toLowerCase();
    list = list.filter((p) => (p.name + (p.address || '')).toLowerCase().includes(f));
  }
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty"><p>Keine Immobilien gefunden. Lege deine erste Immobilie an.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((p) => {
    const count = unitsForProperty(p.id).length;
    return `
      <tr>
        <td data-label="Name">${esc(p.name)}</td>
        <td data-label="Adresse">${esc(p.address || '–')}</td>
        <td data-label="Wohnungen">${count}</td>
        <td data-label="Aktionen">
          <div class="td-actions">
            <button class="btn btn-secondary btn-sm" onclick="openWohnungenModal('${p.id}')">Wohnungen (${count})</button>
            <button class="btn btn-secondary btn-sm" onclick="openImmobilieModal('${p.id}')">Bearbeiten</button>
            <button class="btn btn-danger btn-sm" onclick="deleteImmobilie('${p.id}')">Löschen</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════
//  WOHNUNGEN (je Immobilie)
// ══════════════════════════════════════════════════
function openWohnungenModal(propertyId) {
  currentWohnungenPropertyId = propertyId;
  const property = properties.find((p) => p.id === propertyId);
  document.getElementById('modal-wohnungen-immobilie-name').textContent = property ? property.name : '';
  resetWohnungForm();
  renderWohnungen();
  openModal('modal-wohnungen');
}

function resetWohnungForm() {
  editingWohnungId = null;
  document.getElementById('w-name').value = '';
  document.getElementById('w-size').value = '';
  document.getElementById('w-rooms').value = '';
  document.getElementById('wohnung-form-label').textContent = 'Wohnung hinzufügen';
  document.getElementById('wohnung-cancel-edit-btn').style.display = 'none';
}

function editWohnung(id) {
  const unit = units.find((u) => u.id === id);
  if (!unit) return;
  editingWohnungId = id;
  document.getElementById('w-name').value = unit.name || '';
  document.getElementById('w-size').value = unit.size_qm ?? '';
  document.getElementById('w-rooms').value = unit.rooms ?? '';
  document.getElementById('wohnung-form-label').textContent = 'Wohnung bearbeiten';
  document.getElementById('wohnung-cancel-edit-btn').style.display = '';
}

async function saveWohnung() {
  const name = document.getElementById('w-name').value.trim();
  const sizeRaw = document.getElementById('w-size').value;
  const roomsRaw = document.getElementById('w-rooms').value;
  if (!name) { alert('Bitte einen Namen für die Wohnung angeben.'); return; }

  const payload = {
    name,
    size_qm: sizeRaw === '' ? null : Number(sizeRaw),
    rooms: roomsRaw === '' ? null : Number(roomsRaw),
  };

  if (editingWohnungId) {
    const { error } = await supabaseClient.from('units').update(payload).eq('id', editingWohnungId);
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  } else {
    const { error } = await supabaseClient.from('units')
      .insert({ ...payload, property_id: currentWohnungenPropertyId });
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  }

  await loadData();
  resetWohnungForm();
  renderWohnungen();
}

async function deleteWohnung(id) {
  if (!confirm('Wohnung wirklich löschen?')) return;
  const { error } = await supabaseClient.from('units').delete().eq('id', id);
  if (error) { alert('Fehler beim Löschen: ' + error.message); return; }
  await loadData();
  renderWohnungen();
}

function renderWohnungen() {
  const tbody = document.getElementById('wohnungen-tbody');
  const list = unitsForProperty(currentWohnungenPropertyId);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty"><p>Noch keine Wohnungen für diese Immobilie.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((u) => {
    const count = tenantsForUnit(u.id).length;
    return `
    <tr>
      <td data-label="Name">${esc(u.name)}</td>
      <td data-label="Größe (m²)">${u.size_qm ?? '–'}</td>
      <td data-label="Zimmer">${u.rooms ?? '–'}</td>
      <td data-label="Aktionen">
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="openMieterModal('${u.id}')">Mieter (${count})</button>
          <button class="btn btn-secondary btn-sm" onclick="editWohnung('${u.id}')">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" onclick="deleteWohnung('${u.id}')">Löschen</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════
//  MIETER (je Wohnung)
// ══════════════════════════════════════════════════
function tenantsForUnit(unitId) {
  return tenants.filter((t) => t.unit_id === unitId);
}

function openMieterModal(unitId) {
  currentMieterUnitId = unitId;
  const unit = units.find((u) => u.id === unitId);
  document.getElementById('modal-mieter-wohnung-name').textContent = unit ? unit.name : '';
  resetMieterForm();
  renderMieter();
  openModal('modal-mieter');
}

function resetMieterForm() {
  editingMieterId = null;
  document.getElementById('m-name').value = '';
  document.getElementById('m-email').value = '';
  document.getElementById('m-phone').value = '';
  document.getElementById('m-move-in').value = '';
  document.getElementById('m-move-out').value = '';
  document.getElementById('mieter-form-label').textContent = 'Mieter hinzufügen';
  document.getElementById('mieter-cancel-edit-btn').style.display = 'none';
}

function editMieter(id) {
  const tenant = tenants.find((t) => t.id === id);
  if (!tenant) return;
  editingMieterId = id;
  document.getElementById('m-name').value = tenant.name || '';
  document.getElementById('m-email').value = tenant.email || '';
  document.getElementById('m-phone').value = tenant.phone || '';
  document.getElementById('m-move-in').value = tenant.move_in_date || '';
  document.getElementById('m-move-out').value = tenant.move_out_date || '';
  document.getElementById('mieter-form-label').textContent = 'Mieter bearbeiten';
  document.getElementById('mieter-cancel-edit-btn').style.display = '';
}

async function saveMieter() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) { alert('Bitte einen Namen angeben.'); return; }

  const payload = {
    name,
    email: document.getElementById('m-email').value.trim() || null,
    phone: document.getElementById('m-phone').value.trim() || null,
    move_in_date: document.getElementById('m-move-in').value || null,
    move_out_date: document.getElementById('m-move-out').value || null,
  };

  if (editingMieterId) {
    const { error } = await supabaseClient.from('tenants').update(payload).eq('id', editingMieterId);
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  } else {
    const { error } = await supabaseClient.from('tenants')
      .insert({ ...payload, unit_id: currentMieterUnitId });
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  }

  await loadData();
  resetMieterForm();
  renderMieter();
}

async function deleteMieter(id) {
  if (!confirm('Mieter wirklich löschen? Zugehörige Zahlungen werden mitgelöscht.')) return;
  const { error } = await supabaseClient.from('tenants').delete().eq('id', id);
  if (error) { alert('Fehler beim Löschen: ' + error.message); return; }
  await loadData();
  renderMieter();
}

function renderMieter() {
  const tbody = document.getElementById('mieter-tbody');
  const list = tenantsForUnit(currentMieterUnitId);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><p>Noch keine Mieter für diese Wohnung.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((t) => {
    const count = paymentsForTenant(t.id).length;
    return `
    <tr>
      <td data-label="Name">${esc(t.name)}</td>
      <td data-label="E-Mail">${esc(t.email || '–')}</td>
      <td data-label="Telefon">${esc(t.phone || '–')}</td>
      <td data-label="Einzug">${esc(t.move_in_date || '–')}</td>
      <td data-label="Aktionen">
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="openZahlungenModal('${t.id}')">Zahlungen (${count})</button>
          <button class="btn btn-secondary btn-sm" onclick="editMieter('${t.id}')">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMieter('${t.id}')">Löschen</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════
//  ZAHLUNGEN (je Mieter)
// ══════════════════════════════════════════════════
function paymentsForTenant(tenantId) {
  return payments.filter((z) => z.tenant_id === tenantId);
}

function openZahlungenModal(tenantId) {
  currentZahlungenTenantId = tenantId;
  const tenant = tenants.find((t) => t.id === tenantId);
  document.getElementById('modal-zahlungen-mieter-name').textContent = tenant ? tenant.name : '';
  resetZahlungForm();
  renderZahlungen();
  openModal('modal-zahlungen');
}

function resetZahlungForm() {
  editingZahlungId = null;
  document.getElementById('z-amount').value = '';
  document.getElementById('z-due-date').value = '';
  document.getElementById('z-paid-date').value = '';
  document.getElementById('z-status').value = 'offen';
  document.getElementById('zahlung-form-label').textContent = 'Zahlung hinzufügen';
  document.getElementById('zahlung-cancel-edit-btn').style.display = 'none';
}

function editZahlung(id) {
  const payment = payments.find((z) => z.id === id);
  if (!payment) return;
  editingZahlungId = id;
  document.getElementById('z-amount').value = payment.amount ?? '';
  document.getElementById('z-due-date').value = payment.due_date || '';
  document.getElementById('z-paid-date').value = payment.paid_date || '';
  document.getElementById('z-status').value = payment.status || 'offen';
  document.getElementById('zahlung-form-label').textContent = 'Zahlung bearbeiten';
  document.getElementById('zahlung-cancel-edit-btn').style.display = '';
}

async function saveZahlung() {
  const amountRaw = document.getElementById('z-amount').value;
  const dueDate = document.getElementById('z-due-date').value;
  if (amountRaw === '' || !dueDate) { alert('Bitte Betrag und Fälligkeitsdatum angeben.'); return; }

  const payload = {
    amount: Number(amountRaw),
    due_date: dueDate,
    paid_date: document.getElementById('z-paid-date').value || null,
    status: document.getElementById('z-status').value,
  };

  if (editingZahlungId) {
    const { error } = await supabaseClient.from('payments').update(payload).eq('id', editingZahlungId);
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  } else {
    const { error } = await supabaseClient.from('payments')
      .insert({ ...payload, tenant_id: currentZahlungenTenantId });
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  }

  await loadData();
  resetZahlungForm();
  renderZahlungen();
}

async function deleteZahlung(id) {
  if (!confirm('Zahlung wirklich löschen?')) return;
  const { error } = await supabaseClient.from('payments').delete().eq('id', id);
  if (error) { alert('Fehler beim Löschen: ' + error.message); return; }
  await loadData();
  renderZahlungen();
}

function statusLabel(status) {
  return { offen: 'Offen', bezahlt: 'Bezahlt', ueberfaellig: 'Überfällig' }[status] || status;
}

function renderZahlungen() {
  const tbody = document.getElementById('zahlungen-tbody');
  const list = paymentsForTenant(currentZahlungenTenantId);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><p>Noch keine Zahlungen für diesen Mieter.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((z) => `
    <tr>
      <td data-label="Betrag">${Number(z.amount).toFixed(2)} €</td>
      <td data-label="Fällig">${esc(z.due_date)}</td>
      <td data-label="Bezahlt">${esc(z.paid_date || '–')}</td>
      <td data-label="Status">${esc(statusLabel(z.status))}</td>
      <td data-label="Aktionen">
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="editZahlung('${z.id}')">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" onclick="deleteZahlung('${z.id}')">Löschen</button>
        </div>
      </td>
    </tr>`).join('');
}

// ══════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════
function renderDashboard() {
  document.getElementById('stat-immobilien').textContent = properties.length;
  document.getElementById('stat-wohnungen').textContent = units.length;
  document.getElementById('stat-durchschnitt').textContent =
    properties.length ? (units.length / properties.length).toFixed(1) : '0';
  document.getElementById('stat-mieter').textContent = tenants.length;
  document.getElementById('stat-offene-zahlungen').textContent =
    payments.filter((z) => z.status !== 'bezahlt').length;

  const tbody = document.getElementById('dashboard-immobilien');
  if (!properties.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty"><p>Noch keine Immobilien angelegt.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = properties.slice(0, 5).map((p) => `
    <tr>
      <td>${esc(p.name)}</td>
      <td>${esc(p.address || '–')}</td>
      <td>${unitsForProperty(p.id).length}</td>
    </tr>`).join('');
}
