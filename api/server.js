
/*  ============================================================
    IGOLLOS BARBER — api/server.js
    ============================================================ */

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const crypto     = require('crypto');
const path       = require('path');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

const DATA_DIR  = path.join(__dirname, 'data');
const BOOK_FILE = path.join(DATA_DIR, 'bookings.json');
const SCHED_FILE= path.join(DATA_DIR, 'schedule.json');
const CONF_FILE = path.join(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return def; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const DEFAULT_SCHEDULE = [
  { day:'Lunes',     dayIndex:1, open:true,  start:'09:00', end:'20:00' },
  { day:'Martes',    dayIndex:2, open:true,  start:'09:00', end:'20:00' },
  { day:'Miercoles', dayIndex:3, open:true,  start:'09:00', end:'20:00' },
  { day:'Jueves',    dayIndex:4, open:true,  start:'09:00', end:'20:00' },
  { day:'Viernes',   dayIndex:5, open:true,  start:'09:00', end:'20:00' },
  { day:'Sabado',    dayIndex:6, open:true,  start:'10:00', end:'15:00' },
  { day:'Domingo',   dayIndex:0, open:false, start:'10:00', end:'14:00' },
];
const DEFAULT_CONFIG = {
  slotDuration: 30,
  maxDaysAhead: 30,
  minNotice:    60,
  adminPassword: '1234',
  adminToken:    crypto.randomBytes(32).toString('hex')
};

if (!fs.existsSync(BOOK_FILE))  writeJSON(BOOK_FILE,  []);
if (!fs.existsSync(SCHED_FILE)) writeJSON(SCHED_FILE, DEFAULT_SCHEDULE);
if (!fs.existsSync(CONF_FILE))  writeJSON(CONF_FILE,  DEFAULT_CONFIG);

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || '';
  const conf  = readJSON(CONF_FILE, DEFAULT_CONFIG);
  if (token === conf.adminToken) return next();
  res.status(401).json({ error: 'No autorizado' });
}

function uid() { return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'); }

function generateSlots(start, end, duration) {
  const slots = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur < endMin) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    cur += duration;
  }
  return slots;
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const conf = readJSON(CONF_FILE, DEFAULT_CONFIG);
  if (password === conf.adminPassword) {
    res.json({ success: true, token: conf.adminToken });
  } else {
    res.status(401).json({ error: 'Contrasena incorrecta' });
  }
});

app.get('/api/bookings', (req, res) => {
  const bookings = readJSON(BOOK_FILE, []);
  const token = req.headers['x-admin-token'] || '';
  const conf  = readJSON(CONF_FILE, DEFAULT_CONFIG);
  const isAdmin = token === conf.adminToken;
  const sanitized = bookings.map(b => isAdmin ? b : { ...b, email: '***' });
  res.json({ bookings: sanitized });
});

app.post('/api/bookings', (req, res) => {
  const { name, email, service, date, time, notes } = req.body;
  if (!name || !email || !service || !date || !time) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalido' });
  }
  const now = new Date();
  const conf = readJSON(CONF_FILE, DEFAULT_CONFIG);
  const requestedDT = new Date(`${date}T${time}:00`);
  if (requestedDT < new Date(now.getTime() - 60000)) {
    return res.status(400).json({ error: 'No puedes reservar en el pasado' });
  }
  const bookings = readJSON(BOOK_FILE, []);
  const conflict = bookings.find(b => b.date === date && b.time === time && b.status !== 'cancelled');
  if (conflict) {
    return res.status(409).json({ error: 'Ese horario ya esta ocupado. Elige otra hora.' });
  }
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + conf.maxDaysAhead);
  if (new Date(date) > maxDate) {
    return res.status(400).json({ error: `Solo puedes reservar hasta ${conf.maxDaysAhead} dias de antelacion` });
  }
  const booking = {
    id: uid(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    service,
    date,
    time,
    notes: notes ? notes.trim() : '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  bookings.push(booking);
  writeJSON(BOOK_FILE, bookings);
  res.status(201).json({ success: true, booking });
});

app.patch('/api/bookings/:id', requireAdmin, (req, res) => {
  const bookings = readJSON(BOOK_FILE, []);
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Reserva no encontrada' });
  const allowed = ['pending', 'confirmed', 'cancelled'];
  if (req.body.status && allowed.includes(req.body.status)) {
    bookings[idx].status = req.body.status;
  }
  if (req.body.notes !== undefined) bookings[idx].notes = req.body.notes;
  writeJSON(BOOK_FILE, bookings);
  res.json({ success: true, booking: bookings[idx] });
});

app.delete('/api/bookings/:id', requireAdmin, (req, res) => {
  const bookings = readJSON(BOOK_FILE, []);
  const filtered = bookings.filter(b => b.id !== req.params.id);
  if (filtered.length === bookings.length) return res.status(404).json({ error: 'No encontrada' });
  writeJSON(BOOK_FILE, filtered);
  res.json({ success: true });
});

app.get('/api/schedule', (req, res) => {
  const schedule = readJSON(SCHED_FILE, DEFAULT_SCHEDULE);
  const conf     = readJSON(CONF_FILE,  DEFAULT_CONFIG);
  const { date } = req.query;
  if (!date) return res.json({ schedule });
  const d       = new Date(date + 'T12:00:00');
  const dayIdx  = d.getDay();
  const dayConf = schedule.find(s => s.dayIndex === dayIdx);
  if (!dayConf || !dayConf.open) return res.json({ slots: [], message: 'Cerrado ese dia' });
  const bookings  = readJSON(BOOK_FILE, []);
  const dayBooked = bookings.filter(b => b.date === date && b.status !== 'cancelled').map(b => b.time);
  const allSlots  = generateSlots(dayConf.start, dayConf.end, conf.slotDuration);
  const now    = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const minNoticeMs = conf.minNotice * 60 * 1000;
  const slots = allSlots.map(t => {
    let disabled = dayBooked.includes(t);
    if (date === todayStr) {
      const slotTime = new Date(`${date}T${t}:00`);
      if (slotTime.getTime() - now.getTime() < minNoticeMs) disabled = true;
    }
    return { time: t, booked: disabled };
  });
  res.json({ slots, dayConfig: dayConf });
});

app.post('/api/schedule', requireAdmin, (req, res) => {
  const { schedule } = req.body;
  if (!Array.isArray(schedule)) return res.status(400).json({ error: 'Formato invalido' });
  writeJSON(SCHED_FILE, schedule);
  res.json({ success: true });
});

app.get('/api/config', requireAdmin, (req, res) => {
  const conf = readJSON(CONF_FILE, DEFAULT_CONFIG);
  const { adminPassword, adminToken, ...safe } = conf;
  res.json(safe);
});

app.post('/api/config', requireAdmin, (req, res) => {
  const conf = readJSON(CONF_FILE, DEFAULT_CONFIG);
  const { slotDuration, maxDaysAhead, minNotice, newPassword } = req.body;
  if (slotDuration) conf.slotDuration = parseInt(slotDuration);
  if (maxDaysAhead) conf.maxDaysAhead = parseInt(maxDaysAhead);
  if (minNotice !== undefined) conf.minNotice = parseInt(minNotice);
  if (newPassword && newPassword.length >= 4) {
    conf.adminPassword = newPassword;
    conf.adminToken = crypto.randomBytes(32).toString('hex');
  }
  writeJSON(CONF_FILE, conf);
  res.json({ success: true });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Igollos Barber API running on http://localhost:${PORT}`);
  console.log(`Admin password: 1234`);
});
