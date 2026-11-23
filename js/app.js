// ============================================================================
// 1. SUPABASE CONFIGURATION (Replace with your actual Supabase credentials)
// ============================================================================
const SUPABASE_URL = 'https://rrsrpuinegsugpkpjqjk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_czOkclUth1KCPz9FFiw2fg_9ghWcbdG';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// 2. APPLICATION STATE
// ============================================================================
const DAY_KEYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const MONTH_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const STATUS_CYCLE = ['pending', 'attended', 'excused', 'unexcused']; // ⚪️ -> 🟢 -> 🔵 -> 🔴

const state = {
  settings: {
    trainer_name: 'Bea Meinhardt Cazula',
    trainer_subtitle: 'FITNESS & PERSONAL TRAINER',
    default_price: 150,
    class_duration: 60,
    show_weekends: false,
    fechamento_msg: 'Obrigada! ☺️🙏 Bora pra mais um mês!!',
    birthday_msg: 'Feliz aniversário! 🎉🎂 Tudo de bom hoje e sempre!'
  },
  clients: [],
  attendanceLogs: [],
  singleClasses: [],
  selectedDate: new Date(2026, 10, 16), // Default: Nov 16, 2026 (Monday)
  viewYear: 2026,
  viewMonth: 10,
  isCalendarCollapsed: false,
  editingClientId: null,
  selectedColor: '#00B2E3',
  fechamentoMode: 'mes', // 'mes' | 'ano' | 'datas'
  fechamentoMonth: 10,
  fechamentoYear: 2026,
  activeMsgKey: null
};

// ============================================================================
// 3. INITIALIZATION & DATA LOADING
// ============================================================================
async function initApp() {
  populatePriceSelects();
  setupNavigation();
  setupAgendaControls();
  setupAvulsaControls();
  setupClientInfoControls();
  setupFechamentoControls();
  setupAjustesControls();

  await loadAllData();
  renderAll();
}

async function loadAllData() {
  try {
    const [setRes, cliRes, logRes, sinRes] = await Promise.all([
      sb.from('trainer_settings').select('*').eq('id', 1).single(),
      sb.from('clients').select('*').order('created_at', { ascending: true }),
      sb.from('attendance_logs').select('*'),
      sb.from('single_classes').select('*')
    ]);

    if (setRes.data) state.settings = { ...state.settings, ...setRes.data };
    if (cliRes.data) state.clients = cliRes.data;
    if (logRes.data) state.attendanceLogs = logRes.data;
    if (sinRes.data) state.singleClasses = sinRes.data;
  } catch (err) {
    console.warn('Supabase sync note (verify URL/Keys):', err.message);
  }
}

function renderAll() {
  syncAjustesUI();
  renderCalendar();
  renderAgendaTimeline();
  renderClientesList();
  renderFechamento();
}

