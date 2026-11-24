// client/src/Dashboard.jsx
// Family dashboard – stats, activity log, medicine list, and add‑medicine form.

import { useState, useEffect } from 'react'
import { medicineNames } from './medicineNames.js'

// Helper to format a Date string like "8:05 AM"
function formatTime(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch (e) {
    return iso
  }
}

export default function Dashboard() {
  // ----- data -----
  const [logs, setLogs] = useState([]) // newest first
  const [medicines, setMeds] = useState([])
  const [error, setError] = useState('') // generic banner error

  // ----- fetch helpers (all wrapped in try/catch) -----
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs')
      const data = await res.json()
      // server returns newest‑first already, but ensure ordering
      setLogs(data)
      setError('')
    } catch (e) {
      setError('Unable to load alerts – server may be offline.')
    }
  }

  const fetchMeds = async () => {
    try {
      const res = await fetch('/api/medicines')
      const data = await res.json()
      setMeds(data)
      setError('')
    } catch (e) {
      setError('Unable to load medicines – server may be offline.')
    }
  }

  // ----- initial load & polling -----
  useEffect(() => {
    fetchLogs()
    fetchMeds()
    const logInterval = setInterval(fetchLogs, 3000) // refresh logs every 3 s
    const medInterval = setInterval(fetchMeds, 5000) // refresh medicines every 5 s
    return () => {
      clearInterval(logInterval)
      clearInterval(medInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- stats calculation -----
  const dosesLogged = logs.filter((l) => l.status !== 'snoozed').length
  const takenCount = logs.filter((l) => l.status === 'taken').length
  const adherence = dosesLogged === 0 ? 0 : Math.round((takenCount / dosesLogged) * 100)

  // ----- status chip rendering -----
  const statusInfo = {
    taken: { icon: '✅', label: 'Taken', color: 'green-600' },
    snoozed: { icon: '💤', label: 'Snoozed', color: 'amber-600' },
    skipped: { icon: '⏭️', label: 'Skipped', color: 'yellow-600' },
    missed: { icon: '❌', label: 'Missed', color: 'red-600' },
    unwell: { icon: '🤒', label: 'Unwell', color: 'orange-600' },
    help: { icon: '🚨', label: 'Help', color: 'red-600' },
  }

  const chip = (status) => {
    const info = statusInfo[status] || { icon: '❓', label: status, color: 'gray-600' }
    // glow for unwell / help
    const glow = status === 'unwell' || status === 'help' ? 'ring-2 ring-orange-400' : ''
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-sm font-medium rounded ${glow}`}
        style={{ backgroundColor: `var(--tw-bg-opacity, 0.1)`, color: `var(--tw-text-${info.color})` }}
      >
        <span>{info.icon}</span>
        <span>{info.label}</span>
      </span>
    )
  }

  // ----- medicine delete -----
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this medicine?')) return
    try {
      await fetch(`/api/medicines/${id}`, { method: 'DELETE' })
      // refresh list locally
      setMeds((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setError('Failed to delete medicine.')
    }
  }

  // ----- add‑medicine form -----
  const [newMed, setNewMed] = useState({ name: '', time: '', note: '' })
  const [formErr, setFormErr] = useState({})

  const handleAdd = async () => {
    const err = {}
    if (!newMed.name.trim()) err.name = 'Name required'
    if (!newMed.time) err.time = 'Time required'
    setFormErr(err)
    if (Object.keys(err).length) return
    try {
      await fetch('/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMed.name, time: newMed.time, note: newMed.note }),
      })
      // clear form & refresh list
      setNewMed({ name: '', time: '', note: '' })
      fetchMeds()
    } catch (e) {
      setError('Failed to add medicine.')
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6 w-full">
      {/* Header with Mascot */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-line p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src="/mascot.png"
            alt="Mascot"
            className="w-16 h-16 object-contain mascot-float drop-shadow-sm cursor-pointer hover:scale-105 transition-transform"
            title="Khayal is caring for your family!"
          />
          <div>
            <h1 className="text-2xl font-black text-brand tracking-tight flex items-center gap-2">
              Family Care Dashboard <span className="text-xs bg-brand-soft text-brand px-2.5 py-0.5 rounded-full font-bold border border-brand/20">Live</span>
            </h1>
            <p className="text-muted text-sm">
              Real-time medicine logs, elder adherence, and emergency safety status.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live Polling Active</span>
        </div>
      </div>

      {/* banner for any fetch error */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-2xl shadow-sm">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-line flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-muted mb-1">Doses Logged</h2>
            <p className="text-3xl font-extrabold text-ink">{dosesLogged}</p>
          </div>
          <span className="text-3xl p-3 bg-cream rounded-2xl border border-line">💊</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-line flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-muted mb-1">Taken Successfully</h2>
            <p className="text-3xl font-extrabold text-emerald-700">{takenCount}</p>
          </div>
          <span className="text-3xl p-3 bg-emerald-50 rounded-2xl border border-emerald-100">✅</span>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-line flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-muted mb-1">Adherence Rate</h2>
            <p className="text-3xl font-extrabold text-brand">{adherence}%</p>
          </div>
          <span className="text-3xl p-3 bg-teal-50 rounded-2xl border border-teal-100">❤️</span>
        </div>
      </div>

      {/* Live activity list */}
      <section className="bg-white rounded-3xl border border-line p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-brand flex items-center gap-2">
            <span>📋</span> Recent Activity Log
          </h3>
          <span className="text-xs text-muted font-medium">Refreshed every 3s</span>
        </div>
        {logs.length === 0 ? (
          <p className="text-muted italic py-4 text-center">No activity logged yet.</p>
        ) : (
          <ul className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {logs.map((log) => (
              <li
                key={log.id}
                className={`border border-line rounded-2xl p-3.5 flex items-center justify-between transition-all hover:bg-cream/50 ${
                  log.status === 'unwell' || log.status === 'help' ? 'ring-2 ring-orange-400 bg-orange-50/50' : 'bg-white'
                }`}
              >
                <div className="flex-1">
                  <div className="text-xs font-semibold text-muted">{formatTime(log.at)}</div>
                  <div className="font-bold text-ink text-base">{log.medicine}</div>
                </div>
                <div>{chip(log.status)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Medicine list */}
      <section className="bg-white rounded-3xl border border-line p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-bold text-brand flex items-center gap-2">
          <span>⏰</span> Daily Medicine Schedule
        </h3>
        {medicines.length === 0 ? (
          <p className="text-muted italic py-4 text-center">No medicines configured yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {medicines.map((m) => (
              <li
                key={m.id}
                className="border border-line rounded-2xl p-4 flex items-center justify-between hover:bg-cream/40 transition-all bg-white"
              >
                <div className="flex-1">
                  <div className="inline-block bg-brand-soft text-brand font-bold text-xs px-2.5 py-0.5 rounded-full mb-1">
                    {m.time}
                  </div>
                  <div className="font-bold text-ink text-lg">{m.name}</div>
                  {m.note && <div className="text-sm text-muted mt-0.5">{m.note}</div>}
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl font-semibold text-sm transition-all cursor-pointer"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add‑medicine form */}
      <section className="bg-white rounded-3xl border border-line p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-bold text-brand flex items-center gap-2">
          <span>➕</span> Add New Medicine
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-muted mb-1.5">Medicine Name *</label>
            <input
              type="text"
              list="medicine-suggestions"
              value={newMed.name}
              onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
              placeholder="e.g. Metformin"
              className="w-full border border-line rounded-xl px-3 py-2.5 focus:border-brand outline-none transition-all"
            />
            <datalist id="medicine-suggestions">
              {medicineNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {formErr.name && <p className="text-red-600 text-xs mt-1">{formErr.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted mb-1.5">Scheduled Time (24h) *</label>
            <input
              type="time"
              value={newMed.time}
              onChange={(e) => setNewMed({ ...newMed, time: e.target.value })}
              className="w-full border border-line rounded-xl px-3 py-2.5 focus:border-brand outline-none transition-all"
            />
            {formErr.time && <p className="text-red-600 text-xs mt-1">{formErr.time}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted mb-1.5">Care Note (optional)</label>
            <input
              type="text"
              value={newMed.note}
              onChange={(e) => setNewMed({ ...newMed, note: e.target.value })}
              placeholder="e.g. After breakfast"
              className="w-full border border-line rounded-xl px-3 py-2.5 focus:border-brand outline-none transition-all"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="mt-2 bg-brand text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark shadow-sm transition-all cursor-pointer flex items-center gap-2"
        >
          <span>➕</span> Add Medicine to Schedule
        </button>
      </section>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted text-center max-w-md mx-auto">
        Khayal is a reminder tool, not medical advice. In an emergency, call 112.
      </p>
    </div>
  )
}
