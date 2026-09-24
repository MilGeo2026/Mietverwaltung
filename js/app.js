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
let editingMieterId = null;
let currentZahlungenTenantId = null;
let editingZahlungId = null;
let statements = [];
let costItems = [];
let currentErgebnisStatementId = null;
let editingStatementId = null;
let currentKostenpositionenStatementId = null;
let editingKostenpositionId = null;

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
    { data: sRows, error: sErr },
    { data: kRows, error: kErr },
  ] = await Promise.all([
    supabaseClient.from('properties').select('*').order('created_at'),
    supabaseClient.from('units').select('*').order('created_at'),
    supabaseClient.from('tenants').select('*').order('created_at'),
    supabaseClient.from('payments').select('*').order('due_date'),
    supabaseClient.from('cost_statements').select('*').order('created_at'),
    supabaseClient.from('cost_items').select('*').order('created_at'),
  ]);
  const err = pErr || uErr || tErr || zErr;
  if (err) { alert('Fehler beim Laden der Daten: ' + err.message); return; }
  properties = pRows || [];
  units = uRows || [];
  tenants = tRows || [];
  payments = zRows || [];
  if (sErr) {
    // Tabelle evtl. noch nicht angelegt (siehe supabase/nebenkosten.sql) - Seite bleibt dann leer.
    statements = [];
    console.warn('Abrechnungen konnten nicht geladen werden:', sErr.message);
  } else {
    statements = sRows || [];
  }
  if (kErr) {
    costItems = [];
    console.warn('Kostenpositionen konnten nicht geladen werden:', kErr.message);
  } else {
    costItems = kRows || [];
  }
  refreshAll();
}

function refreshAll() {
  renderDashboard();
  renderImmobilien();
  renderMieterPage();
  renderNebenkosten();
}

