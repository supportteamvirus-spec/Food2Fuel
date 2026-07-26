/* ============================= LoopFeed — app logic ============================= */

/* ---------------------------- constants ---------------------------- */

const WASTE_TYPES = ['Kitchen scraps', 'Vegetable peelings', 'Cooked food waste', 'Banquet leftovers', 'Mixed organic waste'];
const BUSINESS_TYPES = ['Restaurant', 'Hotel', 'Resort', 'Marriage Hall', 'Caterer'];
const TIME_SLOTS = ['6:00 – 8:00 AM', '8:00 – 10:00 AM', '5:00 – 7:00 PM', '7:00 – 9:00 PM'];
const STAGES = ['Requested', 'Collected', 'Delivered', 'Processed'];
const VEHICLE_TYPES = ['E-rickshaw', 'Auto / Tempo', 'Mini truck', 'Truck', 'Two-wheeler'];
const RATE_PER_KG = 3; // ₹ per kg — invoicing rate charged to the waste generator once weight is confirmed

const LS_USERS = 'loopfeed_users';
const LS_PICKUPS = 'loopfeed_pickups';
const LS_SESSION = 'loopfeed_session';

/* ---------------------------- icon set ---------------------------- */

const ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  truck: '<rect x="1" y="7" width="13" height="9" rx="1"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="5.5" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/>',
  factory: '<path d="M3 20V10l5 3V10l5 3V10l5 3v7z"/><path d="M3 20h18"/>',
  flame: '<path d="M12 2c1 4-3 5-3 9a4 4 0 0 0 8 0c0-2-1-3-1-3s2 2 2 5a6 6 0 0 1-12 0c0-5 4-6 6-11z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  mapPin: '<path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  fileText: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.8.3 5 2.5 5 6"/>',
  trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  weight: '<circle cx="12" cy="8" r="4"/><path d="M6.5 12h11l2 9h-15z"/>',
  package: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9zM8 12l3 3 5-5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  creditCard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  rupee: '<path d="M6 4h12M6 9h12M6 4c0 3.5-3 5-6 5h12c3 0 5.5-2 6-5M6 9l9 11"/>',
};

function icon(name, size = 15) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

/* ---------------------------- helpers ---------------------------- */

const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function timeAgo(ts) {
  if (!ts) return '';
  const mins = Math.floor(Math.max(0, Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}
const batchLabel = (n) => `LF-${String(n).padStart(4, '0')}`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------- storage (localStorage) ---------------------------- */

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(LS_USERS)) || []; } catch (e) { return []; }
}
function saveUsers(users) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}
function loadPickups() {
  try { return JSON.parse(localStorage.getItem(LS_PICKUPS)) || []; } catch (e) { return []; }
}
function savePickups(pickups) {
  localStorage.setItem(LS_PICKUPS, JSON.stringify(pickups));
}

/* ---------------------------- state ---------------------------- */

let users = loadUsers();
let pickups = loadPickups();
let currentUser = null;
let activeTab = 'overview';
let authRole = 'generator';
let pendingPhone = null;
let locationWatchId = null;

/* ============================================================= */
/*  AUTH SCREEN — phone number first, auto-detect login vs signup  */
/* ============================================================= */

const ROLE_LABELS = { generator: 'Business name', plant: 'Plant name', delivery: 'Partner name' };
const ROLE_PLACEHOLDERS = { generator: 'e.g. Sarovar Banquets', plant: 'e.g. Rohtak BioEnergy Plant', delivery: 'e.g. Suresh Transport' };
const ROLE_BLURBS = {
  generator: 'Waste generators (restaurants, hotels, resorts, marriage halls, caterers) request pickups and track every batch through to its disposal record.',
  plant: 'Biogas plants receive routed feedstock from generators, confirm processing, and issue compliance records.',
  delivery: "Delivery partners handle the physical pickup and drop-off, updating status so generator and plant portals stay in sync automatically.",
};

function initAuthScreen() {
  document.getElementById('f-type').innerHTML = BUSINESS_TYPES.map((t) => `<option>${t}</option>`).join('');
  document.getElementById('f-vehicle').innerHTML = VEHICLE_TYPES.map((t) => `<option>${t}</option>`).join('');

  document.querySelectorAll('.role-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      authRole = btn.dataset.role;
      document.querySelectorAll('.role-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.getElementById('label-businessName').textContent = ROLE_LABELS[authRole];
      document.getElementById('f-businessName').placeholder = ROLE_PLACEHOLDERS[authRole];
      document.getElementById('role-blurb').textContent = ROLE_BLURBS[authRole];
      updateRegisterFieldsVisibility();
      clearAuthError();
    });
  });

  document.getElementById('phone-form').addEventListener('submit', handlePhoneContinue);
  document.getElementById('register-form').addEventListener('submit', handleRegisterSubmit);
  document.getElementById('btn-back-phone').addEventListener('click', backToPhoneStep);

  document.querySelectorAll('.land-get-started').forEach((btn) => {
    btn.addEventListener('click', goToAuthScreen);
  });
  const backLanding = document.getElementById('btn-back-landing');
  if (backLanding) backLanding.addEventListener('click', backToLanding);

  updateRegisterFieldsVisibility();
}

function goToAuthScreen() {
  document.getElementById('landing-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  const phoneInput = document.getElementById('f-phone');
  if (phoneInput) phoneInput.focus();
}

function backToLanding() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('landing-screen').classList.remove('hidden');
}

function updateRegisterFieldsVisibility() {
  document.getElementById('field-type').classList.toggle('hidden', authRole !== 'generator');
  document.getElementById('field-capacity').classList.toggle('hidden', authRole !== 'plant');
  document.getElementById('field-vehicle').classList.toggle('hidden', authRole !== 'delivery');
}

function normalizePhone(raw) {
  return raw.replace(/\D/g, '').slice(-10);
}

function clearPhoneError() {
  const el = document.getElementById('phone-error');
  el.classList.add('hidden');
  el.textContent = '';
}
function showPhoneError(msg) {
  const el = document.getElementById('phone-error');
  el.innerHTML = `${icon('alert', 15)} <span>${esc(msg)}</span>`;
  el.classList.remove('hidden');
}
function clearAuthError() {
  const el = document.getElementById('auth-error');
  el.classList.add('hidden');
  el.textContent = '';
}
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.innerHTML = `${icon('alert', 15)} <span>${esc(msg)}</span>`;
  el.classList.remove('hidden');
}

function handlePhoneContinue(e) {
  e.preventDefault();
  clearPhoneError();

  const phone = normalizePhone(document.getElementById('f-phone').value);
  if (phone.length !== 10) {
    showPhoneError('Enter a valid 10-digit phone number.');
    return;
  }

  const found = users.find((u) => u.phone === phone);
  if (found) {
    loginAs(found);
    return;
  }

  // Not registered — automatically continue into registration, same panel.
  pendingPhone = phone;
  document.getElementById('phone-display').textContent = `+91 ${phone}`;
  document.getElementById('register-form').reset();
  authRole = 'generator';
  document.querySelectorAll('.role-btn').forEach((b) => b.classList.toggle('active', b.dataset.role === 'generator'));
  document.getElementById('label-businessName').textContent = ROLE_LABELS.generator;
  document.getElementById('f-businessName').placeholder = ROLE_PLACEHOLDERS.generator;
  document.getElementById('role-blurb').textContent = ROLE_BLURBS.generator;
  updateRegisterFieldsVisibility();
  clearAuthError();

  document.getElementById('step-phone').classList.add('hidden');
  document.getElementById('step-register').classList.remove('hidden');
}

