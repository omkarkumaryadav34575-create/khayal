// client/src/reminder.js
import { speak, listen, sleep, stopAll } from './voice.js'
import { t, alertText } from './messages.js'

const MAX_TRIES = 3
const MAX_SNOOZES = 3
const NORMAL_RETRY_WAIT = 5 * 60 * 1000   // 5 minutes
const DEMO_WAIT = 8 * 1000                 // 8 seconds

/** Helper to sleep while supporting immediate abort */
function waitInterruptible(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })
}

// ── network helpers (every fetch wrapped in try/catch) ──────────────

/** POST /api/logs — log a medicine event. */
async function postLog(medicine, status) {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicine, status }),
    })
  } catch {
    // Network failure must not crash the reminder flow.
  }
}

/** POST /api/alert — send a Telegram alert. */
async function postAlert(message) {
  try {
    await fetch('/api/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  } catch {
    // Network failure must not crash the reminder flow.
  }
}

/** GET /api/logs — check if taken recently (double-dose guard) */
async function isRecentTaken(medicineName, demo) {
  const res = await fetch('/api/logs')
  if (!res.ok) return false
  const logs = await res.json()
  if (!Array.isArray(logs)) return false

  const windowMs = demo ? 30 * 1000 : 60 * 60 * 1000
  const now = Date.now()

  return logs.some((l) => {
    if (l.status !== 'taken') return false
    if ((l.medicine || '').trim().toLowerCase() !== (medicineName || '').trim().toLowerCase()) return false
    const logTime = new Date(l.at).getTime()
    if (isNaN(logTime)) return false
    const age = now - logTime
    return age >= 0 && age < windowMs
  })
}

/** POST /api/interpret — classify a transcript. */
async function postInterpret(transcript, medicine) {
  try {
    const res = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, medicine }),
    })
    return await res.json()
  } catch {
    // If the server is unreachable, treat it as UNCLEAR so the loop retries.
    return { intent: 'UNCLEAR', minutes: null }
  }
}

// ── main state machine ──────────────────────────────────────────────

/**
 * Run a single medicine reminder conversation.
 *
 * @param {object} med               Medicine object { name, time, note }
 * @param {object} opts
 * @param {string} opts.elderName    Display name of the elder
 * @param {boolean} opts.demo        Use short wait times
 * @param {string} opts.lang         'en-IN' or 'hi-IN'
 * @param {number} opts.rate         Speech synthesis rate (e.g. 0.9 or 0.7)
 * @param {function} opts.onStatus   Callback receiving status strings
 * @param {AbortSignal} opts.signal  Cancellation signal
 * @returns {Promise<string>}        'taken' | 'skipped' | 'unwell' | 'help' | 'missed' | 'aborted'
 */
export async function runReminder(med, { elderName, demo, lang, rate = 0.9, onStatus, signal }) {
  const vars = { name: elderName, medicine: med.name, note: med.note || '', time: med.time }

  let unanswered = 0   // empty replies + UNCLEAR
  let snoozes = 0
  let isFirstAsk = true

  const retryWaitMs = demo ? DEMO_WAIT : NORMAL_RETRY_WAIT
  const listenTimeoutMs = demo ? 8000 : 15000

  while (unanswered < MAX_TRIES && snoozes < MAX_SNOOZES) {
    // ── abort check ──
    if (signal?.aborted) { stopAll(); return 'aborted' }

    // ── speak the prompt ──
    onStatus?.('speaking')
    const phraseKey = isFirstAsk ? 'remind' : 'retry'
    await speak(t(lang, phraseKey, vars), lang, rate)
    isFirstAsk = false

    // ── abort check ──
    if (signal?.aborted) { stopAll(); return 'aborted' }

    // Brief pause so Chrome releases the TTS audio channel before
    // SpeechRecognition tries to open the microphone.
    await sleep(400)

    // ── abort check ──
    if (signal?.aborted) { stopAll(); return 'aborted' }

    // ── listen ──
    onStatus?.('listening')
    const transcript = await listen(lang, listenTimeoutMs)

    // ── abort check ──
    if (signal?.aborted) { stopAll(); return 'aborted' }

    // ── empty reply → unanswered ──
    if (!transcript.trim()) {
      unanswered++
      if (unanswered < MAX_TRIES) {
        onStatus?.('waiting')
        await waitInterruptible(retryWaitMs, signal)
        if (signal?.aborted) { stopAll(); return 'aborted' }
      }
      continue
    }

    // ── classify ──
    onStatus?.('thinking')
    const { intent, minutes } = await postInterpret(transcript, med.name)

    // ── abort check ──
    if (signal?.aborted) { stopAll(); return 'aborted' }

    // ── act on intent ──
    switch (intent) {
      case 'TAKEN': {
        let isDouble = false
        try {
          isDouble = await isRecentTaken(med.name, demo)
        } catch {
          isDouble = false
        }

        if (isDouble) {
          await postAlert(alertText('doubledose', vars))
          onStatus?.('speaking')
          await speak(t(lang, 'doubledose', vars), lang, rate)
          onStatus?.('done')
          return 'taken'
        }

        await postLog(med.name, 'taken')
        onStatus?.('speaking')
        await speak(t(lang, 'taken', vars), lang, rate)
        onStatus?.('done')
        return 'taken'
      }

      case 'SNOOZE': {
        snoozes++
        if (snoozes >= MAX_SNOOZES) break  // fall through to missed
        await postLog(med.name, 'snoozed')
        const snoozeMin = minutes || 10
        onStatus?.('speaking')
        await speak(t(lang, 'snooze', { ...vars, minutes: snoozeMin }), lang, rate)
        onStatus?.('waiting')
        const waitMs = demo ? DEMO_WAIT : snoozeMin * 60 * 1000
        await waitInterruptible(waitMs, signal)
        if (signal?.aborted) { stopAll(); return 'aborted' }
        continue  // ask again (with retry phrase)
      }

      case 'SKIP': {
        await postLog(med.name, 'skipped')
        onStatus?.('speaking')
        await speak(t(lang, 'skip', vars), lang, rate)
        onStatus?.('done')
        return 'skipped'
      }

      case 'UNWELL': {
        await postLog(med.name, 'unwell')
        onStatus?.('speaking')
        await speak(t(lang, 'alerted', vars), lang, rate)
        onStatus?.('escalated')
        return 'unwell'
      }

      case 'HELP': {
        await postLog(med.name, 'help')
        onStatus?.('speaking')
        await speak(t(lang, 'alerted', vars), lang, rate)
        onStatus?.('escalated')
        return 'help'
      }

      case 'UNCLEAR':
      default: {
        unanswered++
        onStatus?.('speaking')
        await speak(t(lang, 'unclear', vars), lang, rate)
        if (unanswered < MAX_TRIES) {
          onStatus?.('waiting')
          await waitInterruptible(retryWaitMs, signal)
          if (signal?.aborted) { stopAll(); return 'aborted' }
        }
        continue
      }
    }
    // If we broke out of the switch (max snoozes reached), fall to missed below.
    break
  }

  // ── exhausted tries or snoozes → missed ──
  if (signal?.aborted) { stopAll(); return 'aborted' }

  await postLog(med.name, 'missed')
  onStatus?.('escalated')
  return 'missed'
}