// ══════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════
const pageConfig = {
  dashboard:   { title: 'Dashboard',  badge: 'Übersicht',       btn: null },
  immobilien:  { title: 'Immobilien', badge: 'Immobilienliste', btn: 'Neue Immobilie' },
  mieter:      { title: 'Mieter',     badge: 'Mieterliste',     btn: 'Neuer Mieter' },
  nebenkosten: { title: 'Nebenkostenabrechnung', badge: 'Abrechnungen', btn: 'Neue Abrechnung' },
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
  else if (currentPage === 'mieter') openMieterModal();
  else if (currentPage === 'nebenkosten') openAbrechnungModal();
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
          <button class="btn btn-secondary btn-sm" onclick="goToMieterForWohnung('${u.id}')">Mieter (${count})</button>
          <button class="btn btn-secondary btn-sm" onclick="editWohnung('${u.id}')">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" onclick="deleteWohnung('${u.id}')">Löschen</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════
//  MIETER (Wohnung wird per Auswahl zugewiesen)
// ══════════════════════════════════════════════════
function tenantsForUnit(unitId) {
  return tenants.filter((t) => t.unit_id === unitId);
}

function unitLabel(unitId) {
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return '–';
  const property = properties.find((p) => p.id === unit.property_id);
  return (property ? property.name : '?') + ' – ' + unit.name;
}

function unitOptionsHtml(selectedUnitId) {
  if (!units.length) return '<option value="">Keine Wohnungen vorhanden</option>';
  return units.map((u) => {
    const selected = u.id === selectedUnitId ? 'selected' : '';
    return `<option value="${u.id}" ${selected}>${esc(unitLabel(u.id))}</option>`;
  }).join('');
}

function goToMieterForWohnung(unitId) {
  closeModal('modal-wohnungen');
  showPage('mieter');
  const unit = units.find((u) => u.id === unitId);
  const input = document.querySelector('#page-mieter .search-wrap input');
  const filterValue = unit ? unit.name : '';
  if (input) input.value = filterValue;
  renderMieterPage(filterValue);
}

function openMieterModal(id = null) {
  editingMieterId = id;
  const tenant = id ? tenants.find((t) => t.id === id) : null;
  document.getElementById('m-unit').innerHTML = unitOptionsHtml(tenant ? tenant.unit_id : null);
  document.getElementById('m-name').value = tenant?.name || '';
  document.getElementById('m-email').value = tenant?.email || '';
  document.getElementById('m-phone').value = tenant?.phone || '';
  document.getElementById('m-move-in').value = tenant?.move_in_date || '';
  document.getElementById('m-move-out').value = tenant?.move_out_date || '';
  document.getElementById('m-advance').value = tenant?.advance_payment_monthly ?? '';
  document.getElementById('modal-mieter-title').textContent = id ? 'Mieter bearbeiten' : 'Neuer Mieter';
  openModal('modal-mieter');
}

async function saveMieter() {
  const unitId = document.getElementById('m-unit').value;
  const name = document.getElementById('m-name').value.trim();
  const advanceRaw = document.getElementById('m-advance').value;
  if (!unitId) { alert('Bitte eine Wohnung auswählen.'); return; }
  if (!name) { alert('Bitte einen Namen angeben.'); return; }

  const payload = {
    unit_id: unitId,
    name,
    email: document.getElementById('m-email').value.trim() || null,
    phone: document.getElementById('m-phone').value.trim() || null,
    move_in_date: document.getElementById('m-move-in').value || null,
    move_out_date: document.getElementById('m-move-out').value || null,
    advance_payment_monthly: advanceRaw === '' ? null : Number(advanceRaw),
  };

  if (editingMieterId) {
    const { error } = await supabaseClient.from('tenants').update(payload).eq('id', editingMieterId);
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  } else {
    const { error } = await supabaseClient.from('tenants').insert(payload);
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  }

  closeModal('modal-mieter');
  await loadData();
}

async function deleteMieter(id) {
  if (!confirm('Mieter wirklich löschen? Zugehörige Zahlungen werden mitgelöscht.')) return;
  const { error } = await supabaseClient.from('tenants').delete().eq('id', id);
  if (error) { alert('Fehler beim Löschen: ' + error.message); return; }
  await loadData();
}

function renderMieterPage(filter = '') {
  const tbody = document.getElementById('mieter-page-tbody');
  let list = tenants;
  if (filter) {
    const f = filter.toLowerCase();
    list = list.filter((t) =>
      (t.name + (t.email || '') + (t.phone || '') + unitLabel(t.unit_id)).toLowerCase().includes(f));
  }
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><p>Keine Mieter gefunden. Lege deinen ersten Mieter an und weise ihm eine Wohnung zu.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((t) => {
    const count = paymentsForTenant(t.id).length;
    const advance = t.advance_payment_monthly != null ? Number(t.advance_payment_monthly).toFixed(2) + ' €' : '–';
    return `
    <tr>
      <td data-label="Name">${esc(t.name)}</td>
      <td data-label="Wohnung">${esc(unitLabel(t.unit_id))}</td>
      <td data-label="E-Mail">${esc(t.email || '–')}</td>
      <td data-label="Telefon">${esc(t.phone || '–')}</td>
      <td data-label="Einzug">${esc(t.move_in_date || '–')}</td>
      <td data-label="NK-Vorauszahlung">${advance}</td>
      <td data-label="Aktionen">
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="openZahlungenModal('${t.id}')">Zahlungen (${count})</button>
          <button class="btn btn-secondary btn-sm" onclick="openMieterModal('${t.id}')">Bearbeiten</button>
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
//  NEBENKOSTENABRECHNUNG
// ══════════════════════════════════════════════════
function costItemsForStatement(statementId) {
  return costItems.filter((k) => k.statement_id === statementId);
}

function allocationKeyLabel(key) {
  return key === 'unit' ? 'Gleichmäßig pro Wohnung' : 'Nach Wohnfläche (m²)';
}

function statementTotal(statementId) {
  return costItemsForStatement(statementId).reduce((sum, k) => sum + Number(k.amount), 0);
}

function propertyOptionsHtml(selectedPropertyId) {
  if (!properties.length) return '<option value="">Keine Immobilien vorhanden</option>';
  return properties.map((p) => {
    const selected = p.id === selectedPropertyId ? 'selected' : '';
    return `<option value="${p.id}" ${selected}>${esc(p.name)}</option>`;
  }).join('');
}

function openAbrechnungModal(id = null) {
  editingStatementId = id;
  const statement = id ? statements.find((s) => s.id === id) : null;
  document.getElementById('a-property').innerHTML = propertyOptionsHtml(statement ? statement.property_id : null);
  document.getElementById('a-title').value = statement?.title || '';
  document.getElementById('a-period-start').value = statement?.period_start || '';
  document.getElementById('a-period-end').value = statement?.period_end || '';
  document.getElementById('modal-abrechnung-title').textContent = id ? 'Abrechnung bearbeiten' : 'Neue Abrechnung';
  openModal('modal-abrechnung');
}

async function saveAbrechnung() {
  const propertyId = document.getElementById('a-property').value;
  const title = document.getElementById('a-title').value.trim();
  const periodStart = document.getElementById('a-period-start').value;
  const periodEnd = document.getElementById('a-period-end').value;
  if (!propertyId) { alert('Bitte eine Immobilie auswählen.'); return; }
  if (!title) { alert('Bitte einen Titel angeben.'); return; }
  if (!periodStart || !periodEnd) { alert('Bitte Zeitraum von/bis angeben.'); return; }
  if (periodEnd < periodStart) { alert('Das Ende des Zeitraums darf nicht vor dessen Beginn liegen.'); return; }

  const payload = { property_id: propertyId, title, period_start: periodStart, period_end: periodEnd };

  if (editingStatementId) {
    const { error } = await supabaseClient.from('cost_statements').update(payload).eq('id', editingStatementId);
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  } else {
    const { error } = await supabaseClient.from('cost_statements').insert(payload);
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  }
  closeModal('modal-abrechnung');
  await loadData();
}

async function deleteAbrechnung(id) {
  if (!confirm('Abrechnung wirklich löschen? Alle Kostenpositionen werden mitgelöscht.')) return;
  const { error } = await supabaseClient.from('cost_statements').delete().eq('id', id);
  if (error) { alert('Fehler beim Löschen: ' + error.message); return; }
  await loadData();
}

function tenantsForProperty(propertyId) {
  return unitsForProperty(propertyId).flatMap((u) => tenantsForUnit(u.id));
}

function renderNebenkosten() {
  const tbody = document.getElementById('nebenkosten-tbody');
  if (!statements.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><p>Noch keine Abrechnungen angelegt.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = statements.map((s) => {
    const property = properties.find((p) => p.id === s.property_id);
    const propertyTenants = tenantsForProperty(s.property_id);
    const tenantNames = propertyTenants.map((t) => esc(t.name)).join(', ') || '–';
    const months = monthsBetween(s.period_start, s.period_end);
    const totalAdvance = propertyTenants.reduce((sum, t) => sum + (Number(t.advance_payment_monthly) || 0) * months, 0);
    return `
    <tr>
      <td data-label="Titel">${esc(s.title)}</td>
      <td data-label="Immobilie">${esc(property ? property.name : '–')}</td>
      <td data-label="Zeitraum">${esc(s.period_start)} – ${esc(s.period_end)}</td>
      <td data-label="Mieter">${tenantNames}</td>
      <td data-label="Gesamtkosten">${statementTotal(s.id).toFixed(2)} €</td>
      <td data-label="Vorauszahlungen">${totalAdvance.toFixed(2)} €</td>
      <td data-label="Aktionen">
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="openKostenpositionenModal('${s.id}')">Kostenpositionen (${costItemsForStatement(s.id).length})</button>
          <button class="btn btn-secondary btn-sm" onclick="openErgebnisModal('${s.id}')">Berechnung anzeigen</button>
          <button class="btn btn-secondary btn-sm" onclick="openAbrechnungModal('${s.id}')">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAbrechnung('${s.id}')">Löschen</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Kostenpositionen einer Abrechnung ──
function openKostenpositionenModal(statementId) {
  currentKostenpositionenStatementId = statementId;
  const statement = statements.find((s) => s.id === statementId);
  document.getElementById('modal-kostenpositionen-titel').textContent = statement ? statement.title : '';
  resetKostenpositionForm();
  renderKostenpositionen();
  openModal('modal-kostenpositionen');
}

function resetKostenpositionForm() {
  editingKostenpositionId = null;
  document.getElementById('kp-category').value = '';
  document.getElementById('kp-amount').value = '';
  document.getElementById('kp-allocation-key').value = 'sqm';
  document.getElementById('kostenposition-form-label').textContent = 'Kostenposition hinzufügen';
  document.getElementById('kostenposition-cancel-edit-btn').style.display = 'none';
}

function editKostenposition(id) {
  const item = costItems.find((k) => k.id === id);
  if (!item) return;
  editingKostenpositionId = id;
  document.getElementById('kp-category').value = item.category || '';
  document.getElementById('kp-amount').value = item.amount ?? '';
  document.getElementById('kp-allocation-key').value = item.allocation_key || 'sqm';
  document.getElementById('kostenposition-form-label').textContent = 'Kostenposition bearbeiten';
  document.getElementById('kostenposition-cancel-edit-btn').style.display = '';
}

async function saveKostenposition() {
  const category = document.getElementById('kp-category').value.trim();
  const amountRaw = document.getElementById('kp-amount').value;
  if (!category) { alert('Bitte eine Kategorie angeben.'); return; }
  if (amountRaw === '') { alert('Bitte einen Betrag angeben.'); return; }

  const payload = {
    category,
    amount: Number(amountRaw),
    allocation_key: document.getElementById('kp-allocation-key').value,
  };

  if (editingKostenpositionId) {
    const { error } = await supabaseClient.from('cost_items').update(payload).eq('id', editingKostenpositionId);
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  } else {
    const { error } = await supabaseClient.from('cost_items')
      .insert({ ...payload, statement_id: currentKostenpositionenStatementId });
    if (error) { alert('Fehler beim Speichern: ' + error.message); return; }
  }

  await loadData();
  resetKostenpositionForm();
  renderKostenpositionen();
}

async function deleteKostenposition(id) {
  if (!confirm('Kostenposition wirklich löschen?')) return;
  const { error } = await supabaseClient.from('cost_items').delete().eq('id', id);
  if (error) { alert('Fehler beim Löschen: ' + error.message); return; }
  await loadData();
  renderKostenpositionen();
}

function renderKostenpositionen() {
  const tbody = document.getElementById('kostenpositionen-tbody');
  const list = costItemsForStatement(currentKostenpositionenStatementId);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty"><p>Noch keine Kostenpositionen für diese Abrechnung.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((k) => `
    <tr>
      <td data-label="Kategorie">${esc(k.category)}</td>
      <td data-label="Betrag">${Number(k.amount).toFixed(2)} €</td>
      <td data-label="Umlageschlüssel">${esc(allocationKeyLabel(k.allocation_key))}</td>
      <td data-label="Aktionen">
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="editKostenposition('${k.id}')">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" onclick="deleteKostenposition('${k.id}')">Löschen</button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Abrechnungsergebnis je Wohnung ──
function monthsBetween(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  return Math.max(months, 1);
}

function computeAllocation(statement) {
  const items = costItemsForStatement(statement.id);
  const propertyUnits = unitsForProperty(statement.property_id);
  const totalSqm = propertyUnits.reduce((sum, u) => sum + (Number(u.size_qm) || 0), 0);
  const unitCount = propertyUnits.length;
  const months = monthsBetween(statement.period_start, statement.period_end);

  return propertyUnits.map((u) => {
    const breakdown = items.map((item) => {
      let share = 0;
      if (item.allocation_key === 'unit') {
        share = unitCount > 0 ? Number(item.amount) / unitCount : 0;
      } else {
        share = totalSqm > 0 ? ((Number(u.size_qm) || 0) / totalSqm) * Number(item.amount) : 0;
      }
      return { category: item.category, share };
    });
    const total = breakdown.reduce((sum, b) => sum + b.share, 0);
    const unitTenants = tenantsForUnit(u.id);
    const advance = unitTenants.reduce((sum, t) => sum + (Number(t.advance_payment_monthly) || 0) * months, 0);
    return { unit: u, tenants: unitTenants, breakdown, total, advance, balance: advance - total };
  });
}

function openErgebnisModal(statementId) {
  const statement = statements.find((s) => s.id === statementId);
  if (!statement) return;
  currentErgebnisStatementId = statementId;
  document.getElementById('modal-ergebnis-titel').textContent = statement.title;

  const property = properties.find((p) => p.id === statement.property_id);
  const months = monthsBetween(statement.period_start, statement.period_end);
  document.getElementById('modal-ergebnis-hinweis').textContent =
    `${property ? property.name : '–'} · Zeitraum ${statement.period_start} – ${statement.period_end} (${months} Monat${months === 1 ? '' : 'e'})`;

  const tbody = document.getElementById('ergebnis-tbody');
  const allocations = computeAllocation(statement);
  if (!allocations.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><p>Diese Immobilie hat noch keine Wohnungen.</p></div></td></tr>`;
  } else {
    tbody.innerHTML = allocations.map((a) => {
      const breakdownText = a.breakdown.map((b) => `${esc(b.category)}: ${b.share.toFixed(2)} €`).join('<br>') || '–';
      const tenantNames = a.tenants.map((t) => esc(t.name)).join(', ') || '–';
      const balanceLabel = a.balance >= 0
        ? `<span style="color:var(--green)">Guthaben ${a.balance.toFixed(2)} €</span>`
        : `<span style="color:var(--red)">Nachzahlung ${Math.abs(a.balance).toFixed(2)} €</span>`;
      return `
      <tr>
        <td data-label="Wohnung">${esc(a.unit.name)}</td>
        <td data-label="Mieter">${tenantNames}</td>
        <td data-label="Kosten (Aufteilung)">${breakdownText}</td>
        <td data-label="Gesamtkosten">${a.total.toFixed(2)} €</td>
        <td data-label="Vorauszahlung">${a.advance.toFixed(2)} €</td>
        <td data-label="Ergebnis">${balanceLabel}</td>
        <td data-label="Aktionen">
          <button class="btn btn-secondary btn-sm" onclick="downloadNebenkostenPdf('${statement.id}','${a.unit.id}')">PDF</button>
        </td>
      </tr>`;
    }).join('');
  }
  openModal('modal-abrechnung-ergebnis');
}

// ── PDF-Export je Wohnung/Mieter ──
function downloadNebenkostenPdf(statementId, unitId) {
  const statement = statements.find((s) => s.id === statementId);
  const unit = units.find((u) => u.id === unitId);
  if (!statement || !unit) return;
  if (!window.jspdf) { alert('PDF-Bibliothek konnte nicht geladen werden.'); return; }

  const property = properties.find((p) => p.id === statement.property_id);
  const allocation = computeAllocation(statement).find((a) => a.unit.id === unitId);
  if (!allocation) return;
  const months = monthsBetween(statement.period_start, statement.period_end);
  const tenantNames = allocation.tenants.map((t) => t.name).join(', ') || 'Mieter unbekannt';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text('Nebenkostenabrechnung', 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.text(`${property ? property.name : ''}${property?.address ? ' – ' + property.address : ''}`, 14, y);
  y += 6;
  doc.text(`Wohnung: ${unit.name}`, 14, y);
  y += 6;
  doc.text(`Mieter: ${tenantNames}`, 14, y);
  y += 6;
  doc.text(`Abrechnungszeitraum: ${statement.period_start} – ${statement.period_end} (${months} Monat${months === 1 ? '' : 'e'})`, 14, y);
  y += 12;

  doc.setFontSize(12);
  doc.text('Kostenaufteilung', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.text('Kategorie', 14, y);
  doc.text('Anteil', 170, y, { align: 'right' });
  y += 2;
  doc.line(14, y, 196, y);
  y += 6;

  allocation.breakdown.forEach((b) => {
    doc.text(b.category, 14, y);
    doc.text(`${b.share.toFixed(2)} €`, 170, y, { align: 'right' });
    y += 7;
  });

  y += 2;
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFontSize(11);
  doc.text('Gesamtkosten', 14, y);
  doc.text(`${allocation.total.toFixed(2)} €`, 170, y, { align: 'right' });
  y += 7;
  doc.text('Geleistete Vorauszahlung', 14, y);
  doc.text(`${allocation.advance.toFixed(2)} €`, 170, y, { align: 'right' });
  y += 10;

  doc.setFontSize(12);
  const balanceText = allocation.balance >= 0
    ? `Guthaben: ${allocation.balance.toFixed(2)} €`
    : `Nachzahlung: ${Math.abs(allocation.balance).toFixed(2)} €`;
  doc.text(balanceText, 14, y);

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, 14, 285);

  const safeName = (unit.name + '_' + statement.title).replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_');
  doc.save(`Nebenkostenabrechnung_${safeName}.pdf`);
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