function backToPhoneStep() {
  pendingPhone = null;
  document.getElementById('step-register').classList.add('hidden');
  document.getElementById('step-phone').classList.remove('hidden');
  clearPhoneError();
  document.getElementById('f-phone').focus();
}

function handleRegisterSubmit(e) {
  e.preventDefault();
  clearAuthError();

  if (!pendingPhone) { backToPhoneStep(); return; }

  const businessName = document.getElementById('f-businessName').value.trim();
  const type = document.getElementById('f-type').value;
  const capacity = document.getElementById('f-capacity').value;
  const vehicle = document.getElementById('f-vehicle').value;
  const address = document.getElementById('f-address').value.trim();

  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = true;

  if (!businessName || !address) {
    showAuthError('Please fill in all required fields.');
    btn.disabled = false;
    return;
  }
  if (authRole === 'plant' && !capacity) {
    showAuthError('Please enter your processing capacity.');
    btn.disabled = false;
    return;
  }
  if (users.some((u) => u.phone === pendingPhone)) {
    // Race condition guard — number got registered elsewhere in the meantime.
    showAuthError('This number just got registered — please continue instead.');
    btn.disabled = false;
    return;
  }

  const newUser = {
    id: uid('u'), role: authRole, phone: pendingPhone, businessName,
    type: authRole === 'generator' ? type : null,
    capacity: authRole === 'plant' ? capacity : null,
    vehicle: authRole === 'delivery' ? vehicle : null,
    address, createdAt: Date.now(),
  };
  users.push(newUser);
  saveUsers(users);
  pendingPhone = null;
  loginAs(newUser);
  btn.disabled = false;
}

function loginAs(user) {
  currentUser = user;
  localStorage.setItem(LS_SESSION, user.id);
  activeTab = 'overview';
  document.getElementById('landing-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  renderShell();
}

function logout() {
  stopLocationSharing();
  currentUser = null;
  localStorage.removeItem(LS_SESSION);
  document.getElementById('phone-form').reset();
  document.getElementById('register-form').reset();
  clearPhoneError();
  clearAuthError();
  document.getElementById('step-register').classList.add('hidden');
  document.getElementById('step-phone').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
}

/* ============================================================= */
/*  SHELL / NAV                                                    */
/* ============================================================= */

const GEN_TABS = [
  { key: 'overview', label: 'Overview', icon: 'trending' },
  { key: 'request', label: 'Request pickup', icon: 'plus' },
  { key: 'history', label: 'Pickup history', icon: 'package' },
  { key: 'payments', label: 'Payments', icon: 'creditCard' },
];
const PLANT_TABS = [
  { key: 'overview', label: 'Overview', icon: 'trending' },
  { key: 'incoming', label: 'Incoming feedstock', icon: 'truck' },
  { key: 'log', label: 'Supply log', icon: 'fileText' },
];
const DELIVERY_TABS = [
  { key: 'overview', label: 'Overview', icon: 'trending' },
  { key: 'jobs', label: 'Assigned jobs', icon: 'truck' },
  { key: 'log', label: 'Delivery log', icon: 'fileText' },
];

function renderShell() {
  const tabs = currentUser.role === 'generator' ? GEN_TABS : currentUser.role === 'plant' ? PLANT_TABS : DELIVERY_TABS;
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = tabs.map((t) => `
    <button class="nav-item ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
      ${icon(t.icon, 16)} ${t.label}
    </button>
  `).join('');
  nav.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; renderShell(); });
  });

  document.getElementById('user-name').textContent = currentUser.businessName;
  document.getElementById('user-sub').textContent = currentUser.role === 'generator'
    ? (currentUser.type || '')
    : currentUser.role === 'plant'
      ? `${currentUser.capacity || '—'} tons/day`
      : (currentUser.vehicle || 'Delivery partner');
  document.getElementById('logout-btn').onclick = logout;

  renderContent();
}

function renderContent() {
  const el = document.getElementById('content-area');
  if (currentUser.role === 'generator') {
    if (activeTab === 'overview') el.innerHTML = generatorOverviewHTML();
    if (activeTab === 'request') el.innerHTML = requestPickupHTML();
    if (activeTab === 'history') el.innerHTML = generatorHistoryHTML();
    if (activeTab === 'payments') el.innerHTML = generatorPaymentsHTML();
    wireGeneratorEvents();
  } else if (currentUser.role === 'plant') {
    if (activeTab === 'overview') el.innerHTML = plantOverviewHTML();
    if (activeTab === 'incoming') el.innerHTML = plantIncomingHTML();
    if (activeTab === 'log') el.innerHTML = plantLogHTML();
    wirePlantEvents();
  } else {
    if (activeTab === 'overview') el.innerHTML = deliveryOverviewHTML();
    if (activeTab === 'jobs') el.innerHTML = deliveryJobsHTML();
    if (activeTab === 'log') el.innerHTML = deliveryLogHTML();
    wireDeliveryEvents();
  }
}

/* ============================================================= */
/*  FLOW TRACKER (signature element)                                */
/* ============================================================= */