// ============================================================================
// 4. NAVIGATION & HELPERS
// ============================================================================
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');

  const isModal = document.getElementById(viewId).classList.contains('modal-view');
  document.getElementById('bottom-nav').style.display = isModal ? 'none' : 'flex';
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      showView(target);
      if (target === 'view-fechamento') renderFechamento();
    });
  });
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateBR(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function populatePriceSelects() {
  const options = [];
  for (let p = 50; p <= 400; p += 10) {
    options.push(`<option value="${p}">R$ ${p}</option>`);
  }
  document.getElementById('info-rate').innerHTML = options.join('');
  document.getElementById('set-default-rate').innerHTML = options.join('');
}

// ============================================================================
// 5. AGENDA & COLLAPSIBLE CALENDAR
// ============================================================================
function setupAgendaControls() {
  document.getElementById('btn-toggle-calendar').addEventListener('click', (e) => {
    state.isCalendarCollapsed = !state.isCalendarCollapsed;
    document.getElementById('calendar-wrapper').classList.toggle('collapsed', state.isCalendarCollapsed);
    e.target.textContent = state.isCalendarCollapsed ? '▼' : '▲';
  });

  document.getElementById('btn-prev-month').addEventListener('click', () => {
    state.viewMonth--;
    if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
    renderCalendar();
  });

  document.getElementById('btn-next-month').addEventListener('click', () => {
    state.viewMonth++;
    if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
    renderCalendar();
  });

  document.getElementById('btn-today').addEventListener('click', () => {
    const today = new Date();
    state.selectedDate = today;
    state.viewYear = today.getFullYear();
    state.viewMonth = today.getMonth();
    renderCalendar();
    renderAgendaTimeline();
  });

  document.getElementById('btn-help').addEventListener('click', () => {
    alert('Legenda de Presença:\n⚪️ Pendente\n🟢 Aula Realizada (Cobrada)\n🔵 Falta com Aviso (R$ 0 - Reposição)\n🔴 Falta sem Aviso (Cobrada)\n🟣 Aula Avulsa');
  });
}

function renderCalendar() {
  const showWknd = state.settings.show_weekends;
  const weekdaysEl = document.getElementById('calendar-weekdays');
  const gridEl = document.getElementById('calendar-grid');
  const cols = showWknd ? 7 : 5;

  weekdaysEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const headers = showWknd
    ? ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    : ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  weekdaysEl.innerHTML = headers.map(h => `<span>${h}</span>`).join('');

  const monthName = new Date(state.viewYear, state.viewMonth).toLocaleString('en-US', { month: 'long' });
  document.getElementById('month-label').textContent = `${monthName} ${state.viewYear} >`;

  gridEl.innerHTML = '';
  const firstDayOfMonth = new Date(state.viewYear, state.viewMonth, 1).getDay();
  const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
  const todayStr = formatDateISO(new Date());
  const selectedStr = formatDateISO(state.selectedDate);

  // Leading blank slots
  const offset = showWknd ? firstDayOfMonth : (firstDayOfMonth === 0 ? 0 : (firstDayOfMonth === 6 ? 0 : firstDayOfMonth - 1));
  for (let i = 0; i < offset; i++) {
    gridEl.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(state.viewYear, state.viewMonth, day);
    const dow = dateObj.getDay();
    if (!showWknd && (dow === 0 || dow === 6)) continue;

    const iso = formatDateISO(dateObj);
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (iso === todayStr) cell.classList.add('today');
    if (iso === selectedStr) cell.classList.add('selected');
    cell.textContent = day;

    cell.addEventListener('click', () => {
      state.selectedDate = dateObj;
      renderCalendar();
      renderAgendaTimeline();
    });
    gridEl.appendChild(cell);
  }
}

function renderAgendaTimeline() {
  const timeline = document.getElementById('agenda-timeline');
  timeline.innerHTML = '';

  const isoDate = formatDateISO(state.selectedDate);
  const weekdayKey = DAY_KEYS[state.selectedDate.getDay()];
  const is45Min = Number(state.settings.class_duration) === 45;

  // Gather recurring clients for this weekday + single classes for this exact date
  const sessions = [];

  state.clients.forEach(client => {
    const schedTime = client.weekly_schedule?.[weekdayKey];
    if (schedTime) {
      const existingLog = state.attendanceLogs.find(
        l => l.client_id === client.id && l.session_date === isoDate
      );
      sessions.push({
        type: 'recurring',
        clientId: client.id,
        name: client.name,
        color: client.card_color,
        time: schedTime,
        price: Number(client.hourly_rate),
        status: existingLog ? existingLog.status : 'pending'
      });
    }
  });

  state.singleClasses
    .filter(sc => sc.session_date === isoDate)
    .forEach(sc => {
      const matchedClient = state.clients.find(c => c.id === sc.client_id);
      sessions.push({
        type: 'single',
        singleId: sc.id,
        name: sc.guest_name,
        color: matchedClient ? matchedClient.card_color : '#00B2E3',
        time: sc.session_time,
        price: Number(sc.price),
        status: sc.status || 'avulsa'
      });
    });

  // Render hourly slots 06:00 to 21:00
  for (let h = 6; h <= 21; h++) {
    const hourPrefix = String(h).padStart(2, '0');
    const hourLabel = `${hourPrefix}:00`;
    const slotSessions = sessions.filter(s => s.time.startsWith(hourPrefix + ':'));
    const row = document.createElement('div');
    row.className = 'hour-row';
    row.innerHTML = `<div class="hour-label">${hourLabel}</div><div class="hour-slot"></div>`;
    const slotEl = row.querySelector('.hour-slot');

    slotSessions.forEach((sess) =>
    {
      const item = document.createElement("div");
      item.className = "session-item";

      // Vertical duration: 45 min = 3/4 of the 54px 1-hour slot (38px), 60 min = full slot
      const pillStyle = is45Min ? `background:${sess.color}; display:inline-flex; align-items:center; gap:12px; height:36px; padding:4px 14px;` : `background:${sess.color}; display:inline-flex; align-items:center; gap:12px; min-height:46px; padding:10px 18px;`;
      item.innerHTML = `<div class="session-pill" style="${pillStyle}"><span>${sess.name} ${sess.time.endsWith(":00") ? '' : `<small>(${sess.time})</small>`}</span><button type="button" class="status-dot-btn dot-${sess.status}" title="Alterar status"></button></div>`;
      const dotBtn = item.querySelector(".status-dot-btn");
      
      dotBtn.addEventListener("click", (e) =>
      {
        e.stopPropagation();
        toggleSessionStatus(sess, isoDate);
      });
      slotEl.appendChild(item);
    });
    timeline.appendChild(row);
  }
}

async function toggleSessionStatus(sess, isoDate) {
  if (sess.type === 'single') return; // Single classes keep purple/paid badge
  const currentStatus = sess.status || 'pending';
  const currentIdx = STATUS_CYCLE.indexOf(currentStatus);
  const nextIdx = (currentIdx >= 0 ? currentIdx + 1 : 1) % STATUS_CYCLE.length;
  const newStatus = STATUS_CYCLE[nextIdx];
  const chargedPrice = (newStatus === 'attended' || newStatus === 'unexcused') ? sess.price : 0;

  // Optimistic local update
  const existingIdx = state.attendanceLogs.findIndex(
    l => l.client_id === sess.clientId && l.session_date === isoDate
  );
  const record = {
    client_id: sess.clientId,
    session_date: isoDate,
    session_time: sess.time,
    price: chargedPrice,
    status: newStatus
  };

  if (existingIdx >= 0) {
    state.attendanceLogs[existingIdx] = { ...state.attendanceLogs[existingIdx], ...record };
  } else {
    state.attendanceLogs.push(record);
  }

  renderAgendaTimeline();

  // Persist to Supabase (safe update-or-insert even without unique constraint)
  const { data: updated, error: updErr } = await sb
    .from('attendance_logs')
    .update({ status: newStatus, price: chargedPrice, session_time: sess.time })
    .eq('client_id', sess.clientId)
    .eq('session_date', isoDate)
    .select();

  if (updErr || !updated || updated.length === 0) {
    const { data: inserted, error: insErr } = await sb
      .from('attendance_logs')
      .insert(record)
      .select()
      .single();

    if (insErr) {
      console.error('Erro ao salvar presença no Supabase:', insErr.message);
    } else if (inserted) {
      const idx = state.attendanceLogs.findIndex(
        l => l.client_id === sess.clientId && l.session_date === isoDate
      );
      if (idx >= 0) state.attendanceLogs[idx] = inserted;
    }
  }
}

// ============================================================================
// 6. AULA AVULSA (DEMO / MAKE-UP CLASS WITH DUAL WHEELS)
// ============================================================================
const WHEEL_TIMES = [];
for (let h = 6; h <= 21; h++) {
  ['00', '15', '30', '45'].forEach(m => WHEEL_TIMES.push(`${String(h).padStart(2, '0')}:${m}`));
}
const WHEEL_PRICES = Array.from({ length: 61 }, (_, i) => i * 5); // R$ 0 to R$ 300

function buildWheel(colEl, items, formatter = v => v) {
  colEl.innerHTML = items.map(v => `<div class="wheel-item" data-val="${v}">${formatter(v)}</div>`).join('');
}

function getWheelValue(colEl, items) {
  const idx = Math.round(colEl.scrollTop / 36);
  return items[Math.min(Math.max(idx, 0), items.length - 1)];
}

function setWheelValue(colEl, items, val) {
  const idx = items.indexOf(val);
  if (idx >= 0) colEl.scrollTop = idx * 36;
}

function setupAvulsaControls() {
  const timeCol = document.getElementById('avulsa-time-col');
  const priceCol = document.getElementById('avulsa-price-col');
  buildWheel(timeCol, WHEEL_TIMES);
  buildWheel(priceCol, WHEEL_PRICES, v => `R$ ${v}`);

  document.getElementById('btn-open-avulsa').addEventListener('click', () => {
    const d = state.selectedDate;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    document.getElementById('avulsa-title').textContent = `Aula Avulsa - ${dd}/${mm}/${yy}`;

    // Populate dropdown with existing clients
    const sel = document.getElementById('avulsa-client-select');
    sel.innerHTML = `<option value="">⌄</option>` +
      state.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    document.getElementById('avulsa-name-input').value = '';
    showView('view-avulsa');
    setWheelValue(timeCol, WHEEL_TIMES, '08:00');
    setWheelValue(priceCol, WHEEL_PRICES, 0);
  });

  // Selecting an existing client auto-fills name & defaults price to R$ 0 (make-up class)
  document.getElementById('avulsa-client-select').addEventListener('change', (e) => {
    const client = state.clients.find(c => c.id === e.target.value);
    if (client) {
      document.getElementById('avulsa-name-input').value = client.name;
      setWheelValue(priceCol, WHEEL_PRICES, 0);
    }
  });

  document.getElementById('btn-cancel-avulsa').addEventListener('click', () => showView('view-agenda'));

  document.getElementById('btn-save-avulsa').addEventListener('click', async () => {
    const guestName = document.getElementById('avulsa-name-input').value.trim();
    if (!guestName) return alert('Digite ou selecione um nome.');

    const selectedClientId = document.getElementById('avulsa-client-select').value || null;
    const chosenTime = getWheelValue(timeCol, WHEEL_TIMES);
    const chosenPrice = getWheelValue(priceCol, WHEEL_PRICES);

    const newRecord = {
      client_id: selectedClientId,
      guest_name: guestName,
      session_date: formatDateISO(state.selectedDate),
      session_time: chosenTime,
      price: chosenPrice,
      status: 'avulsa'
    };

    const { data } = await sb.from('single_classes').insert(newRecord).select().single();
    state.singleClasses.push(data || newRecord);
    showView('view-agenda');
    renderAgendaTimeline();
  });
}

// ============================================================================
// 7. CLIENTES & INFO (ADD / EDIT CLIENT)
// ============================================================================
function renderClientesList() {
  const container = document.getElementById('clients-list');
  const days = state.settings.show_weekends
    ? ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM']
    : ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];

  container.innerHTML = state.clients.map(client => {
    const colsHtml = days.map(d => `<div> ${d} <span>${client.weekly_schedule?.[d] || ''}</span> </div>`).join('');
    return `<div class="client-card-wrap" data-id="${client.id}"> <div class="client-card" style="background:${client.card_color}"> <div class="card-top-badge" style="background:${client.card_color}"></div> <div class="card-main-row"> <h3>${client.name}</h3> <div class="avatar-circle">👤</div> </div> <div class="card-days-row">${colsHtml}</div> </div> <span class="card-outer-chevron">&gt;</span> </div>`;
  }).join('');

  container.querySelectorAll('.client-card-wrap').forEach(card => {
    card.addEventListener('click', () => openInfoScreen(card.dataset.id));
  });
}

