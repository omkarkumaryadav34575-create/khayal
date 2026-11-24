// server/store.js
let nextId = Date.now()

export function generateId() {
  return nextId++
}

// Seed medicines from section 9
export const medicines = [
  {
    id: generateId(),
    name: 'BP tablet',
    time: '08:00',
    note: 'The small white one, after breakfast',
  },
  {
    id: generateId(),
    name: 'Sugar tablet',
    time: '14:00',
    note: 'After lunch',
  },
  {
    id: generateId(),
    name: 'Vitamin D',
    time: '20:00',
    note: 'With dinner',
  },
]

// Seed 14 logs spread over last 6 days (mostly taken, with 1 missed, 1 skipped, 1 snoozed)
const now = Date.now()
const hour = 3600 * 1000

const seedLogsData = [
  { hoursAgo: 132, medicine: 'BP tablet', status: 'taken' },
  { hoursAgo: 126, medicine: 'Sugar tablet', status: 'taken' },
  { hoursAgo: 120, medicine: 'Vitamin D', status: 'taken' },
  { hoursAgo: 108, medicine: 'BP tablet', status: 'taken' },
  { hoursAgo: 102, medicine: 'Sugar tablet', status: 'taken' },
  { hoursAgo: 96, medicine: 'Vitamin D', status: 'taken' },
  { hoursAgo: 84, medicine: 'BP tablet', status: 'snoozed' },
  { hoursAgo: 83, medicine: 'BP tablet', status: 'taken' },
  { hoursAgo: 78, medicine: 'Sugar tablet', status: 'taken' },
  { hoursAgo: 60, medicine: 'BP tablet', status: 'taken' },
  { hoursAgo: 54, medicine: 'Sugar tablet', status: 'skipped' },
  { hoursAgo: 36, medicine: 'BP tablet', status: 'taken' },
  { hoursAgo: 30, medicine: 'Sugar tablet', status: 'missed' },
  { hoursAgo: 24, medicine: 'Vitamin D', status: 'taken' },
]

export const logs = seedLogsData.map((item) => ({
  id: generateId(),
  at: new Date(now - item.hoursAgo * hour).toISOString(),
  medicine: item.medicine,
  status: item.status,
}))

export function getMedicines() {
  return medicines
}

export function addMedicine({ name, time, note = '' }) {
  const medicine = {
    id: generateId(),
    name,
    time,
    note,
  }
  medicines.push(medicine)
  return medicine
}

export function deleteMedicine(id) {
  const numId = Number(id)
  const index = medicines.findIndex((m) => m.id === numId)
  if (index !== -1) {
    medicines.splice(index, 1)
    return true
  }
  return false
}

export function getLogs() {
  // Newest first
  return [...logs].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function addLog({ medicine, status }) {
  const log = {
    id: generateId(),
    at: new Date().toISOString(),
    medicine,
    status,
  }
  logs.push(log)
  return log
}