function flowTrackerHTML(status, compact) {
  const idx = STAGES.indexOf(status);
  const icons = ['clock', 'truck', 'factory', 'flame'];
  const size = compact ? 26 : 32;
  let html = '<div class="flow-tracker">';
  STAGES.forEach((stage, i) => {
    const done = i < idx;
    const current = i === idx;
    const bg = done ? 'var(--moss)' : current ? 'var(--amber)' : 'var(--bg-soft)';
    const iconColor = done ? '#fff' : current ? 'var(--moss-dark)' : 'var(--faint)';
    const glow = current ? 'box-shadow:0 0 0 3px var(--amber-soft);' : '';
    html += `<div class="flow-node">
      <div class="flow-circle" style="width:${size}px;height:${size}px;background:${bg};${glow}">
        <span style="color:${iconColor};display:flex;">${done ? icon('check', size * 0.55) : icon(icons[i], size * 0.5)}</span>
      </div>
      ${!compact ? `<span class="flow-label" style="color:${done || current ? 'var(--ink)' : 'var(--faint)'}">${stage}</span>` : ''}
    </div>`;
    if (i < STAGES.length - 1) {
      const w = compact ? 22 : 34;
      const dir = i % 2 === 0 ? -2 : 12;
      const stroke = i < idx ? 'var(--moss)' : 'var(--border)';
      html += `<svg width="${w}" height="10" style="margin-bottom:${compact ? 0 : 16}px;flex-shrink:0;">
        <path d="M0,5 Q${w / 2},${dir} ${w},5" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    }
  });
  html += '</div>';
  return html;
}

/* ============================================================= */
/*  GENERATOR: OVERVIEW                                            */
/* ============================================================= */

function generatorOverviewHTML() {
  const mine = pickups.filter((p) => p.generatorId === currentUser.id);
  const active = mine.filter((p) => p.status !== 'Processed');
  const diverted = mine.filter((p) => p.status === 'Delivered' || p.status === 'Processed').reduce((s, p) => s + Number(p.estimatedQty || 0), 0);
  const records = mine.filter((p) => p.status === 'Delivered' || p.status === 'Processed').length;
  const recent = [...mine].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  const pendingInvoices = mine.filter((p) => p.invoice && p.invoice.status === 'Unpaid');
  const pendingAmount = pendingInvoices.reduce((s, p) => s + p.invoice.amount, 0);

  return `
  <div class="fadein">
    <div class="page-head">
      <div>
        <h1 class="page-title">Overview</h1>
        <p class="page-sub">Compliance fee active · waste collection running on schedule.</p>
      </div>
      <button class="btn btn-amber" id="btn-goto-request">${icon('plus')} Request pickup</button>
    </div>

    ${pendingInvoices.length > 0 ? `
    <div class="card" style="padding:16px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;border-color:var(--amber);background:var(--amber-soft);">
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="stat-icon amber">${icon('rupee', 16)}</span>
        <div>
          <div style="font-weight:600;font-size:14px;">₹${pendingAmount} pending across ${pendingInvoices.length} invoice${pendingInvoices.length > 1 ? 's' : ''}</div>
          <div style="font-size:12.5px;color:var(--muted);">Pay before the biogas plant can complete handover.</div>
        </div>
      </div>
      <button class="btn btn-amber btn-sm" id="btn-goto-payments">${icon('creditCard', 13)} Review & pay</button>
    </div>` : ''}

    <div class="stat-row">
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Active pickups</span><span class="stat-icon">${icon('truck', 15)}</span></div><div class="stat-value">${active.length}</div><div class="stat-sub">in the collection pipeline</div></div>
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Waste diverted</span><span class="stat-icon amber">${icon('weight', 15)}</span></div><div class="stat-value">${diverted} kg</div><div class="stat-sub">from landfill, all-time</div></div>
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Compliance records</span><span class="stat-icon">${icon('fileText', 15)}</span></div><div class="stat-value">${records}</div><div class="stat-sub">disposal confirmations issued</div></div>
    </div>

    <div class="card section-card">
      <div class="section-head">
        <h2 class="section-title">Recent batches</h2>
        <button class="btn btn-ghost btn-sm" id="btn-goto-history">View all ${icon('chevron', 13)}</button>
      </div>
      ${recent.length === 0 ? emptyStateHTML('package', 'No pickups yet', 'Request your first pickup to start diverting waste from landfill.') :
        recent.map((p) => `
          <div class="batch-row">
            <div>
              <div class="batch-mono mono">${batchLabel(p.batchNo)} · ${fmtDate(p.date)}</div>
              <div class="batch-title">${esc(p.wasteType)} · ${esc(p.estimatedQty)} kg</div>
            </div>
            ${flowTrackerHTML(p.status, true)}
          </div>
        `).join('')}
    </div>
  </div>`;
}

function emptyStateHTML(iconName, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${icon(iconName, 22)}</div><div class="empty-title">${esc(title)}</div><div class="empty-sub">${esc(sub)}</div></div>`;
}

/* ============================================================= */
/*  GENERATOR: REQUEST PICKUP                                      */
/* ============================================================= */

let lastRequestResult = null;

function requestPickupHTML() {
  if (lastRequestResult) {
    const done = lastRequestResult;
    return `
    <div class="fadein form-wrap">
      <div class="card success-card">
        <div class="success-icon">${icon('check', 26)}</div>
        <h2 class="page-title" style="font-size:20px;margin-bottom:6px;">Pickup requested</h2>
        <p class="mono" style="color:var(--muted);font-size:14px;margin:0 0 4px;">${batchLabel(done.batchNo)}</p>
        <p style="color:var(--muted);font-size:14px;line-height:1.6;margin:10px 0 22px;">
          ${done.plantName
            ? `Routed for collection on <strong>${fmtDate(done.date)}</strong>, assigned to <strong>${esc(done.plantName)}</strong>.`
            : `Your request is logged for <strong>${fmtDate(done.date)}</strong>. It will be assigned to the nearest biogas plant partner shortly.`}
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button class="btn btn-ghost" id="btn-request-another">Request another</button>
          <button class="btn btn-primary" id="btn-view-history">View history</button>
        </div>
      </div>
    </div>`;
  }

  return `
  <div class="fadein form-wrap">
    <h1 class="page-title">Request a pickup</h1>
    <p class="page-sub" style="margin-bottom:22px;">Segregate your organic waste, then schedule a collection window.</p>
    <form class="card form-card" id="request-form">
      <div class="field">
        <label>Waste type</label>
        <select class="input" id="r-wasteType">${WASTE_TYPES.map((t) => `<option>${t}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Estimated quantity (kg)</label>
        <input class="input" type="number" min="1" id="r-qty" placeholder="e.g. 40" required />
      </div>
      <div class="field">
        <label>Pickup date</label>
        <input class="input" type="date" id="r-date" min="${new Date().toISOString().slice(0, 10)}" required />
      </div>
      <div class="field">
        <label>Time slot</label>
        <select class="input" id="r-slot">${TIME_SLOTS.map((t) => `<option>${t}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Notes for the collection crew (optional)</label>
        <textarea class="input" rows="3" id="r-notes" placeholder="e.g. Use the rear service gate"></textarea>
      </div>
      <button type="submit" class="btn btn-amber btn-block">${icon('calendar')} Confirm pickup request</button>
    </form>
  </div>`;
}

function assignPlant() {
  const plants = users.filter((u) => u.role === 'plant');
  if (plants.length === 0) return null;
  const load = {};
  plants.forEach((pl) => (load[pl.id] = 0));
  pickups.forEach((p) => { if (p.plantId && p.status !== 'Processed' && load[p.plantId] !== undefined) load[p.plantId]++; });
  return plants.reduce((best, pl) => (load[pl.id] < load[best.id] ? pl : best), plants[0]);
}

function assignDeliveryPartner() {
  const partners = users.filter((u) => u.role === 'delivery');
  if (partners.length === 0) return null;
  const load = {};
  partners.forEach((d) => (load[d.id] = 0));
  pickups.forEach((p) => { if (p.deliveryPartnerId && (p.status === 'Requested' || p.status === 'Collected') && load[p.deliveryPartnerId] !== undefined) load[p.deliveryPartnerId]++; });
  return partners.reduce((best, d) => (load[d.id] < load[best.id] ? d : best), partners[0]);
}

function wireGeneratorEvents() {
  const gotoRequest = document.getElementById('btn-goto-request');
  if (gotoRequest) gotoRequest.addEventListener('click', () => { activeTab = 'request'; renderShell(); });
  const gotoHistory = document.getElementById('btn-goto-history');
  if (gotoHistory) gotoHistory.addEventListener('click', () => { activeTab = 'history'; renderShell(); });
  const gotoPayments = document.getElementById('btn-goto-payments');
  if (gotoPayments) gotoPayments.addEventListener('click', () => { activeTab = 'payments'; renderShell(); });

  const form = document.getElementById('request-form');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const wasteType = document.getElementById('r-wasteType').value;
    const estimatedQty = document.getElementById('r-qty').value;
    const date = document.getElementById('r-date').value;
    const timeSlot = document.getElementById('r-slot').value;
    const notes = document.getElementById('r-notes').value;
    if (!estimatedQty || !date) return;

    const plant = assignPlant();
    const partner = assignDeliveryPartner();
    const newPickup = {
      id: uid('p'), batchNo: pickups.length + 1,
      generatorId: currentUser.id, generatorName: currentUser.businessName, businessType: currentUser.type, generatorAddress: currentUser.address,
      wasteType, estimatedQty, date, timeSlot, notes,
      status: 'Requested', plantId: plant ? plant.id : null, plantName: plant ? plant.businessName : null,
      deliveryPartnerId: partner ? partner.id : null, deliveryPartnerName: partner ? partner.businessName : null,
      createdAt: Date.now(), collectedAt: null, deliveredAt: null, processedAt: null, recordId: null,
      actualWeight: null, invoice: null,
    };
    pickups.push(newPickup);
    savePickups(pickups);
    lastRequestResult = newPickup;
    renderShell();
  });

  const another = document.getElementById('btn-request-another');
  if (another) another.addEventListener('click', () => { lastRequestResult = null; renderShell(); });
  const viewHist = document.getElementById('btn-view-history');
  if (viewHist) viewHist.addEventListener('click', () => { lastRequestResult = null; activeTab = 'history'; renderShell(); });

  document.querySelectorAll('[data-action="view-record"]').forEach((btn) => {
    btn.addEventListener('click', () => openRecordModal(btn.dataset.id));
  });

  document.querySelectorAll('[data-action="view-location"]').forEach((btn) => {
    btn.addEventListener('click', () => openLocationModal(btn.dataset.id));
  });

  document.querySelectorAll('[data-action="pay-now"]').forEach((btn) => {
    btn.addEventListener('click', () => openPaymentModal(btn.dataset.id));
  });
}

/* ============================================================= */
/*  GENERATOR: HISTORY                                             */
/* ============================================================= */

function generatorHistoryHTML() {
  const mine = [...pickups].filter((p) => p.generatorId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt);

  return `
  <div class="fadein">
    <h1 class="page-title">Pickup history</h1>
    <p class="page-sub" style="margin-bottom:22px;">Every batch, tracked from request to processed feedstock.</p>
    ${mine.length === 0 ? `<div class="card" style="padding:10px;">${emptyStateHTML('package', 'No pickups yet', 'Your requested batches will appear here.')}</div>` :
      mine.map((p) => `
      <div class="card pickup-card">
        <div class="pickup-top">
          <div>
            <div class="batch-mono mono">${batchLabel(p.batchNo)}</div>
            <div class="batch-title">${esc(p.wasteType)} · ${esc(p.estimatedQty)} kg</div>
            <div class="pickup-meta">${icon('calendar', 12)} ${fmtDate(p.date)} · ${esc(p.timeSlot)}</div>
            ${p.plantName ? `<div class="pickup-meta">${icon('mapPin', 12)} ${esc(p.plantName)}</div>` : ''}
            ${p.deliveryPartnerName ? `<div class="pickup-meta">${icon('truck', 12)} ${esc(p.deliveryPartnerName)}</div>` : ''}
          </div>
          ${flowTrackerHTML(p.status, false)}
        </div>
        <div class="pickup-actions">
          ${p.status === 'Requested' && p.deliveryPartnerId ? `<span class="waiting-note">${icon('clock', 13)} Awaiting pickup by ${esc(p.deliveryPartnerName)}</span>` : ''}
          ${p.status === 'Requested' && !p.deliveryPartnerId ? `<span class="waiting-note amber">${icon('clock', 13)} Awaiting delivery partner assignment</span>` : ''}
          ${p.status === 'Collected' ? `<span class="waiting-note">${icon('truck', 13)} En route to ${esc(p.plantName) || 'the biogas plant'}</span>
            <button class="btn btn-ghost btn-sm" data-action="view-location" data-id="${p.id}">${icon('mapPin', 13)} View live location</button>` : ''}
          ${p.status === 'Delivered' && !p.invoice ? `<span class="waiting-note">${icon('clock', 13)} Arrived at plant — awaiting weighing</span>` : ''}
          ${p.status === 'Delivered' && p.invoice && p.invoice.status === 'Unpaid' ? `<span class="waiting-note amber">${icon('rupee', 13)} Invoice ${esc(p.invoice.id)} · ₹${p.invoice.amount} due</span>
            <button class="btn btn-amber btn-sm" data-action="pay-now" data-id="${p.id}">${icon('creditCard', 13)} Pay now</button>` : ''}
          ${p.status === 'Delivered' && p.invoice && p.invoice.status === 'Paid' ? `<span class="waiting-note">${icon('check', 13)} Paid · awaiting plant handover confirmation</span>` : ''}
          ${(p.status === 'Delivered' || p.status === 'Processed') ? `<button class="btn btn-primary btn-sm" data-action="view-record" data-id="${p.id}">${icon('fileText', 13)} View digital record</button>` : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
}

/* ============================================================= */
/*  GENERATOR: PAYMENTS                                             */
/* ============================================================= */

function generatorPaymentsHTML() {
  const mine = pickups.filter((p) => p.generatorId === currentUser.id && p.invoice);
  const pending = mine.filter((p) => p.invoice.status === 'Unpaid').sort((a, b) => b.invoice.generatedAt - a.invoice.generatedAt);
  const paid = mine.filter((p) => p.invoice.status === 'Paid').sort((a, b) => b.invoice.paidAt - a.invoice.paidAt);
  const pendingAmount = pending.reduce((s, p) => s + p.invoice.amount, 0);
  const paidAmount = paid.reduce((s, p) => s + p.invoice.amount, 0);

  return `
  <div class="fadein">
    <h1 class="page-title">Payments</h1>
    <p class="page-sub" style="margin-bottom:22px;">Invoices are generated once the biogas plant weighs your batch. Pay before handover completes.</p>

    <div class="stat-row">
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Pending amount</span><span class="stat-icon amber">${icon('rupee', 15)}</span></div><div class="stat-value">₹${pendingAmount}</div><div class="stat-sub">${pending.length} invoice${pending.length === 1 ? '' : 's'} awaiting payment</div></div>
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Total paid</span><span class="stat-icon">${icon('creditCard', 15)}</span></div><div class="stat-value">₹${paidAmount}</div><div class="stat-sub">${paid.length} payment${paid.length === 1 ? '' : 's'} completed</div></div>
    </div>

    <div class="card section-card" style="margin-bottom:20px;">
      <h2 class="section-title" style="margin-bottom:14px;">Pending invoices</h2>
      ${pending.length === 0 ? emptyStateHTML('creditCard', 'No pending invoices', 'Invoices appear here once a plant weighs your delivered batch.') :
        pending.map((p) => `
        <div class="card pickup-card" style="border-color:var(--amber);">
          <div class="pickup-top">
            <div>
              <div class="batch-mono mono">${batchLabel(p.batchNo)} · ${esc(p.invoice.id)}</div>
              <div class="batch-title">${esc(p.plantName) || 'Biogas plant'}</div>
              <div class="pickup-meta">${icon('weight', 12)} ${p.invoice.weight} kg × ₹${p.invoice.ratePerKg}/kg</div>
              <div class="pickup-meta">${icon('calendar', 12)} Invoiced ${fmtDateTime(p.invoice.generatedAt)}</div>
            </div>
            <div style="text-align:right;">
              <div class="stat-value" style="font-size:22px;">₹${p.invoice.amount}</div>
            </div>
          </div>
          <div class="pickup-actions">
            <button class="btn btn-amber btn-sm" data-action="pay-now" data-id="${p.id}">${icon('creditCard', 13)} Pay now</button>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card" style="overflow:hidden;">
      <div class="section-head" style="padding:20px 20px 0;">
        <h2 class="section-title">Payment history</h2>
      </div>
      ${paid.length === 0 ? `<div style="padding:10px;">${emptyStateHTML('fileText', 'No payments yet', 'Completed payments will be logged here.')}</div>` : `
      <div class="table-wrap">
        <table class="log-table">
          <thead><tr>${['Invoice', 'Batch', 'Plant', 'Weight', 'Amount', 'Paid on', 'Txn ID'].map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${paid.map((p) => `
              <tr>
                <td class="mono" style="color:var(--muted);">${esc(p.invoice.id)}</td>
                <td style="font-weight:600;">${batchLabel(p.batchNo)}</td>
                <td style="color:var(--muted);">${esc(p.plantName) || '—'}</td>
                <td>${p.invoice.weight} kg</td>
                <td style="font-weight:600;">₹${p.invoice.amount}</td>
                <td style="color:var(--muted);">${fmtDate(p.invoice.paidAt)}</td>
                <td class="mono" style="color:var(--muted);">${esc(p.invoice.txnId)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
  </div>`;
}

function openRecordModal(pickupId) {
  const p = pickups.find((x) => x.id === pickupId);
  if (!p) return;
  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" id="modal-overlay">
    <div class="card modal-box fadein" id="modal-box">
      <div class="modal-head">
        <h3 class="modal-title">Digital disposal record</h3>
        <button class="btn btn-ghost modal-close" id="modal-close">${icon('x', 16)}</button>
      </div>
      <div class="record-highlight">
        <div class="record-id mono">${esc(p.recordId)}</div>
        <div class="record-desc">${esc(p.estimatedQty)} kg of ${esc(p.wasteType).toLowerCase()} responsibly disposed</div>
      </div>
      <div class="record-rows">
        <div class="record-row"><span class="label">Batch</span><span class="value">${batchLabel(p.batchNo)}</span></div>
        <div class="record-row"><span class="label">Generator</span><span class="value">${esc(p.generatorName)}</span></div>
        <div class="record-row"><span class="label">Collected</span><span class="value">${p.collectedAt ? fmtDateTime(p.collectedAt) : '—'}</span></div>
        <div class="record-row"><span class="label">Picked up by</span><span class="value">${esc(p.deliveryPartnerName) || '—'}</span></div>
        <div class="record-row"><span class="label">Delivered to</span><span class="value">${esc(p.plantName) || '—'}</span></div>
        <div class="record-row"><span class="label">Delivered on</span><span class="value">${p.deliveredAt ? fmtDateTime(p.deliveredAt) : '—'}</span></div>
        ${p.invoice ? `<div class="record-row"><span class="label">Weighed quantity</span><span class="value">${p.invoice.weight} kg</span></div>
        <div class="record-row"><span class="label">Invoice</span><span class="value">${esc(p.invoice.id)} · ₹${p.invoice.amount}</span></div>
        <div class="record-row"><span class="label">Payment status</span><span class="value">${p.invoice.status === 'Paid' ? `Paid ${fmtDate(p.invoice.paidAt)}` : 'Unpaid'}</span></div>` : ''}
        <div class="record-row"><span class="label">Processing status</span><span class="value">${p.status === 'Processed' ? 'Converted to biogas & fertilizer' : 'Awaiting processing'}</span></div>
      </div>
      <p class="record-foot">This record confirms responsible, traceable disposal in line with organic waste management guidelines.</p>
    </div>
  </div>`;
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModal(); });
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function openLocationModal(pickupId) {
  const p = pickups.find((x) => x.id === pickupId);
  if (!p) return;
  const partner = users.find((u) => u.id === p.deliveryPartnerId);
  const loc = partner && partner.location;
  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" id="modal-overlay">
    <div class="card modal-box fadein" id="modal-box">
      <div class="modal-head">
        <h3 class="modal-title">Live location</h3>
        <button class="btn btn-ghost modal-close" id="modal-close">${icon('x', 16)}</button>
      </div>
      ${loc ? `
        <div class="record-highlight">
          <div class="record-id mono">${batchLabel(p.batchNo)}</div>
          <div class="record-desc">${esc(partner.businessName)} · en route to ${esc(p.plantName) || 'the plant'}</div>
        </div>
        <div style="border-radius:10px;overflow:hidden;border:1px solid var(--border);margin-bottom:16px;">
          <iframe width="100%" height="240" style="border:0;display:block;" loading="lazy" title="Delivery partner location"
            src="https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - 0.015}%2C${loc.lat - 0.012}%2C${loc.lng + 0.015}%2C${loc.lat + 0.012}&layer=mapnik&marker=${loc.lat}%2C${loc.lng}">
          </iframe>
        </div>
        <div class="record-rows">
          <div class="record-row"><span class="label">Coordinates</span><span class="value mono">${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</span></div>
          <div class="record-row"><span class="label">Last updated</span><span class="value">${timeAgo(loc.updatedAt)}</span></div>
        </div>
        <a class="btn btn-ghost btn-block" style="margin-top:14px;" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${loc.lat},${loc.lng}">${icon('mapPin', 14)} Open in Google Maps</a>
      ` : emptyStateHTML('mapPin', 'Location not shared yet', `${esc(partner ? partner.businessName : 'The delivery partner')} hasn't turned on live location sharing.`)}
    </div>
  </div>`;
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModal(); });
}

function openPaymentModal(pickupId) {
  const p = pickups.find((x) => x.id === pickupId);
  if (!p || !p.invoice) return;
  const inv = p.invoice;
  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" id="modal-overlay">
    <div class="card modal-box fadein" id="modal-box">
      <div class="modal-head">
        <h3 class="modal-title">Pay invoice</h3>
        <button class="btn btn-ghost modal-close" id="modal-close">${icon('x', 16)}</button>
      </div>
      <div class="record-highlight">
        <div class="record-id mono">${esc(inv.id)}</div>
        <div class="record-desc">${batchLabel(p.batchNo)} · ${esc(p.plantName) || 'Biogas plant'}</div>
      </div>
      <div class="record-rows">
        <div class="record-row"><span class="label">Weighed quantity</span><span class="value">${inv.weight} kg</span></div>
        <div class="record-row"><span class="label">Rate</span><span class="value">₹${inv.ratePerKg} / kg</span></div>
        <div class="record-row"><span class="label">Amount payable</span><span class="value" style="font-size:16px;">₹${inv.amount}</span></div>
      </div>
      <div class="field" style="margin-top:16px;">
        <label>Pay via</label>
        <div class="pay-method-row" id="pay-method-row">
          <button type="button" class="pay-method active" data-method="upi">${icon('creditCard', 14)} UPI</button>
          <button type="button" class="pay-method" data-method="card">${icon('creditCard', 14)} Card</button>
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="btn-confirm-pay" style="margin-top:16px;">${icon('rupee', 14)} Pay ₹${inv.amount}</button>
      <p class="record-foot">Simulated payment for this demo — no real transaction is processed.</p>
    </div>
  </div>`;
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModal(); });
  document.querySelectorAll('.pay-method').forEach((btn) => {
    btn.addEventListener('click', () => document.querySelectorAll('.pay-method').forEach((b) => b.classList.toggle('active', b === btn)));
  });
  document.getElementById('btn-confirm-pay').addEventListener('click', (e) => {
    e.target.disabled = true;
    markInvoicePaid(pickupId);
  });
}

function markInvoicePaid(pickupId) {
  const txnId = `TXN${Date.now().toString(36).toUpperCase()}`;
  pickups = pickups.map((p) => (p.id === pickupId && p.invoice
    ? { ...p, invoice: { ...p.invoice, status: 'Paid', paidAt: Date.now(), txnId } }
    : p));
  savePickups(pickups);
  closeModal();
  renderShell();
}

/* ============================================================= */
/*  PLANT: OVERVIEW                                                 */
/* ============================================================= */

function plantOverviewHTML() {
  const mine = pickups.filter((p) => p.plantId === currentUser.id);
  const incoming = mine.filter((p) => p.status === 'Collected');
  const monthKey = new Date().toISOString().slice(0, 7);
  const received = mine.filter((p) => p.status === 'Delivered' || p.status === 'Processed');
  const receivedThisMonth = received.filter((p) => new Date(p.deliveredAt || p.createdAt).toISOString().slice(0, 7) === monthKey);
  const monthKg = receivedThisMonth.reduce((s, p) => s + Number(p.estimatedQty || 0), 0);
  const partners = new Set(mine.map((p) => p.generatorId)).size;
  const paidInvoices = mine.filter((p) => p.invoice && p.invoice.status === 'Paid');
  const unpaidInvoices = mine.filter((p) => p.invoice && p.invoice.status === 'Unpaid');
  const revenue = paidInvoices.reduce((s, p) => s + p.invoice.amount, 0);

  return `
  <div class="fadein">
    <div style="margin-bottom:22px;">
      <h1 class="page-title">Overview</h1>
      <p class="page-sub">Incoming feedstock from your generator network.</p>
    </div>

    <div class="stat-row">
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Incoming today</span><span class="stat-icon amber">${icon('truck', 15)}</span></div><div class="stat-value">${incoming.length}</div><div class="stat-sub">collected, en route</div></div>
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Billable feedstock</span><span class="stat-icon">${icon('weight', 15)}</span></div><div class="stat-value">${monthKg} kg</div><div class="stat-sub">received this month</div></div>
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Revenue collected</span><span class="stat-icon">${icon('rupee', 15)}</span></div><div class="stat-value">₹${revenue}</div><div class="stat-sub">${unpaidInvoices.length ? `${unpaidInvoices.length} invoice(s) unpaid` : 'all invoices settled'}</div></div>
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Generator partners</span><span class="stat-icon">${icon('users', 15)}</span></div><div class="stat-value">${partners}</div><div class="stat-sub">supplying your plant</div></div>
    </div>

    <div class="card section-card">
      <div class="section-head">
        <h2 class="section-title">En route to you</h2>
        <button class="btn btn-ghost btn-sm" id="btn-goto-incoming">Manage ${icon('chevron', 13)}</button>
      </div>
      ${incoming.length === 0 ? emptyStateHTML('truck', 'Nothing incoming right now', 'Collected batches from your partner network will appear here.') :
        incoming.slice(0, 4).map((p) => `
          <div class="batch-row">
            <div>
              <div class="batch-title">${esc(p.generatorName)}</div>
              <div class="batch-mono mono" style="color:var(--muted);font-family:var(--font-body);font-size:12.5px;">${esc(p.wasteType)} · ${esc(p.estimatedQty)} kg</div>
            </div>
            ${flowTrackerHTML(p.status, true)}
          </div>
        `).join('')}
    </div>
  </div>`;
}

/* ============================================================= */
/*  PLANT: INCOMING FEEDSTOCK                                       */
/* ============================================================= */

function plantIncomingHTML() {
  const mine = pickups.filter((p) => p.plantId === currentUser.id && p.status !== 'Processed').sort((a, b) => b.createdAt - a.createdAt);

  return `
  <div class="fadein">
    <h1 class="page-title">Incoming feedstock</h1>
    <p class="page-sub" style="margin-bottom:22px;">Weigh each batch on arrival to generate an invoice — handover completes once the generator pays.</p>
    ${mine.length === 0 ? `<div class="card" style="padding:10px;">${emptyStateHTML('factory', 'No active deliveries', 'Batches routed from your generator partners will show up here.')}</div>` :
      mine.map((p) => `
      <div class="card pickup-card">
        <div class="pickup-top">
          <div>
            <div class="batch-mono mono">${batchLabel(p.batchNo)}</div>
            <div class="batch-title">${esc(p.generatorName)}</div>
            <div class="pickup-meta">${esc(p.businessType || '')} · ${esc(p.wasteType)} · est. ${esc(p.estimatedQty)} kg</div>
            ${p.deliveryPartnerName ? `<div class="pickup-meta">${icon('truck', 12)} ${esc(p.deliveryPartnerName)}</div>` : ''}
          </div>
          ${flowTrackerHTML(p.status, false)}
        </div>
        <div class="pickup-actions">
          ${p.status === 'Requested' ? `<span class="waiting-note">${icon('clock', 13)} Awaiting pickup by delivery partner</span>` : ''}
          ${p.status === 'Collected' ? `<span class="waiting-note">${icon('truck', 13)} Picked up, en route via ${esc(p.deliveryPartnerName) || 'delivery partner'}</span>
            <button class="btn btn-ghost btn-sm" data-action="view-location" data-id="${p.id}">${icon('mapPin', 13)} View live location</button>` : ''}
        </div>
        ${p.status === 'Delivered' && !p.invoice ? `
        <div class="weigh-box">
          <div class="weigh-row">
            <div class="field" style="margin-bottom:0;flex:1;">
              <label>Actual weight on arrival (kg)</label>
              <input class="input" type="number" min="0" step="0.1" id="weigh-${p.id}" placeholder="e.g. 43.5" />
            </div>
            <button class="btn btn-amber btn-sm" data-action="generate-invoice" data-id="${p.id}">${icon('rupee', 13)} Generate invoice</button>
          </div>
          <div class="pickup-meta" style="margin-top:8px;">Billed at ₹${RATE_PER_KG}/kg — amount is calculated automatically once weight is entered.</div>
        </div>` : ''}
        ${p.status === 'Delivered' && p.invoice && p.invoice.status === 'Unpaid' ? `
        <div class="pickup-actions">
          <span class="waiting-note amber">${icon('rupee', 13)} Invoice ${esc(p.invoice.id)} · ₹${p.invoice.amount} (${p.invoice.weight} kg) · awaiting payment from generator before handover</span>
        </div>` : ''}
        ${p.status === 'Delivered' && p.invoice && p.invoice.status === 'Paid' ? `
        <div class="pickup-actions">
          <span class="waiting-note">${icon('check', 13)} Paid · Invoice ${esc(p.invoice.id)} · ₹${p.invoice.amount}</span>
          <button class="btn btn-amber btn-sm" data-action="mark-processed" data-id="${p.id}">${icon('flame', 13)} Confirm handover & mark processed</button>
        </div>` : ''}
      </div>
    `).join('')}
  </div>`;
}

function wirePlantEvents() {
  const gotoIncoming = document.getElementById('btn-goto-incoming');
  if (gotoIncoming) gotoIncoming.addEventListener('click', () => { activeTab = 'incoming'; renderShell(); });

  document.querySelectorAll('[data-action="mark-processed"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      pickups = pickups.map((p) => (p.id === id ? { ...p, status: 'Processed', processedAt: Date.now() } : p));
      savePickups(pickups);
      renderShell();
    });
  });

  document.querySelectorAll('[data-action="generate-invoice"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const input = document.getElementById(`weigh-${id}`);
      const weight = Number(input.value);
      if (!weight || weight <= 0) {
        input.style.borderColor = 'var(--danger)';
        input.focus();
        return;
      }
      const amount = Math.round(weight * RATE_PER_KG);
      const invoice = {
        id: `INV-${id.split('-')[1].toUpperCase()}`,
        weight, ratePerKg: RATE_PER_KG, amount,
        generatedAt: Date.now(), status: 'Unpaid', paidAt: null, txnId: null,
      };
      pickups = pickups.map((p) => (p.id === id ? { ...p, actualWeight: weight, invoice } : p));
      savePickups(pickups);
      renderShell();
    });
  });

  document.querySelectorAll('[data-action="view-location"]').forEach((btn) => {
    btn.addEventListener('click', () => openLocationModal(btn.dataset.id));
  });
}