function openInfoScreen(clientId = null) {
  state.editingClientId = clientId;
  const client = clientId ? state.clients.find(c => c.id === clientId) : null;

  document.getElementById('info-name').value = client ? client.name : '';
  document.getElementById('info-phone').value = client ? (client.phone || '') : '';
  document.getElementById('info-rate').value = client ? client.hourly_rate : state.settings.default_price;
  state.selectedColor = client ? client.card_color : '#00B2E3';

  document.getElementById('btn-delete-client').classList.toggle('hidden', !client);

  // Sync color swatches
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === state.selectedColor);
  });

  // Render weekday toggles + time inputs
  const days = state.settings.show_weekends
    ? ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM']
    : ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
  const sched = client?.weekly_schedule || {};
  const box = document.getElementById('info-weekdays-box');

  box.innerHTML = days.map(day => {
    const activeTime = sched[day] || '';
    return `<div class="schedule-day-row" data-day="${day}"> <button type="button" class="day-pill-btn ${activeTime ? 'active' : ''}">${day}</button> <input type="time" class="day-time-input ${activeTime ? '' : 'hidden'}" value="${activeTime || '12:00'}" step="900" /> </div>`;
  }).join('');

  box.querySelectorAll('.day-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const timeInput = btn.parentElement.querySelector('.day-time-input');
      timeInput.classList.toggle('hidden', !btn.classList.contains('active'));
    });
  });

  showView('view-info');
}

