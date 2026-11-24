// client/src/voice.js
let activeRecognition = null

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const voiceSupported = () =>
  'speechSynthesis' in window &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition)

export function speak(text, lang = 'en-IN', rate = 0.9) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve()
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = rate
    let finished = false
    let guard
    const done = () => {
      if (finished) return
      finished = true
      clearTimeout(guard)
      resolve()
    }
    u.onend = done
    u.onerror = done
    guard = setTimeout(done, Math.max(4000, text.length * 120))
    speechSynthesis.speak(u)
  })
}

export function listen(lang = 'en-IN', timeoutMs = 8000) {
  return new Promise((resolve) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return resolve('')
    const rec = new SR()
    activeRecognition = rec
    rec.lang = lang
    rec.interimResults = false
    rec.maxAlternatives = 1
    let finished = false
    let timer
    const finish = (text) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (activeRecognition === rec) activeRecognition = null
      resolve(text || '')
    }
    rec.onresult = (e) => finish(e.results[0][0].transcript)
    rec.onerror = () => finish('')
    rec.onend = () => finish('')
    try {
      rec.start()
    } catch {
      return finish('')
    }
    timer = setTimeout(() => {
      try { rec.stop() } catch {}
      finish('')
    }, timeoutMs)
  })
}

export function stopAll() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
  try { activeRecognition?.abort() } catch {}
  activeRecognition = null
}