/* ============================================================= */
/*  PLANT: SUPPLY LOG                                                */
/* ============================================================= */

function plantLogHTML() {
  const mine = pickups.filter((p) => p.plantId === currentUser.id && (p.status === 'Delivered' || p.status === 'Processed')).sort((a, b) => (b.deliveredAt || 0) - (a.deliveredAt || 0));
  const total = mine.reduce((s, p) => s + Number(p.estimatedQty || 0), 0);

  return `
  <div class="fadein">
    <div class="page-head">
      <div>
        <h1 class="page-title">Supply log</h1>
        <p class="page-sub">Full record of feedstock received, for billing and reconciliation.</p>
      </div>
      <div class="mono" style="font-size:13px;color:var(--moss);font-weight:600;">${total} kg total</div>
    </div>
    ${mine.length === 0 ? `<div class="card" style="padding:10px;">${emptyStateHTML('fileText', 'No supply history yet', 'Received batches will be logged here once confirmed.')}</div>` : `
    <div class="card" style="overflow:hidden;">
      <div class="table-wrap">
        <table class="log-table">
          <thead><tr>${['Batch', 'Generator', 'Type', 'Qty', 'Delivered', 'Status', 'Record'].map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${mine.map((p) => `
              <tr>
                <td class="mono" style="color:var(--muted);">${batchLabel(p.batchNo)}</td>
                <td style="font-weight:600;">${esc(p.generatorName)}</td>
                <td style="color:var(--muted);">${esc(p.wasteType)}</td>
                <td>${esc(p.estimatedQty)} kg</td>
                <td style="color:var(--muted);">${p.deliveredAt ? fmtDate(p.deliveredAt) : '—'}</td>
                <td><span class="badge ${p.status === 'Processed' ? 'badge-done' : 'badge-pending'}">${p.status}</span></td>
                <td class="mono" style="color:var(--muted);">${esc(p.recordId) || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  </div>`;
}

/* ============================================================= */
/*  DELIVERY PARTNER: OVERVIEW                                       */
/* ============================================================= */

function deliveryOverviewHTML() {
  const mine = pickups.filter((p) => p.deliveryPartnerId === currentUser.id);
  const pending = mine.filter((p) => p.status === 'Requested');
  const enRoute = mine.filter((p) => p.status === 'Collected');
  const completed = mine.filter((p) => p.status === 'Delivered' || p.status === 'Processed');
  const monthKey = new Date().toISOString().slice(0, 7);
  const completedThisMonth = completed.filter((p) => new Date(p.deliveredAt || p.createdAt).toISOString().slice(0, 7) === monthKey);
  const generators = new Set(mine.map((p) => p.generatorId)).size;
  const recent = [...mine].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

  return `
  <div class="fadein">
    <div style="margin-bottom:22px;">
      <h1 class="page-title">Overview</h1>
      <p class="page-sub">Your assigned pickups and drop-offs across the network.</p>
    </div>

    <div class="stat-row">
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Pending pickups</span><span class="stat-icon amber">${icon('clock', 15)}</span></div><div class="stat-value">${pending.length}</div><div class="stat-sub">waiting to be picked up</div></div>
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">En route</span><span class="stat-icon">${icon('truck', 15)}</span></div><div class="stat-value">${enRoute.length}</div><div class="stat-sub">picked up, headed to plant</div></div>
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Delivered this month</span><span class="stat-icon">${icon('weight', 15)}</span></div><div class="stat-value">${completedThisMonth.length}</div><div class="stat-sub">batches dropped off</div></div>
      <div class="card stat-card"><div class="stat-head"><span class="stat-label">Business partners</span><span class="stat-icon">${icon('users', 15)}</span></div><div class="stat-value">${generators}</div><div class="stat-sub">generators served</div></div>
    </div>

    <div class="card section-card">
      <div class="section-head">
        <h2 class="section-title">Your jobs</h2>
        <button class="btn btn-ghost btn-sm" id="btn-goto-jobs">Manage ${icon('chevron', 13)}</button>
      </div>
      ${recent.length === 0 ? emptyStateHTML('truck', 'No jobs assigned yet', 'Pickups routed to you will appear here.') :
        recent.map((p) => `
          <div class="batch-row">
            <div>
              <div class="batch-title">${esc(p.generatorName)} → ${esc(p.plantName) || 'Unassigned plant'}</div>
              <div class="batch-mono mono" style="color:var(--muted);font-family:var(--font-body);font-size:12.5px;">${esc(p.wasteType)} · ${esc(p.estimatedQty)} kg</div>
            </div>
            ${flowTrackerHTML(p.status, true)}
          </div>
        `).join('')}
    </div>
  </div>`;
}

/* ============================================================= */
/*  DELIVERY PARTNER: ASSIGNED JOBS                                  */
/* ============================================================= */

function deliveryJobsHTML() {
  const mine = pickups.filter((p) => p.deliveryPartnerId === currentUser.id && (p.status === 'Requested' || p.status === 'Collected'))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const sharing = locationWatchId !== null;
  const loc = currentUser.location;

  return `
  <div class="fadein">
    <h1 class="page-title">Assigned jobs</h1>
    <p class="page-sub" style="margin-bottom:18px;">Mark each job picked up at the generator, then confirm drop-off at the plant.</p>

    <div class="card section-card" style="margin-bottom:20px;">
      <div class="section-head">
        <h2 class="section-title">${icon('mapPin', 16)} Live location</h2>
        <span id="loc-status" class="badge ${sharing ? 'badge-done' : 'badge-pending'}">${sharing ? 'Sharing' : 'Not sharing'}</span>
      </div>
      <p class="page-sub" style="margin:0 0 12px;font-size:13px;">Generators and plants can see your live location on a map while you're marked "en route" on a job.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-primary btn-sm ${sharing ? 'hidden' : ''}" id="btn-share-location">${icon('mapPin', 13)} Start sharing my location</button>
        <button class="btn btn-ghost btn-sm ${sharing ? '' : 'hidden'}" id="btn-stop-location">${icon('x', 13)} Stop sharing</button>
        <span class="pickup-meta" id="loc-updated">${loc ? `${icon('clock', 12)} Updated ${timeAgo(loc.updatedAt)}` : 'No location shared yet'}</span>
      </div>
      <div id="loc-error" class="error hidden" style="margin-top:10px;"></div>
    </div>

    ${mine.length === 0 ? `<div class="card" style="padding:10px;">${emptyStateHTML('truck', 'No active jobs', 'New pickups routed to you will show up here.')}</div>` :
      mine.map((p) => `
      <div class="card pickup-card">
        <div class="pickup-top">
          <div>
            <div class="batch-mono mono">${batchLabel(p.batchNo)}</div>
            <div class="batch-title">${esc(p.generatorName)}</div>
            <div class="pickup-meta">${icon('mapPin', 12)} Pickup: ${esc(p.generatorAddress) || 'address on file'}</div>
            <div class="pickup-meta">${icon('calendar', 12)} ${fmtDate(p.date)} · ${esc(p.timeSlot)}</div>
            <div class="pickup-meta">${esc(p.wasteType)} · ${esc(p.estimatedQty)} kg</div>
            <div class="pickup-meta">${icon('factory', 12)} Drop-off: ${esc(p.plantName) || 'plant to be assigned'}</div>
            ${p.notes ? `<div class="pickup-meta">${icon('fileText', 12)} ${esc(p.notes)}</div>` : ''}
          </div>
          ${flowTrackerHTML(p.status, false)}
        </div>
        <div class="pickup-actions">
          ${p.status === 'Requested' ? `<button class="btn btn-primary btn-sm" data-action="mark-picked-up" data-id="${p.id}">${icon('truck', 13)} Mark picked up</button>` : ''}
          ${p.status === 'Collected' ? `<button class="btn btn-amber btn-sm" data-action="mark-delivered" data-id="${p.id}">${icon('factory', 13)} Confirm drop-off at plant</button>` : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
}

/* ---------------------------- live location sharing ---------------------------- */

function showLocationError(msg) {
  const el = document.getElementById('loc-error');
  if (!el) return;
  el.innerHTML = `${icon('alert', 14)} <span>${esc(msg)}</span>`;
  el.classList.remove('hidden');
}
function clearLocationError() {
  const el = document.getElementById('loc-error');
  if (el) { el.classList.add('hidden'); el.textContent = ''; }
}

function updateLocationStatusUI() {
  const statusEl = document.getElementById('loc-status');
  const updatedEl = document.getElementById('loc-updated');
  if (statusEl) { statusEl.textContent = 'Sharing'; statusEl.classList.remove('badge-pending'); statusEl.classList.add('badge-done'); }
  if (updatedEl && currentUser.location) updatedEl.innerHTML = `${icon('clock', 12)} Updated ${timeAgo(currentUser.location.updatedAt)}`;
}

function startLocationSharing() {
  clearLocationError();
  if (!navigator.geolocation) {
    showLocationError('Geolocation is not supported in this browser.');
    return;
  }
  locationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() };
      currentUser.location = loc;
      users = users.map((u) => (u.id === currentUser.id ? { ...u, location: loc } : u));
      saveUsers(users);
      updateLocationStatusUI();
    },
    (err) => {
      showLocationError('Could not get your location: ' + err.message);
      stopLocationSharing();
      renderShell();
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
  renderShell();
}

function stopLocationSharing() {
  if (locationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(locationWatchId);
  }
  locationWatchId = null;
}

function wireDeliveryEvents() {
  const gotoJobs = document.getElementById('btn-goto-jobs');
  if (gotoJobs) gotoJobs.addEventListener('click', () => { activeTab = 'jobs'; renderShell(); });

  const shareBtn = document.getElementById('btn-share-location');
  if (shareBtn) shareBtn.addEventListener('click', startLocationSharing);
  const stopBtn = document.getElementById('btn-stop-location');
  if (stopBtn) stopBtn.addEventListener('click', () => { stopLocationSharing(); renderShell(); });

  document.querySelectorAll('[data-action="mark-picked-up"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      pickups = pickups.map((p) => (p.id === id ? { ...p, status: 'Collected', collectedAt: Date.now() } : p));
      savePickups(pickups);
      renderShell();
    });
  });

  document.querySelectorAll('[data-action="mark-delivered"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const recordId = `DR-${id.split('-')[1].toUpperCase()}`;
      pickups = pickups.map((p) => (p.id === id ? { ...p, status: 'Delivered', deliveredAt: Date.now(), recordId } : p));
      savePickups(pickups);
      renderShell();
    });
  });
}