function setupClientInfoControls() {
  document.getElementById('btn-add-client').addEventListener('click', () => openInfoScreen(null));
  document.getElementById('btn-back-info').addEventListener('click', () => showView('view-clientes'));

  document.querySelectorAll('.swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      state.selectedColor = sw.dataset.color;
    });
  });

  document.getElementById('btn-save-client').addEventListener('click', async () => {
    const name = document.getElementById('info-name').value.trim();
    if (!name) return alert('Por favor, informe o nome do aluno.');

    const weekly_schedule = {};
    document.querySelectorAll('.schedule-day-row').forEach(row => {
      const btn = row.querySelector('.day-pill-btn');
      const input = row.querySelector('.day-time-input');
      if (btn.classList.contains('active')) {
        weekly_schedule[row.dataset.day] = input.value;
      }
    });

    const payload = {
      name,
      phone: document.getElementById('info-phone').value.trim(),
      hourly_rate: Number(document.getElementById('info-rate').value),
      card_color: state.selectedColor,
      weekly_schedule
    };

    if (state.editingClientId) {
      await sb.from('clients').update(payload).eq('id', state.editingClientId);
      const idx = state.clients.findIndex(c => c.id === state.editingClientId);
      if (idx >= 0) state.clients[idx] = { ...state.clients[idx], ...payload };
    } else {
      const { data } = await sb.from('clients').insert(payload).select().single();
      state.clients.push(data || { id: crypto.randomUUID(), ...payload });
    }

    showView('view-clientes');
    renderAll();
  });

  document.getElementById('btn-delete-client').addEventListener('click', async () => {
    if (!state.editingClientId || !confirm('Excluir este aluno?')) return;
    await sb.from('clients').delete().eq('id', state.editingClientId);
    state.clients = state.clients.filter(c => c.id !== state.editingClientId);
    showView('view-clientes');
    renderAll();
  });
}

