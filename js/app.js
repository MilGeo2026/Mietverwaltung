// ══════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════
let properties = [];
let units = [];
let currentPage = 'dashboard';
let editingImmobilieId = null;
let currentWohnungenPropertyId = null;
let editingWohnungId = null;

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
  const [{ data: pRows, error: pErr }, { data: uRows, error: uErr }] = await Promise.all([
    supabaseClient.from('properties').select('*').order('created_at'),
    supabaseClient.from('units').select('*').order('created_at'),
  ]);
  if (pErr || uErr) { alert('Fehler beim Laden der Daten: ' + (pErr?.message || uErr?.message)); return; }
  properties = pRows || [];
  units = uRows || [];
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
  tbody.innerHTML = list.map((u) => `
    <tr>
      <td data-label="Name">${esc(u.name)}</td>
      <td data-label="Größe (m²)">${u.size_qm ?? '–'}</td>
      <td data-label="Zimmer">${u.rooms ?? '–'}</td>
      <td data-label="Aktionen">
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="editWohnung('${u.id}')">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" onclick="deleteWohnung('${u.id}')">Löschen</button>
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