/* ============================================================= */
/*  DELIVERY PARTNER: DELIVERY LOG                                    */
/* ============================================================= */

function deliveryLogHTML() {
  const mine = pickups.filter((p) => p.deliveryPartnerId === currentUser.id && (p.status === 'Delivered' || p.status === 'Processed'))
    .sort((a, b) => (b.deliveredAt || 0) - (a.deliveredAt || 0));
  const totalKg = mine.reduce((s, p) => s + Number(p.estimatedQty || 0), 0);

  return `
  <div class="fadein">
    <div class="page-head">
      <div>
        <h1 class="page-title">Delivery log</h1>
        <p class="page-sub">Every completed pickup and drop-off, for your own records.</p>
      </div>
      <div class="mono" style="font-size:13px;color:var(--moss);font-weight:600;">${totalKg} kg total</div>
    </div>
    ${mine.length === 0 ? `<div class="card" style="padding:10px;">${emptyStateHTML('fileText', 'No completed deliveries yet', 'Batches you drop off at a plant will be logged here.')}</div>` : `
    <div class="card" style="overflow:hidden;">
      <div class="table-wrap">
        <table class="log-table">
          <thead><tr>${['Batch', 'Generator', 'Plant', 'Qty', 'Delivered', 'Status', 'Record'].map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${mine.map((p) => `
              <tr>
                <td class="mono" style="color:var(--muted);">${batchLabel(p.batchNo)}</td>
                <td style="font-weight:600;">${esc(p.generatorName)}</td>
                <td style="color:var(--muted);">${esc(p.plantName) || '—'}</td>
                <td>${esc(p.estimatedQty)} kg</td>
                <td style="color:var(--muted);">${p.deliveredAt ? fmtDate(p.deliveredAt) : '—'}</td>
                <td><span class="badge ${p.status === 'Processed' ? 'badge-done' : 'badge-pending'}">${p.status}</span></td>
                <td class="mono" style="color:var(--muted);">${esc(p.recordId) || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  </div>`;
}

/* ============================================================= */
/*  INIT                                                             */
/* ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initAuthScreen();

  const sessionId = localStorage.getItem(LS_SESSION);
  if (sessionId) {
    const found = users.find((u) => u.id === sessionId);
    if (found) {
      currentUser = found;
      activeTab = 'overview';
      document.getElementById('landing-screen').classList.add('hidden');
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-shell').classList.remove('hidden');
      renderShell();
    }
  }
});