// ============================================================================
// 8. FECHAMENTO & WHATSAPP RECEIPT IMAGE GENERATOR
// ============================================================================
function setupFechamentoControls() {
  const monthCol = document.getElementById('fechamento-month-col');
  const yearCol = document.getElementById('fechamento-year-col');
  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  buildWheel(monthCol, MONTH_SHORT);
  buildWheel(yearCol, years);

  setTimeout(() => {
    setWheelValue(monthCol, MONTH_SHORT, MONTH_SHORT[state.fechamentoMonth]);
    setWheelValue(yearCol, years, state.fechamentoYear);
  }, 50);

  monthCol.addEventListener('scroll', () => {
    const val = getWheelValue(monthCol, MONTH_SHORT);
    state.fechamentoMonth = MONTH_SHORT.indexOf(val);
    renderFechamento();
  });

  yearCol.addEventListener('scroll', () => {
    state.fechamentoYear = getWheelValue(yearCol, years);
    renderFechamento();
  });

  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.fechamentoMode = btn.dataset.mode;
      document.querySelectorAll('.filter-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`filter-${state.fechamentoMode}`).classList.add('active');
      renderFechamento();
    });
  });

  document.getElementById('fechamento-start-date').addEventListener('change', renderFechamento);
  document.getElementById('fechamento-end-date').addEventListener('change', renderFechamento);
}

function matchesFilterDate(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  if (state.fechamentoMode === 'mes') {
    return y === state.fechamentoYear && (m - 1) === state.fechamentoMonth;
  }
  if (state.fechamentoMode === 'ano') {
    return y === state.fechamentoYear;
  }
  const start = document.getElementById('fechamento-start-date').value;
  const end = document.getElementById('fechamento-end-date').value;
  if (start && dateStr < start) return false;
  if (end && dateStr > end) return false;
  return true;
}

