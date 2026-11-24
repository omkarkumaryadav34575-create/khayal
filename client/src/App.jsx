// client/src/App.jsx
// Real application – Elder screen and Family dashboard with scheduler

import { useState, useEffect, useRef } from 'react'
import Dashboard from './Dashboard.jsx'
import { runReminder } from './reminder.js'
import { voiceSupported, stopAll } from './voice.js'

// constant elder name (section 10)
const ELDER_NAME = 'Dadi ji'

export default function App() {
  // ----- UI state -----
  const [tab, setTab] = useState('elder') // 'elder' | 'dashboard'
  const [started, setStarted] = useState(false)
  const [demo, setDemo] = useState(true) // fast demo timers
  const [lang, setLang] = useState('en-IN')
  const [slowSpeech, setSlowSpeech] = useState(false) // Speak slowly (rate 0.7 vs 0.9)
  const [mascotWiggle, setMascotWiggle] = useState(false)

  const [medicines, setMedicines] = useState([]) // list from server
  const [error, setError] = useState('')

  const [orbClass, setOrbClass] = useState('') // '' | 'orb-speaking' | 'orb-listening'
  const [statusLabel, setStatusLabel] = useState('')
  const [activeMed, setActiveMed] = useState(null) // medicine currently being reminded
  const [nextMedInfo, setNextMedInfo] = useState('')

  const abortCtrlRef = useRef(null)

  // ----- fetch medicines (cached, refreshed every 30s) -----
  useEffect(() => {
    let cancelled = false
    const fetchMeds = async () => {
      try {
        const res = await fetch('/api/medicines')
        const data = await res.json()
        if (!cancelled) setMedicines(data)
      } catch (e) {
        if (!cancelled) setError('Could not load medicines – server may be offline.')
      }
    }
    fetchMeds()
    const interval = setInterval(fetchMeds, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // ----- helper: format next upcoming medicine -----
  useEffect(() => {
    if (!medicines.length) {
      setNextMedInfo('No medicines')
      return
    }
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    // find next medicine time (including today later times)
    let next = null
    let minDiff = Infinity
    for (const m of medicines) {
      const [h, mnt] = m.time.split(':').map(Number)
      const medMinutes = h * 60 + mnt
      let diff = medMinutes - nowMinutes
      if (diff < 0) diff += 24 * 60 // treat as tomorrow
      if (diff < minDiff) {
        minDiff = diff
        next = m
      }
    }
    if (next) {
      setNextMedInfo(`${next.name} at ${next.time}`)
    }
  }, [medicines])

  // ----- scheduler (runs after start) -----
  useEffect(() => {
    if (!started) return
    const firedMap = new Map() // key: medicine.id, value: last HH:MM fired
    const tick = async () => {
      if (abortCtrlRef.current) return // a reminder already running
      const now = new Date()
      const hhmm = now.toTimeString().slice(0, 5) // "HH:MM"
      for (const med of medicines) {
        if (med.time === hhmm) {
          const last = firedMap.get(med.id)
          if (last === hhmm) continue // already fired this minute
          firedMap.set(med.id, hhmm)
          // start reminder for this medicine
          startReminder(med)
          break // only one reminder at a time
        }
      }
    }
    const interval = setInterval(tick, 10_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, medicines, demo, lang, slowSpeech])

  // ----- start a reminder for a given medicine -----
  const startReminder = async (med) => {
    abortCtrlRef.current = new AbortController()
    setActiveMed(med)
    const onStatus = (st) => {
      // map reminder statuses to UI
      switch (st) {
        case 'speaking':
          setOrbClass('orb-speaking')
          setStatusLabel('Speaking…')
          break
        case 'listening':
          setOrbClass('orb-listening')
          setStatusLabel('Listening… please speak')
          break
        case 'thinking':
          setOrbClass('')
          setStatusLabel('Thinking…')
          break
        case 'waiting':
          setOrbClass('')
          setStatusLabel('Waiting…')
          break
        case 'done':
          setOrbClass('')
          setStatusLabel('All done!')
          break
        case 'escalated':
          setOrbClass('')
          setStatusLabel('Alert sent')
          break
        default:
          setOrbClass('')
          setStatusLabel('')
      }
    }
    const result = await runReminder(med, {
      elderName: ELDER_NAME,
      demo,
      lang,
      rate: slowSpeech ? 0.7 : 0.9,
      onStatus,
      signal: abortCtrlRef.current.signal,
    })
    // reminder finished – clear active state
    abortCtrlRef.current = null
    setActiveMed(null)
    setOrbClass('')
    // result already reflected via onStatus, but ensure final label for missed/aborted
    if (result === 'missed') setStatusLabel('Missed – family alerted')
    if (result === 'aborted') setStatusLabel('Reminder aborted')
  }

  // ----- "I took it" button handler -----
  const handleTaken = async () => {
    // abort any running reminder first
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort()
      abortCtrlRef.current = null
    }
    stopAll()
    // determine medicine to log
    let med = activeMed
    if (!med) {
      // pick nearest medicine time to now
      const now = new Date()
      const nowMins = now.getHours() * 60 + now.getMinutes()
      let nearest = null
      let bestDiff = Infinity
      for (const m of medicines) {
        const [h, mi] = m.time.split(':').map(Number)
        const medMins = h * 60 + mi
        let diff = Math.abs(medMins - nowMins)
        if (diff < bestDiff) {
          bestDiff = diff
          nearest = m
        }
      }
      med = nearest
    }
    if (!med) return
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicine: med.name, status: 'taken' }),
      })
    } catch (e) {
      // ignore network errors per spec
    }
    setStatusLabel('All done!')
    setOrbClass('')
    setActiveMed(null)
  }

  // ----- UI -----
  if (!voiceSupported()) {
    // browsers without SpeechRecognition still allow speaking & manual "I took it"
    // keep everything functional
    console.warn('Speech recognition not supported – voice fallback active')
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-cream text-ink">
      {/* Navigation Tabs */}
      <header className="bg-white/80 backdrop-blur-md border-b border-line sticky top-0 z-20 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/mascot.png"
              alt="Khayal Mascot"
              className={`w-11 h-11 object-contain drop-shadow cursor-pointer transition-transform ${
                mascotWiggle ? 'scale-125 rotate-12' : 'hover:scale-110 active:scale-95'
              }`}
              onClick={() => {
                setMascotWiggle(true)
                setTimeout(() => setMascotWiggle(false), 800)
              }}
              title="Click me!"
            />
            <div>
              <span className="text-2xl font-black text-brand tracking-tight flex items-center gap-1.5">
                Khayal <span className="text-sm font-medium text-accent bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">ख्याल</span>
              </span>
            </div>
          </div>

          <nav className="flex bg-cream p-1 rounded-2xl border border-line gap-1">
            <button
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                tab === 'elder'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-white/60'
              }`}
              onClick={() => setTab('elder')}
            >
              <span>👵</span>
              <span>Elder Screen</span>
            </button>
            <button
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                tab === 'dashboard'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-white/60'
              }`}
              onClick={() => setTab('dashboard')}
            >
              <span>📊</span>
              <span>Family Dashboard</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'elder' && (
          <div className="w-full max-w-xl flex flex-col items-center space-y-6 my-auto py-4">

            {/* If voice not supported */}
            {started && !voiceSupported() && (
              <div className="bg-yellow-50 border-2 border-yellow-400 text-yellow-900 px-5 py-3 rounded-2xl w-full text-center font-medium shadow-sm">
                ⚠️ Your browser does not support voice recognition. The big <strong>"I took it"</strong> button below is active.
              </div>
            )}

            {/* SCREEN 1: Welcome & Start Khayal */}
            {!started && (
              <div className="flex flex-col items-center p-8 bg-white/90 backdrop-blur-sm rounded-3xl border border-line shadow-xl w-full text-center space-y-6">
                <div
                  onClick={() => {
                    setMascotWiggle(true)
                    setTimeout(() => setMascotWiggle(false), 800)
                  }}
                  className="cursor-pointer group relative"
                  title="Click mascot to say hello!"
                >
                  <img
                    src="/mascot.png"
                    alt="Medicine mascot holding a heart"
                    className={`w-44 h-44 object-contain drop-shadow-xl transition-transform ${
                      mascotWiggle ? 'scale-115 rotate-6' : 'mascot-float group-hover:scale-105'
                    }`}
                  />
                  <div className="absolute -bottom-2 bg-brand-soft text-brand text-xs font-bold px-3 py-1 rounded-full border border-brand/20 shadow-sm flex items-center gap-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span>❤️</span> Caring Companion
                  </div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-extrabold text-brand tracking-tight">
                    Namaste, {ELDER_NAME}!
                  </h1>
                  <p className="text-muted text-lg max-w-md mx-auto">
                    I talk like a caring family member. I'll remind you when it's time for medicine and listen to your reply.
                  </p>
                </div>

                <button
                  className="w-full bg-brand hover:bg-brand-dark text-white px-8 py-5 rounded-2xl text-2xl font-bold shadow-lg shadow-brand/20 transition-all active:scale-[0.98] min-h-[64px] flex items-center justify-center gap-3 cursor-pointer"
                  onClick={() => setStarted(true)}
                >
                  <span>❤️</span> Start Khayal
                </button>
              </div>
            )}

            {/* SCREEN 2: Idle Watching State (when started and no active reminder) */}
            {started && !activeMed && (
              <div className="flex flex-col items-center p-7 bg-white/90 backdrop-blur-sm rounded-3xl border border-line shadow-lg w-full text-center space-y-5">
                <div
                  onClick={() => {
                    setMascotWiggle(true)
                    setTimeout(() => setMascotWiggle(false), 800)
                  }}
                  className="cursor-pointer group relative"
                  title="Khayal is listening and caring!"
                >
                  <img
                    src="/mascot.png"
                    alt="Khayal mascot"
                    className={`w-36 h-36 object-contain drop-shadow-md transition-transform ${
                      mascotWiggle ? 'scale-115 -rotate-6' : 'mascot-float group-hover:scale-105'
                    }`}
                  />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-sm flex items-center gap-1 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>All safe & watching</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h2 className="text-3xl font-extrabold text-ink" style={{ fontSize: '2rem' }}>
                    Khayal is Active
                  </h2>
                  <p className="text-muted text-lg">
                    Next dose: <strong className="text-brand font-bold">{nextMedInfo}</strong>
                  </p>
                </div>

                {/* Always-accessible manual "I took it" button */}
                <button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl text-2xl font-bold shadow-md transition-all active:scale-[0.98] min-h-[64px] flex items-center justify-center gap-2 cursor-pointer"
                  onClick={handleTaken}
                >
                  <span>✅</span> I took my medicine
                </button>
              </div>
            )}

            {/* SCREEN 3: Active Voice Reminder State */}
            {activeMed && (
              <div className="flex flex-col items-center p-7 bg-white/95 backdrop-blur-sm rounded-3xl border border-line shadow-2xl w-full text-center space-y-5">
                {/* Pulsing Orb with Mascot inside */}
                <div className={`orb ${orbClass} select-none relative cursor-pointer`} onClick={() => {
                  setMascotWiggle(true)
                  setTimeout(() => setMascotWiggle(false), 800)
                }}>
                  <img
                    src="/mascot.png"
                    alt="Khayal Mascot speaking or listening"
                    className={`w-36 h-36 object-contain drop-shadow-lg transition-transform duration-300 pointer-events-none ${
                      orbClass === 'orb-speaking'
                        ? 'mascot-speaking scale-105'
                        : orbClass === 'orb-listening'
                        ? 'mascot-listening scale-105'
                        : 'mascot-float'
                    }`}
                  />
                </div>

                {/* Status chip with animation */}
                <div className="text-2xl font-bold text-brand px-4 py-1.5 rounded-full bg-brand-soft border border-brand/20 inline-flex items-center gap-2 shadow-sm" aria-live="polite">
                  {orbClass === 'orb-speaking' && <span className="animate-pulse">🔊</span>}
                  {orbClass === 'orb-listening' && <span className="animate-bounce">🎙️</span>}
                  <span>{statusLabel || 'Listening…'}</span>
                </div>

                {/* Medicine info (huge accessible text >= 28px) */}
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold text-ink tracking-tight" style={{ fontSize: '2.4rem' }}>
                    {activeMed.name}
                  </div>
                  {activeMed.note && (
                    <div className="text-2xl font-medium text-muted" style={{ fontSize: '1.6rem' }}>
                      {activeMed.note}
                    </div>
                  )}
                </div>

                <div className="text-base text-muted">
                  Next scheduled: {nextMedInfo}
                </div>

                {/* Big accessible "I took it" button */}
                <button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-5 rounded-2xl text-2xl font-bold shadow-xl transition-all active:scale-[0.98] min-h-[64px] flex items-center justify-center gap-3 cursor-pointer"
                  onClick={handleTaken}
                >
                  <span>✅</span> I took it
                </button>
              </div>
            )}

            {/* Quick Demo & Test Controls */}
            {started && (
              <div className="w-full bg-white/70 backdrop-blur-sm p-4 border border-line rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-muted uppercase tracking-wider">
                  <span>Demo & Assistant Controls</span>
                  <span className="text-brand">⚡ Testing Tools</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    onClick={() => medicines[0] && startReminder(medicines[0])}
                  >
                    <span>▶️</span> Remind now
                  </button>

                  <label className="flex items-center gap-1.5 bg-cream px-3 py-1.5 rounded-xl border border-line text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={demo}
                      onChange={(e) => setDemo(e.target.checked)}
                      className="accent-brand"
                    />
                    <span>Fast demo timers</span>
                  </label>

                  <label className="flex items-center gap-1.5 bg-cream px-3 py-1.5 rounded-xl border border-line text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slowSpeech}
                      onChange={(e) => setSlowSpeech(e.target.checked)}
                      className="accent-brand"
                    />
                    <span>Speak slowly</span>
                  </label>

                  <label className="flex items-center gap-1.5 bg-cream px-3 py-1.5 rounded-xl border border-line text-sm font-medium">
                    <span>Language:</span>
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value)}
                      className="bg-transparent font-bold text-brand outline-none cursor-pointer"
                    >
                      <option value="en-IN">en-IN</option>
                      <option value="hi-IN">hi-IN</option>
                    </select>
                  </label>
                </div>
                {error && (
                  <div className="text-red-600 text-sm font-medium mt-1">{error}</div>
                )}
              </div>
            )}

            {/* Footer Disclaimer */}
            <p className="text-xs text-muted text-center max-w-md pt-4 px-2">
              Khayal is a reminder tool, not medical advice. In an emergency, call 112.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
