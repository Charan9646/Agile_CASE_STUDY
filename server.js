const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');

async function ensureDataFile() {
  try {
    if (!fsSync.existsSync(DATA_DIR)) await fs.mkdir(DATA_DIR);
    if (!fsSync.existsSync(APPOINTMENTS_FILE)) {
      await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Failed to ensure data file:', err);
  }
}

async function readAppointments() {
  try {
    await ensureDataFile();
    const txt = await fs.readFile(APPOINTMENTS_FILE, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (err) {
    console.error('readAppointments error', err);
    return [];
  }
}

async function writeAppointments(arr) {
  try {
    await ensureDataFile();
    await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify(arr, null, 2), 'utf8');
  } catch (err) {
    console.error('writeAppointments error', err);
  }
}

app.use(express.json());
// Serve static files from current directory (project root)
app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// GET /api/appointments -> return appointments scheduled within next 3 days (from now)
app.get('/api/appointments', async (req, res) => {
  const list = await readAppointments();
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const filtered = list.filter(item => {
    try {
      const t = new Date(item.time);
      return t >= now && t <= threeDays;
    } catch (e) {
      return false;
    }
  }).map(item => ({
    doctorName: item.doctorName || 'Assigned Doctor',
    patientName: item.patientName,
    time: item.time
  }));
  res.json(filtered);
});

// POST /api/bookings -> create a booking; server assigns a doctor (simple map)
app.post('/api/bookings', async (req, res) => {
  const body = req.body || {};
  const required = ['patientName','time','email','specialty'];
  for (const r of required) {
    if (!body[r]) return res.status(400).send(`Missing field: ${r}`);
  }

  const doctorsBySpecialty = {
    'General Physician': 'Dr. Amit Patel',
    'Pediatrician': 'Dr. Neha Sharma',
    'Dermatologist': 'Dr. Imran Khan',
    'Cardiologist': 'Dr. Suresh Rao',
    'Gynecologist': 'Dr. Priya Iyer',
    'Orthopedist': 'Dr. Rohit Verma',
    'Neurologist': 'Dr. Shalini Das',
    'ENT Specialist': 'Dr. Aman Kaur',
    'Ophthalmologist': 'Dr. Arjun Nair',
    'Endocrinologist': 'Dr. Neeta Gupta',
    'Dentist': 'Dr. Vikram Singh',
    'Pulmonologist': 'Dr. Sameer Malhotra',
    'Gastroenterologist': 'Dr. Kavita Rao',
    'Urologist': 'Dr. Rakesh Mehra',
    'Nephrologist': 'Dr. Anjali Bhatia'
  };

  let assignedDoctor = doctorsBySpecialty[body.specialty] || 'Dr. TeleCare';

  const appointments = await readAppointments();
  const newItem = {
    id: Date.now(),
    patientName: body.patientName,
    email: body.email,
    specialty: body.specialty,
    time: body.time,
    conditions: body.conditions || [],
    createdAt: new Date().toISOString(),
    doctorName: assignedDoctor
  };
  appointments.push(newItem);
  await writeAppointments(appointments);

  res.status(201).json(newItem);
});

// fallback to index.html for all other routes (single page)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