function renderFechamento() {
  const listEl = document.getElementById('fechamento-list');
  const grouped = {};

  // 1. Collect recurring logs (exclude 'pending' or show all non-pending)
  state.attendanceLogs
    .filter(l => l.status !== 'pending' && matchesFilterDate(l.session_date))
    .forEach(l => {
      const client = state.clients.find(c => c.id === l.client_id);
      if (!client) return;
      if (!grouped[client.id]) {
        grouped[client.id] = { name: client.name, phone: client.phone, color: client.card_color, total: 0, items: [] };
      }
      const amt = (l.status === 'attended' || l.status === 'unexcused') ? Number(l.price) : 0;
      grouped[client.id].total += amt;
      grouped[client.id].items.push({ date: l.session_date, status: l.status, amount: amt });
    });

  // 2. Collect single / avulsa classes
  state.singleClasses
    .filter(sc => matchesFilterDate(sc.session_date))
    .forEach(sc => {
      const key = sc.client_id || `guest_${sc.guest_name}`;
      const client = state.clients.find(c => c.id === sc.client_id);
      if (!grouped[key]) {
        grouped[key] = {
          name: client ? client.name : sc.guest_name,
          phone: client?.phone || '',
          color: client ? client.card_color : '#00B2E3',
          total: 0,
          items: []
        };
      }
      const amt = Number(sc.price);
      grouped[key].total += amt;
      grouped[key].items.push({ date: sc.session_date, status: 'avulsa', amount: amt });
    });

  const groups = Object.values(grouped);
  if (!groups.length) {
    listEl.innerHTML = `<p style="text-align:center;color:#888;margin-top:24px;">Nenhuma aula registrada neste período.</p>`;
    return;
  }

  listEl.innerHTML = groups.map((g, idx) => {
    g.items.sort((a, b) => a.date.localeCompare(b.date));
    const linesHtml = g.items.map(it => `<div class="fechamento-line"> <div class="line-left"> <span class="mini-dot dot-${it.status}"></span> <span>${formatDateBR(it.date)}</span> </div> <span>${it.amount > 0 ? `R$ ${it.amount}` : '0'}</span> </div>`).join('');
    return `<div class="fechamento-group"> <div class="fechamento-bar" style="background:${g.color}" data-idx="${idx}"> <span>R$ ${g.total} &nbsp;&nbsp; ${g.name}</span> <span>&gt;</span> </div> <div class="fechamento-details" id="f-det-${idx}"> <button class="share-whatsapp-btn" data-idx="${idx}" title="Enviar via WhatsApp">📤</button> ${linesHtml} </div> </div>`;
  }).join('');

  listEl.querySelectorAll('.fechamento-bar').forEach(bar => {
    bar.addEventListener('click', () => {
      document.getElementById(`f-det-${bar.dataset.idx}`).classList.toggle('open');
    });
  });

  listEl.querySelectorAll('.share-whatsapp-btn').forEach(btn => {
    btn.addEventListener('click', () => shareReceiptViaWhatsApp(groups[btn.dataset.idx]));
  });
}

