import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { interpretLocal } from './interpret.js'
import { sendTelegram } from './telegram.js'
import {
  getMedicines,
  addMedicine,
  deleteMedicine,
  getLogs,
  addLog,
} from './store.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

// POST /api/interpret
app.post('/api/interpret', (req, res) => {
  const { transcript } = req.body || {}
  if (typeof transcript !== 'string') {
    return res.status(400).json({ error: 'transcript is required and must be a string' })
  }
  const result = interpretLocal(transcript)
  res.json(result)
})

// POST /api/alert
app.post('/api/alert', async (req, res) => {
  const { message } = req.body || {}
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' })
  }
  const ok = await sendTelegram(message.trim())
  res.json({ ok })
})

// GET /api/medicines
app.get('/api/medicines', (req, res) => {
  res.json(getMedicines())
})

// POST /api/medicines
app.post('/api/medicines', (req, res) => {
  const { name, time, note } = req.body || {}
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }
  if (!time || typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())) {
    return res.status(400).json({ error: 'time is required and must be in HH:MM format' })
  }
  const created = addMedicine({
    name: name.trim(),
    time: time.trim(),
    note: typeof note === 'string' ? note.trim() : '',
  })
  res.status(201).json(created)
})

// DELETE /api/medicines/:id
app.delete('/api/medicines/:id', (req, res) => {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: 'id must be a number' })
  }
  deleteMedicine(id)
  res.json({ ok: true })
})

// GET /api/logs
app.get('/api/logs', (req, res) => {
  res.json(getLogs())
})

// POST /api/logs
app.post('/api/logs', (req, res) => {
  const { medicine, status } = req.body || {}
  if (!medicine || typeof medicine !== 'string' || !medicine.trim()) {
    return res.status(400).json({ error: 'medicine is required' })
  }
  const VALID_STATUSES = ['taken', 'missed', 'skipped', 'unwell', 'help', 'snoozed']
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    })
  }
  const created = addLog({
    medicine: medicine.trim(),
    status,
  })
  res.status(201).json(created)
})

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
