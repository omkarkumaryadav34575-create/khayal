// TEMP — VoiceTest panel for manual testing. Remove when no longer needed.
import { useState, useRef, useCallback } from 'react'
import { speak, listen, voiceSupported, stopAll } from './voice.js'
import { t } from './messages.js'
import { runReminder } from './reminder.js'

const SAMPLE_MED = { name: 'BP tablet', time: '08:00', note: 'The small white one, after breakfast' }

export default function VoiceTest() {
  const [lang, setLang] = useState('en-IN')
  const [transcript, setTranscript] = useState('')
  const [intent, setIntent] = useState(null)
  const [busy, setBusy] = useState('')
  const supported = voiceSupported()

  // TEMP — reminder test state
  const [reminderStatus, setReminderStatus] = useState('')
  const [reminderResult, setReminderResult] = useState('')
  const [reminderLog, setReminderLog] = useState([])
  const abortRef = useRef(null)

  const handleSpeak = async () => {
    setBusy('speaking')
    setTranscript('')
    setIntent(null)
    const phrase = t(lang, 'remind', {
      name: 'Dadi ji',
      medicine: 'BP tablet',
      note: 'The small white one, after breakfast',
    })
    await speak(phrase, lang)
    setBusy('')
  }

  const handleListen = async () => {
    setBusy('listening')
    setIntent(null)
    const text = await listen(lang)
    setTranscript(text)
    setBusy('')
  }

  const handleInterpret = async () => {
    if (!transcript) return
    setBusy('interpreting')
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, medicine: 'BP tablet' }),
      })
      const data = await res.json()
      setIntent(data)
    } catch (err) {
      setIntent({ error: err.message })
    }
    setBusy('')
  }

  const handleStop = () => {
    stopAll()
    setBusy('')
  }

  // TEMP — run a full reminder cycle in demo mode
  const handleRunReminder = useCallback(async () => {
    if (busy === 'reminder') return
    setBusy('reminder')
    setReminderResult('')
    setReminderLog([])

    const controller = new AbortController()
    abortRef.current = controller

    const addLog = (msg) => setReminderLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`])

    const result = await runReminder(SAMPLE_MED, {
      elderName: 'Dadi ji',
      demo: true,
      lang,
      onStatus: (status) => {
        setReminderStatus(status)
        addLog(`status → ${status}`)
      },
      signal: controller.signal,
    })

    setReminderResult(result)
    addLog(`result → ${result}`)
    setReminderStatus('')
    setBusy('')
    abortRef.current = null
  }, [busy, lang])

  // TEMP — abort a running reminder
  const handleAbort = () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    stopAll()
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6 font-sans">
      <h2 className="text-2xl font-bold text-brand">
        🔊 Voice Test Panel
        <span className="text-sm font-normal text-muted ml-2">(TEMP)</span>
      </h2>

      {!supported && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ⚠️ Your browser does not support SpeechRecognition.
          Speech synthesis may still work, but listening will not.
          Try Chrome on desktop.
        </div>
      )}

      {/* Language selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="lang-select" className="font-medium">Language:</label>
        <select
          id="lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="border border-line rounded px-3 py-2 bg-white"
        >
          <option value="en-IN">en-IN (English)</option>
          <option value="hi-IN">hi-IN (Hindi)</option>
        </select>
      </div>

      {/* Voice buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSpeak}
          disabled={busy === 'speaking'}
          className="bg-brand text-white px-5 py-3 rounded-lg font-semibold
                     hover:bg-brand-dark disabled:opacity-50 min-h-[48px]"
        >
          {busy === 'speaking' ? '🔊 Speaking…' : '🔊 Speak sample'}
        </button>

        <button
          onClick={handleListen}
          disabled={!supported || busy === 'listening'}
          className="bg-accent text-white px-5 py-3 rounded-lg font-semibold
                     hover:opacity-90 disabled:opacity-50 min-h-[48px]"
        >
          {busy === 'listening' ? '🎤 Listening…' : '🎤 Listen'}
        </button>

        <button
          onClick={handleInterpret}
          disabled={!transcript || busy === 'interpreting'}
          className="bg-ink text-white px-5 py-3 rounded-lg font-semibold
                     hover:opacity-90 disabled:opacity-50 min-h-[48px]"
        >
          {busy === 'interpreting' ? '⏳ Sending…' : '📡 Send to /api/interpret'}
        </button>

        {busy && busy !== 'reminder' && (
          <button
            onClick={handleStop}
            className="bg-red-500 text-white px-5 py-3 rounded-lg font-semibold
                       hover:bg-red-600 min-h-[48px]"
          >
            ⛔ Stop
          </button>
        )}
      </div>

      {/* Results */}
      {transcript && (
        <div className="bg-white border border-line rounded-lg p-4">
          <p className="text-sm text-muted mb-1">Transcript:</p>
          <p className="text-lg font-medium">{transcript}</p>
        </div>
      )}

      {intent && (
        <div className="bg-white border border-line rounded-lg p-4">
          <p className="text-sm text-muted mb-1">Intent result:</p>
          <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">
            {JSON.stringify(intent, null, 2)}
          </pre>
        </div>
      )}

      {/* TEMP — Reminder test section */}
      <hr className="border-line" />
      <h3 className="text-xl font-bold text-brand">🔄 Reminder Test (TEMP)</h3>
      <p className="text-sm text-muted">
        Runs the full reminder loop for "{SAMPLE_MED.name}" in demo mode (8 s waits).
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleRunReminder}
          disabled={busy === 'reminder'}
          className="bg-brand text-white px-5 py-3 rounded-lg font-semibold
                     hover:bg-brand-dark disabled:opacity-50 min-h-[48px]"
        >
          {busy === 'reminder' ? `⏳ Running (${reminderStatus})…` : '▶️ Run reminder (demo)'}
        </button>

        {busy === 'reminder' && (
          <button
            onClick={handleAbort}
            className="bg-red-500 text-white px-5 py-3 rounded-lg font-semibold
                       hover:bg-red-600 min-h-[48px]"
          >
            ⛔ Abort reminder
          </button>
        )}
      </div>

      {reminderResult && (
        <div className="bg-white border border-line rounded-lg p-4">
          <p className="text-sm text-muted mb-1">Reminder result:</p>
          <p className="text-lg font-bold">{reminderResult}</p>
        </div>
      )}

      {reminderLog.length > 0 && (
        <div className="bg-white border border-line rounded-lg p-4 max-h-48 overflow-auto">
          <p className="text-sm text-muted mb-1">Event log:</p>
          {reminderLog.map((line, i) => (
            <p key={i} className="text-xs font-mono">{line}</p>
          ))}
        </div>
      )}

      <p className="text-xs text-muted">
        This panel is temporary. Remove VoiceTest.jsx and the ?test=voice gate from App.jsx when done.
      </p>
    </div>
  )
}