async function shareReceiptViaWhatsApp(group) {
  const canvas = document.getElementById('receipt-canvas');
  const ctx = canvas.getContext('2d');
  const h = Math.max(760, 560 + group.items.length * 52);
  canvas.height = h;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 720, h);

  // Top Trainer Header Banner (Matching Screenshot)
  ctx.fillStyle = '#7c6265';
  ctx.fillRect(0, 0, 720, 175);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.settings.trainer_name, 360, 88);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#f0e6e7';
  ctx.fillText(state.settings.trainer_subtitle, 360, 125);

  // Period text
  const firstDate = group.items[0] ? formatDateBR(group.items[0].date) : '';
  const lastDate = group.items[group.items.length - 1] ? formatDateBR(group.items[group.items.length - 1].date) : '';
  ctx.fillStyle = '#222222';
  ctx.font = '28px sans-serif';
  ctx.fillText(`Olá ${group.name}, segue resumo das`, 360, 245);
  ctx.fillText(`aulas entre ${firstDate} e ${lastDate}.`, 360, 282);

  // Total Badge
  ctx.fillStyle = '#7c6265';
  ctx.fillRect(145, 315, 430, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`Valor total: R$ ${group.total}`, 360, 357);

  // Custom Closing Message from Ajustes
  ctx.fillStyle = '#222222';
  ctx.font = '25px sans-serif';
  const msgLines = state.settings.fechamento_msg.split('\n');
  msgLines.forEach((line, i) => ctx.fillText(line, 360, 430 + i * 34));

  // Itemized Rows
  const dotColors = {
    attended: '#28a745',
    unexcused: '#dc3545',
    excused: '#007bff',
    avulsa: '#8e44ad'
  };

  group.items.forEach((it, idx) => {
    const y = 530 + idx * 50;
    ctx.beginPath();
    ctx.arc(115, y - 9, 14, 0, Math.PI * 2);
    ctx.fillStyle = dotColors[it.status] || '#888';
    ctx.fill();
    ctx.fillStyle = '#222222';
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(formatDateBR(it.date), 165, y);
    ctx.textAlign = 'right';
    ctx.fillText(it.amount > 0 ? `R$ ${it.amount}` : '0', 610, y);
  });

  // Share PNG via Web Share API (opens WhatsApp directly on mobile)
  canvas.toBlob(async (blob) => {
    const file = new File([blob], `fechamento-${group.name}.png`, { type: 'image/png' });
    const textSummary = `Olá ${group.name}, segue o fechamento: Valor total R$ ${group.total}. ${state.settings.fechamento_msg}`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: textSummary });
    } else {
      const cleanPhone = (group.phone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone ? '55' + cleanPhone : ''}?text=${encodeURIComponent(textSummary)}`;
      window.open(waUrl, '_blank');
    }
  }, 'image/png');
}

// ============================================================================
// 9. AJUSTES (SETTINGS)
// ============================================================================
function syncAjustesUI() {
  document.getElementById('set-default-rate').value = state.settings.default_price;
  document.getElementById('set-duration-btn').textContent = state.settings.class_duration;
  document.getElementById('set-weekends').checked = state.settings.show_weekends;
  document.getElementById('set-trainer-name').value = state.settings.trainer_name;
}

async function saveSettings(partial) {
  state.settings = { ...state.settings, ...partial };
  await sb.from('trainer_settings').upsert({ id: 1, ...state.settings });
}

function setupAjustesControls() {
  document.getElementById('set-default-rate').addEventListener('change', (e) => {
    saveSettings({ default_price: Number(e.target.value) });
  });

  document.getElementById('set-duration-btn').addEventListener('click', (e) => {
    const next = Number(state.settings.class_duration) === 60 ? 45 : 60;
    e.target.textContent = next;
    saveSettings({ class_duration: next });
    renderAgendaTimeline();
  });

  document.getElementById('set-weekends').addEventListener('change', (e) => {
    saveSettings({ show_weekends: e.target.checked });
    renderCalendar();
    renderClientesList();
  });

  document.getElementById('set-trainer-name').addEventListener('change', (e) => {
    saveSettings({ trainer_name: e.target.value.trim() });
  });

  // Message Editors
  const modal = document.getElementById('msg-modal');
  const textarea = document.getElementById('msg-modal-textarea');

  document.getElementById('btn-edit-msg-fechamento').addEventListener('click', () => {
    state.activeMsgKey = 'fechamento_msg';
    document.getElementById('msg-modal-title').textContent = 'Texto Fechamento';
    textarea.value = state.settings.fechamento_msg;
    modal.classList.remove('hidden');
  });

  document.getElementById('btn-edit-msg-aniversario').addEventListener('click', () => {
    state.activeMsgKey = 'birthday_msg';
    document.getElementById('msg-modal-title').textContent = 'Texto Aniversários';
    textarea.value = state.settings.birthday_msg;
    modal.classList.remove('hidden');
  });

  document.getElementById('btn-close-msg-modal').addEventListener('click', () => modal.classList.add('hidden'));

  document.getElementById('btn-save-msg-modal').addEventListener('click', () => {
    if (state.activeMsgKey) saveSettings({ [state.activeMsgKey]: textarea.value });
    modal.classList.add('hidden');
  });
}

// Start App
initApp();
