/* ============================================================
   IGOLLOS BARBER -- app.js
   ============================================================ */

const API = 'https://ig-603241006026.europe-west1.run.app';

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  const icons = { success: 'OK', error: 'X', info: 'i' };
  document.getElementById('toastIcon').textContent = icons[type] || 'i';
  document.getElementById('toastMsg').textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

function showAlert(elId, msg, type = 'info') {
  const el = document.getElementById(elId);
  if (!el) return;
  const bg = type === 'error' ? 'rgba(229,57,53,.1)' : type === 'success' ? 'rgba(76,175,80,.1)' : 'rgba(212,175,55,.1)';
  const border = type === 'error' ? 'rgba(229,57,53,.4)' : type === 'success' ? 'rgba(76,175,80,.4)' : 'rgba(212,175,55,.4)';
  const color = type === 'error' ? '#e57373' : type === 'success' ? '#81c784' : 'var(--gold)';
  el.innerHTML = `<div class="alert alert-${type}" style="padding:1rem;border-radius:4px;margin-bottom:1rem;background:${bg};border:1px solid ${border};color:${color}">${msg}</div>`;
}

function clearAlert(elId) { 
  const el = document.getElementById(elId); 
  if (el) el.innerHTML = ''; 
}

function colorIndex(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 8;
}

function initNavbar() {
  const nb = document.getElementById('navbar');
  if (!nb) return;
  const onScroll = () => nb.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === currentPage) a.classList.add('active');
  });
  
  const ham = document.getElementById('hamburger');
  const links = document.getElementById('navLinks');
  if (ham && links) {
    ham.addEventListener('click', () => { 
      ham.classList.toggle('open'); 
      links.classList.toggle('open'); 
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { 
      ham.classList.remove('open'); 
      links.classList.remove('open'); 
    }));
  }
}

function initScrollReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { 
      if (e.isIntersecting) { 
        e.target.classList.add('visible'); 
        io.unobserve(e.target); 
      } 
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-up').forEach(el => io.observe(el));
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function formatDate(str) {
  const [y, m, d] = str.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10)-1]} ${y}`;
}

function initReservas() {
  const form = document.getElementById('bookingForm');
  if (!form) return;
  
  const dateInput = document.getElementById('date');
  const today = todayStr();
  dateInput.min = today;
  
  const maxDate = new Date(); 
  maxDate.setDate(maxDate.getDate() + 30);
  dateInput.max = maxDate.toISOString().split('T')[0];
  
  loadScheduleSidebar();
  loadPublicBookings();
  
  dateInput.addEventListener('change', () => { 
    if (dateInput.value) loadTimeSlots(dateInput.value); 
  });
  
  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert('bookingAlert');
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const service = document.getElementById('service').value;
    const date = dateInput.value;
    const time = document.getElementById('time').value;
    const notes = document.getElementById('notes').value.trim();
    
    if (!name || !email || !service || !date || !time) {
      showAlert('bookingAlert', 'Por favor completa todos los campos obligatorios.', 'error'); 
      return;
    }
    
    const btn = document.getElementById('submitBtn');
    btn.innerHTML = '<span class="spinner"></span> Reservando...';
    btn.disabled = true;
    
    try {
      const res = await fetch(`${API}/api/bookings`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, service, date, time, notes })
      });
      const data = await res.json();
      
      if (res.ok) {
        showAlert('bookingAlert', `Reserva confirmada! Te esperamos el ${formatDate(date)} a las ${time}.`, 'success');
        form.reset();
        document.getElementById('time').innerHTML = '<option value="">Selecciona una hora...</option>';
        loadPublicBookings();
        showToast('Reserva realizada con exito!', 'success');
      } else {
        showAlert('bookingAlert', data.error || 'No se pudo completar la reserva.', 'error');
      }
    } catch (err) {
      console.error('Error al reservar:', err);
      showAlert('bookingAlert', 'Error de conexion. Asegurate de que el servidor esta activo.', 'error');
    } finally {
      btn.innerHTML = 'Confirmar Reserva'; 
      btn.disabled = false;
    }
  });
}

async function loadTimeSlots(date) {
  const sel = document.getElementById('time');
  sel.innerHTML = '<option value="">Cargando horarios...</option>';
  try {
    const res = await fetch(`${API}/api/schedule?date=${date}`);
    if (!res.ok) throw new Error('Error en respuesta de red');
    const data = await res.json();
    const slots = data.slots || [];
    
    if (slots.length === 0) {
      sel.innerHTML = '<option value="">No hay horarios disponibles</option>';
    } else {
      sel.innerHTML = '<option value="">Selecciona una hora...</option>' +
        slots.map(s => `<option value="${s.time}" ${s.booked ? 'disabled' : ''}>${s.time}${s.booked ? ' (ocupado)' : ''}</option>`).join('');
    }
  } catch (err) { 
    console.error('Error cargando horarios:', err);
    sel.innerHTML = '<option value="">Error al cargar horarios</option>'; 
  }
}

async function loadScheduleSidebar() {
  const el = document.getElementById('hoursList');
  if (!el) return;
  try {
    const res = await fetch(`${API}/api/schedule`);
    if (!res.ok) throw new Error('Error en respuesta de red');
    const data = await res.json();
    const days = data.schedule || [];
    const dayNames = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
    
    el.innerHTML = days.map(d =>
      `<li><span class="day">${dayNames[d.dayIndex] || d.day}</span><span class="${d.open ? 'time' : 'closed'}">${d.open ? `${d.start} - ${d.end}` : 'Cerrado'}</span></li>`
    ).join('');
  } catch (err) { 
    console.error('Error cargando panel de horarios:', err);
    el.innerHTML = '<li><span class="day">No disponible</span></li>'; 
  }
}

async function loadPublicBookings() {
  const chipsEl = document.getElementById('bookingChips');
  const todayEl = document.getElementById('todayBookings');
  if (!chipsEl && !todayEl) return;
  
  try {
    const res = await fetch(`${API}/api/bookings`);
    if (!res.ok) throw new Error('Error en respuesta de red');
    const data = await res.json();
    const bookings = (data.bookings || []).filter(b => b.status !== 'cancelled');
    const today = todayStr();
    
    if (todayEl) {
      const todayList = bookings.filter(b => b.date === today);
      if (todayList.length === 0) {
        todayEl.innerHTML = '<p style="text-align:center;font-size:.85rem;color:var(--grey);padding:.5rem">Sin reservas hoy</p>';
      } else {
        todayEl.innerHTML = todayList.sort((a,b) => a.time.localeCompare(b.time)).map(b =>
          `<div style="padding:.6rem 0;border-bottom:1px solid var(--black-border);display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:.85rem;color:var(--white)">${escHtml(b.name)}</div><div style="font-size:.75rem;color:var(--grey)">${escHtml(b.service.split(' -')[0])}</div></div><span style="font-size:.8rem;color:var(--gold);font-weight:600">${b.time}</span></div>`
        ).join('');
      }
    }
    
    if (chipsEl) {
      const upcoming = bookings.filter(b => b.date >= today).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      if (upcoming.length === 0) {
        chipsEl.innerHTML = '<div class="empty-state"><span class="empty-icon">Cal</span><p>No hay reservas proximas</p></div>';
      } else {
        chipsEl.innerHTML = upcoming.map(b => {
          const ci = colorIndex(b.name);
          return `<span class="booking-chip color-${ci}" title="${escHtml(b.service)} - ${formatDate(b.date)} ${b.time}">${escHtml(b.name)} - ${b.time} ${formatDate(b.date).slice(0,6)}</span>`;
        }).join('');
      }
    }
  } catch (err) { 
    console.error('Error cargando reservas publicas:', err);
    if (chipsEl) chipsEl.innerHTML = '<div style="color:var(--grey);font-size:.85rem;text-align:center">Servidor no disponible</div>'; 
  }
}

const ADMIN_KEY = 'igollos_admin_token';

function initAdmin() {
  const loginScreen = document.getElementById('loginScreen');
  if (!loginScreen) return;
  
  if (sessionStorage.getItem(ADMIN_KEY)) showAdminPanel();
  
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pass = document.getElementById('adminPass').value;
    clearAlert('loginAlert');
    
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
      const data = await res.json();
      
      if (res.ok && data.token) { 
        sessionStorage.setItem(ADMIN_KEY, data.token); 
        showAdminPanel(); 
      } else {
        showAlert('loginAlert', 'Contrasena incorrecta.', 'error');
      }
    } catch (err) { 
      console.error('Error en login:', err);
      showAlert('loginAlert', 'Error de conexion con el servidor.', 'error'); 
    }
  });
  
  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_KEY);
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPass').value = '';
  });
}

function showAdminPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  initAdminPanel();
}

function getToken() { return sessionStorage.getItem(ADMIN_KEY) || ''; }
function authHeaders() { return { 'Content-Type': 'application/json', 'x-admin-token': getToken() }; }

let allBookings = [], currentFilter = 'all', filterDate = '';

async function initAdminPanel() {
  await loadAdminBookings();
  await loadAdminSchedule();
  await loadAdminConfig();
  initAdminTabs();
  initFilterButtons();
  initScheduleSave();
  initConfigSave();
  document.getElementById('filterDate').addEventListener('change', e => { 
    filterDate = e.target.value; 
    renderBookingsTable(); 
  });
}

function initAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const sections = document.querySelectorAll('.admin-section');
  
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function initFilterButtons() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); 
      currentFilter = btn.dataset.filter; 
      renderBookingsTable();
    });
  });
}

async function loadAdminBookings() {
  try {
    const res = await fetch(`${API}/api/bookings`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error obteniendo reservas de admin');
    const data = await res.json();
    allBookings = data.bookings || [];
    updateSummaryCards(); 
    renderBookingsTable();
  } catch (err) {
    console.error(err);
    document.getElementById('bookingsTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--grey)">Error al cargar reservas</td></tr>';
  }
}

function updateSummaryCards() {
  const today = todayStr();
  document.getElementById('totalCount').textContent = allBookings.length;
  document.getElementById('todayCount').textContent = allBookings.filter(b => b.date === today).length;
  document.getElementById('pendingCount').textContent = allBookings.filter(b => b.status === 'pending').length;
  document.getElementById('confirmedCount').textContent = allBookings.filter(b => b.status === 'confirmed').length;
}

function renderBookingsTable() {
  const tbody = document.getElementById('bookingsTableBody');
  let filtered = allBookings;
  
  if (currentFilter !== 'all') filtered = filtered.filter(b => b.status === currentFilter);
  if (filterDate) filtered = filtered.filter(b => b.date === filterDate);
  
  filtered.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  
  if (filtered.length === 0) { 
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:3rem;color:var(--grey)">No hay reservas con estos filtros</td></tr>'; 
    return; 
  }
  
  const statusBadge = s => { 
    const map = { pending: 'badge-pending', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled' }; 
    const labels = { pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada' }; 
    return `<span class="badge ${map[s]||'badge-pending'}">${labels[s]||s}</span>`; 
  };
  
  tbody.innerHTML = filtered.map(b => `
    <tr data-id="${b.id}">
      <td style="font-weight:500">${escHtml(b.name)}</td>
      <td style="font-size:.82rem;color:var(--grey)">${escHtml(b.email)}</td>
      <td style="font-size:.85rem">${escHtml(b.service.split(' -')[0])}</td>
      <td>${formatDate(b.date)}</td>
      <td style="color:var(--gold);font-weight:600">${b.time}</td>
      <td>${statusBadge(b.status)}</td>
      <td style="font-size:.8rem;color:var(--grey);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(b.notes || '')}">${b.notes ? escHtml(b.notes) : '-'}</td>
      <td>
        ${b.status !== 'confirmed' && b.status !== 'cancelled' ? `<button class="btn-confirm" onclick="updateBookingStatus('${b.id}','confirmed')">OK</button>` : ''}
        ${b.status !== 'cancelled' ? `<button class="btn-delete" onclick="updateBookingStatus('${b.id}','cancelled')">X</button>` : ''}
        <button class="btn-delete" onclick="deleteBooking('${b.id}')" style="margin-left:.3rem;border-color:rgba(229,57,53,.7)">Del</button>
      </td>
    </tr>`
  ).join('');
}

function escHtml(str) { 
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); 
}

async function updateBookingStatus(id, status) {
  try {
    const res = await fetch(`${API}/api/bookings/${id}`, { 
      method: 'PATCH', 
      headers: authHeaders(), 
      body: JSON.stringify({ status }) 
    });
    if (res.ok) { 
      showToast(status === 'confirmed' ? 'Reserva confirmada' : 'Reserva cancelada', 'success'); 
      await loadAdminBookings(); 
    } else {
      throw new Error('Error del servidor');
    }
  } catch (err) { 
    console.error(err);
    showToast('Error al actualizar', 'error'); 
  }
}

async function deleteBooking(id) {
  if (!confirm('Eliminar esta reserva definitivamente?')) return;
  try {
    const res = await fetch(`${API}/api/bookings/${id}`, { 
      method: 'DELETE', 
      headers: authHeaders() 
    });
    if (res.ok) { 
      showToast('Reserva eliminada', 'info'); 
      await loadAdminBookings(); 
    } else {
      throw new Error('Error del servidor');
    }
  } catch (err) { 
    console.error(err);
    showToast('Error al eliminar', 'error'); 
  }
}

let scheduleData = [];

async function loadAdminSchedule() {
  try {
    const res = await fetch(`${API}/api/schedule`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error cargando horarios de admin');
    const data = await res.json();
    scheduleData = data.schedule || getDefaultSchedule();
    renderScheduleGrid();
  } catch (err) { 
    console.error(err);
    scheduleData = getDefaultSchedule(); 
    renderScheduleGrid(); 
  }
}

function getDefaultSchedule() {
  return [
    { day:'Lunes', dayIndex:1, open:true, start:'09:00', end:'20:00' },
    { day:'Martes', dayIndex:2, open:true, start:'09:00', end:'20:00' },
    { day:'Miercoles', dayIndex:3, open:true, start:'09:00', end:'20:00' },
    { day:'Jueves', dayIndex:4, open:true, start:'09:00', end:'20:00' },
    { day:'Viernes', dayIndex:5, open:true, start:'09:00', end:'20:00' },
    { day:'Sabado', dayIndex:6, open:true, start:'10:00', end:'15:00' },
    { day:'Domingo', dayIndex:0, open:false, start:'10:00', end:'14:00' },
  ];
}

function renderScheduleGrid() {
  const grid = document.getElementById('scheduleGrid');
  if (!grid) return;
  grid.innerHTML = scheduleData.map((d, i) => `
    <div class="schedule-day-card">
      <div class="day-name">${d.day}</div>
      <div class="day-toggle">
        <label class="toggle-switch">
          <input type="checkbox" id="open_${i}" ${d.open ? 'checked' : ''} onchange="toggleDay(${i})">
          <span class="toggle-slider"></span>
        </label>
        <span style="font-size:.85rem;color:var(--white-soft)">${d.open ? 'Abierto' : 'Cerrado'}</span>
      </div>
      <div class="day-hours" id="hours_${i}" style="${d.open ? '' : 'opacity:.4;pointer-events:none'}">
        <div><label>Apertura</label><input type="time" id="start_${i}" value="${d.start}"></div>
        <div><label>Cierre</label><input type="time" id="end_${i}" value="${d.end}"></div>
      </div>
    </div>`
  ).join('');
}

window.toggleDay = function(i) {
  const cb = document.getElementById(`open_${i}`);
  const hours = document.getElementById(`hours_${i}`);
  const label = cb.parentElement.nextElementSibling;
  scheduleData[i].open = cb.checked;
  hours.style.opacity = cb.checked ? '' : '.4';
  hours.style.pointerEvents = cb.checked ? '' : 'none';
  label.textContent = cb.checked ? 'Abierto' : 'Cerrado';
};

function initScheduleSave() {
  const btn = document.getElementById('saveScheduleBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    scheduleData.forEach((d, i) => {
      d.open = document.getElementById(`open_${i}`)?.checked ?? d.open;
      d.start = document.getElementById(`start_${i}`)?.value ?? d.start;
      d.end = document.getElementById(`end_${i}`)?.value ?? d.end;
    });
    try {
      const res = await fetch(`${API}/api/schedule`, { 
        method: 'POST', 
        headers: authHeaders(), 
        body: JSON.stringify({ schedule: scheduleData }) 
      });
      if (res.ok) showToast('Horarios guardados correctamente', 'success');
      else throw new Error('Fallo al guardar');
    } catch (err) { 
      console.error(err);
      showToast('Error al guardar horarios', 'error'); 
    }
  });
}

async function loadAdminConfig() {
  try {
    const res = await fetch(`${API}/api/config`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al cargar config');
    const data = await res.json();
    if (data.slotDuration) document.getElementById('slotDuration').value = data.slotDuration;
    if (data.maxDaysAhead) document.getElementById('maxDaysAhead').value = data.maxDaysAhead;
    if (data.minNotice) document.getElementById('minNotice').value = data.minNotice;
  } catch (err) {
    console.error('Configuración no cargada:', err);
  }
}

function initConfigSave() {
  const btn = document.getElementById('saveConfigBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const slotDuration = parseInt(document.getElementById('slotDuration').value, 10) || 30;
    const maxDaysAhead = parseInt(document.getElementById('maxDaysAhead').value, 10) || 30;
    const minNotice = parseInt(document.getElementById('minNotice').value, 10) || 60;
    const newPassword = document.getElementById('newPassword').value;
    
    const payload = { slotDuration, maxDaysAhead, minNotice };
    if (newPassword) payload.newPassword = newPassword;
    
    try {
      const res = await fetch(`${API}/api/config`, { 
        method: 'POST', 
        headers: authHeaders(), 
        body: JSON.stringify(payload) 
      });
      if (res.ok) { 
        showToast('Configuracion guardada', 'success'); 
        document.getElementById('newPassword').value = ''; 
      } else {
        throw new Error('Fallo al guardar config');
      }
    } catch (err) { 
      console.error(err);
      showToast('Error al guardar configuracion', 'error'); 
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollReveal();
  initReservas();
  initAdmin();
});
