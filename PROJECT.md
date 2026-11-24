# Khayal: voice medicine reminder for elderly people

> Agents: read this whole file before every task. It is the single source of truth.
> If a task prompt conflicts with this file, follow this file and tell me about the conflict.

## 1. What we are building

Khayal talks to an elderly person like a caring family member. At the scheduled time it speaks a reminder, listens to the spoken reply (Hindi, English or Hinglish), confirms whether the dose was taken, retries if there is no answer, and alerts a family member on Telegram if the person does not respond, skips the dose, feels unwell, or asks for help. A family dashboard shows what was taken or missed.

Core loop:

```
Schedule -> Voice reminder -> Listen -> Confirm / Retry -> Alert family -> Log everything
```

Two screens in one React app, switched by tabs:
- **Elder screen:** huge text, big Start button, pulsing orb showing speaking / listening, big "I took it" backup button.
- **Family dashboard:** stat cards, live activity list, medicine list, add-medicine form.

Khayal is a reminder tool. It never gives medical advice, never suggests doses, never diagnoses.

## 2. Stack and hard constraints

- Client: React + Vite + Tailwind CSS v4 (`@tailwindcss/vite` plugin). JavaScript, not TypeScript.
- Server: Node 18+ with Express, ES modules (`"type": "module"`), global `fetch`.
- Allowed dependencies ONLY: client `react`, `react-dom`, `tailwindcss`, `@tailwindcss/vite`, `vite`, `@vitejs/plugin-react`. Server `express`, `cors`, `dotenv`. Ask me before adding anything else.
- Data lives in server memory. No database, no login, no auth.
- **No AI API calls anywhere.** Understanding replies is done by the keyword matcher in section 5.
- Voice uses the browser only: `SpeechSynthesis` and `SpeechRecognition` / `webkitSpeechRecognition` (Chrome). Languages: `en-IN` and `hi-IN`.
- Secrets only in `server/.env`. Never in client code, never logged, never committed. `.env` must be in `.gitignore`.

## 3. File structure (do not rename)

```
khayal/
  PROJECT.md
  README.md
  .gitignore
  server/
    package.json
    server.js          Express app and routes
    interpret.js       keyword matcher (section 5)
    telegram.js        sendTelegram helper (section 6)
    store.js           in-memory data and seed data (section 9)
    test-interpret.js  phrase tests (section 5)
    .env.example
  client/
    package.json
    vite.config.js
    index.html
    src/
      main.jsx
      App.jsx          tabs, elder screen, scheduler
      Dashboard.jsx    family dashboard
      voice.js         speak, listen, sleep, stopAll (section 7)
      messages.js      spoken phrases and alert texts (section 8)
      reminder.js      runReminder state machine
      medicineNames.js (added in task 7)
      index.css        Tailwind import and theme tokens (section 10)
```

## 4. API contract (do not change names or shapes)

| Method and path | Body | Response |
|---|---|---|
| GET `/api/health` | none | `{ "ok": true }` |
| POST `/api/interpret` | `{ transcript, medicine }` | `{ "intent": "...", "minutes": number or null }` |
| POST `/api/alert` | `{ message }` | `{ "ok": boolean }` |
| GET `/api/medicines` | none | `[{ id, name, time, note }]` |
| POST `/api/medicines` | `{ name, time, note }` | the created medicine |
| DELETE `/api/medicines/:id` | none | `{ "ok": true }` |
| GET `/api/logs` | none | `[{ id, at, medicine, status }]`, newest first |
| POST `/api/logs` | `{ medicine, status }` | the created log |

Field rules:
- `intent` is exactly one of: `TAKEN`, `SNOOZE`, `SKIP`, `UNWELL`, `HELP`, `UNCLEAR`.
- `time` is a 24-hour `"HH:MM"` string.
- `at` is an ISO 8601 string set by the server.
- `status` is exactly one of: `taken`, `missed`, `skipped`, `unwell`, `help`, `snoozed`.
- `id` is a number (use `Date.now()` plus a counter to avoid collisions).
- Validate input. Return `400` with `{ "error": "..." }` for bad bodies. Never crash on bad input.
- Server listens on `process.env.PORT || 3001`. Vite proxies `/api` to `http://localhost:3001`.

## 5. Reference implementation: `server/interpret.js`

Implement exactly this logic. You may fix bugs, but do not change the check order or remove phrases.

Rules behind it:
- Order of checks matters: HELP, then UNWELL, then SKIP, then SNOOZE, then TAKEN. Safety words win over everything.
- Matching is whole-word or whole-phrase, so "khana" does not match "han".
- Negations ("nahi li") are checked in SNOOZE before "li" or "haan" can make it TAKEN.
- A false TAKEN is worse than a false UNCLEAR, so ambiguous words like "ok" and "theek hai" are deliberately NOT in the TAKEN list.

```js
// server/interpret.js
const normalize = (raw) =>
  ' ' +
  String(raw || '')
    .toLowerCase()
    .replace(/['’`]/g, '')                    // don't -> dont
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')   // keep letters, Devanagari marks, digits
    .replace(/\s+/g, ' ')
    .trim() +
  ' '

const has = (padded, phrases) => phrases.some((p) => padded.includes(' ' + p + ' '))

const HELP = [
  'help', 'bachao', 'bachaao', 'emergency', 'fell', 'fallen', 'gir gaya', 'gir gayi', 'gir gaye',
  'chest', 'seene', 'heart attack',
  'बचाओ', 'गिर गया', 'गिर गई', 'सीने', 'सीना',
]
const UNWELL = [
  'chakkar', 'dizzy', 'dard', 'pain', 'ulti', 'vomit', 'vomiting', 'ghabrahat', 'kamzori',
  'weak', 'bimar', 'nausea', 'tabiyat kharab', 'tabiyat theek nahi',
  'चक्कर', 'दर्द', 'उल्टी', 'घबराहट', 'कमज़ोरी', 'कमजोरी', 'बीमार', 'तबीयत खराब',
]
const SKIP = [
  'nahi lunga', 'nahi lungi', 'nahin lunga', 'nahin lungi', 'nahi leni', 'nahi khani',
  'nahi khaunga', 'nahi khaungi', 'skip', 'dont want', 'do not want',
  'नहीं लूंगा', 'नहीं लूँगा', 'नहीं लूंगी', 'नहीं लूँगी', 'नहीं खानी', 'नहीं खाऊंगा', 'नहीं खाऊँगा',
]
const SNOOZE = [
  'baad', 'later', 'thodi der', 'ruko', 'wait', 'abhi nahi', 'abhi nahin', 'not yet',
  'nahi li', 'nahi liya', 'nahin li', 'nahin liya', 'not taken', 'not done',
  'didnt take', 'have not', 'havent',
  'बाद', 'थोड़ी देर', 'रुको', 'अभी नहीं', 'नहीं ली', 'नहीं लिया',
]
const BARE_NO = ['no', 'nope', 'nahi', 'nahin', 'नहीं', 'नही']  // only when the WHOLE reply is this word
const TAKEN = [
  'haan', 'han', 'ha', 'yes', 'yeah', 'yep', 'done', 'taken',
  'le li', 'le liya', 'lee li', 'kha li', 'kha liya', 'ho gaya', 'hogaya',
  'हाँ', 'हां', 'हा', 'ले ली', 'ले लिया', 'खा ली', 'खा लिया', 'हो गया',
]

function extractMinutes(padded) {
  const m = padded.match(/(\d+)\s*(hour|hours|hr|hrs|ghanta|ghante|घंटा|घंटे)?/u)
  if (!m) return 10
  let n = parseInt(m[1], 10)
  if (m[2]) n *= 60
  return Math.min(Math.max(n, 1), 180)
}

export function interpretLocal(raw) {
  const padded = normalize(raw)
  const bare = padded.trim()
  if (!bare) return { intent: 'UNCLEAR', minutes: null }

  if (has(padded, HELP)) return { intent: 'HELP', minutes: null }
  if (has(padded, UNWELL)) return { intent: 'UNWELL', minutes: null }
  if (has(padded, SKIP)) return { intent: 'SKIP', minutes: null }
  if (has(padded, SNOOZE) || BARE_NO.includes(bare))
    return { intent: 'SNOOZE', minutes: extractMinutes(padded) }
  if (has(padded, TAKEN)) return { intent: 'TAKEN', minutes: null }
  return { intent: 'UNCLEAR', minutes: null }
}
```

### Test phrases for `server/test-interpret.js`

The script imports `interpretLocal`, runs every row, prints PASS or FAIL per row and a final count, and exits with code 1 if any row fails.

| Phrase | Expected intent | Expected minutes |
|---|---|---|
| haan le li | TAKEN | null |
| yes done | TAKEN | null |
| le liya | TAKEN | null |
| han kha li | TAKEN | null |
| हाँ ले ली | TAKEN | null |
| ok | UNCLEAR | null |
| thodi der baad | SNOOZE | 10 |
| 20 minute baad | SNOOZE | 20 |
| 1 hour later | SNOOZE | 60 |
| abhi nahi li | SNOOZE | 10 |
| nahi li | SNOOZE | 10 |
| not yet | SNOOZE | 10 |
| no | SNOOZE | 10 |
| nahi lunga | SKIP | null |
| I don't want it | SKIP | null |
| mujhe chakkar aa raha hai | UNWELL | null |
| sir mein dard hai | UNWELL | null |
| i feel dizzy | UNWELL | null |
| mujhe chakkar aa raha hai haan | UNWELL | null |
| मुझे चक्कर आ रहा है | UNWELL | null |
| bachao | HELP | null |
| I fell down | HELP | null |
| main gir gaya | HELP | null |
| chest pain | HELP | null |
| seene mein dard | HELP | null |
| बचाओ | HELP | null |
| pata nahi | UNCLEAR | null |
| kuch bhi | UNCLEAR | null |
| (empty string) | UNCLEAR | null |

## 6. Reference implementation: `server/telegram.js`

```js
// server/telegram.js
export async function sendTelegram(text) {
  const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } = process.env
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram is not configured (missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID).')
    return false
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    })
    return res.ok
  } catch (err) {
    console.error('Telegram send failed:', err.message)   // never log the token or URL
    return false
  }
}
```

`server/.env.example`:

```
PORT=3001
TELEGRAM_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

## 7. Reference implementation: `client/src/voice.js`

Chrome sometimes never fires `onend` for speech, so `speak` has a timeout guard. `stopAll()` lets the app cancel speech and listening instantly.

```js
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
```

## 8. Spoken phrases and alert texts: `client/src/messages.js`

Export `t(lang, key, vars)` and `alertText(key, vars)`. Variables: `{name}`, `{medicine}`, `{note}`, `{minutes}`, `{time}`, `{transcript}`.

| key | `en-IN` | `hi-IN` |
|---|---|---|
| `remind` | Hello {name}! It is time for your {medicine}. {note}. Have you taken it? | नमस्ते {name}! आपकी {medicine} लेने का समय हो गया है। {note}। क्या आपने ले ली? |
| `retry` | {name}, just checking again. Have you taken your {medicine}? | {name}, एक बार फिर पूछ लूँ, क्या आपने {medicine} ले ली? |
| `taken` | Very good {name}! I have noted it. Take care. | बहुत अच्छा {name}! मैंने लिख लिया है। अपना ध्यान रखिए। |
| `snooze` | Okay, I will remind you again in {minutes} minutes. | ठीक है। {minutes} मिनट बाद फिर से याद दिलाया जाएगा। |
| `skip` | Okay. I have informed your family. | ठीक है। परिवार को बता दिया गया है। |
| `alerted` | I am letting your family know right now. Please stay calm. | परिवार को अभी खबर दी जा रही है। कृपया शांत रहिए। |
| `unclear` | Sorry, I did not catch that. | माफ़ कीजिए, बात साफ़ सुनाई नहीं दी। |
| `doubledose` | You already took your {medicine} a little while ago. Please do not take it again. | आपने अभी थोड़ी देर पहले {medicine} ले ली है। कृपया दोबारा न लें। |

Telegram alert texts (English only), keyed by `missed`, `skipped`, `unwell`, `help`, `doubledose`:

- `missed`: ⚠️ {name} did not respond to the {medicine} reminder ({time}). Please call them.
- `skipped`: ℹ️ {name} chose to skip {medicine}.
- `unwell`: 🚨 {name} said: "{transcript}" during the {medicine} reminder. Please check on them now.
- `help`: 🚨 EMERGENCY: {name} said: "{transcript}" during the {medicine} reminder. Please call them immediately.
- `doubledose`: ⚠️ {name} may have taken {medicine} twice within a short time. Please check on them.

## 9. Seed data: `server/store.js`

On server start, seed:

Medicines:
- `{ name: "BP tablet", time: "08:00", note: "The small white one, after breakfast" }`
- `{ name: "Sugar tablet", time: "14:00", note: "After lunch" }`
- `{ name: "Vitamin D", time: "20:00", note: "With dinner" }`

Logs: about 14 entries spread over the last 6 days, mostly `taken`, with one `missed`, one `skipped` and one `snoozed`, so the dashboard looks alive on first open. Log timestamps must be valid ISO strings in the past.

Elder name constant: `ELDER_NAME = "Dadi ji"` in `client/src/App.jsx`.

## 10. Design tokens: `client/src/index.css`

```css
@import "tailwindcss";

@theme {
  --color-brand: #0F766E;
  --color-brand-dark: #115E59;
  --color-brand-soft: #CCFBF1;
  --color-cream: #FFFBF5;
  --color-ink: #1E293B;
  --color-muted: #475569;
  --color-accent: #F97316;
  --color-line: #E7E5E4;
}

body { background: var(--color-cream); color: var(--color-ink); font-family: Inter, system-ui, sans-serif; }
:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 3px; }

.orb { width: 14rem; height: 14rem; border-radius: 9999px; display: grid; place-items: center; font-size: 4.5rem; background: #E2E8F0; }
.orb-speaking { background: var(--color-brand-soft); animation: pulse-teal 1.6s ease-out infinite; }
.orb-listening { background: #FFEDD5; animation: pulse-coral 1.2s ease-out infinite; }
@keyframes pulse-teal { 0% { box-shadow: 0 0 0 0 rgba(15,118,110,.45); } 100% { box-shadow: 0 0 0 40px rgba(15,118,110,0); } }
@keyframes pulse-coral { 0% { box-shadow: 0 0 0 0 rgba(249,115,22,.5); } 100% { box-shadow: 0 0 0 40px rgba(249,115,22,0); } }
@media (prefers-reduced-motion: reduce) { .orb-speaking, .orb-listening { animation: none; } }
```

Status chips (always show icon plus text, never color alone):
- taken ✅ green, snoozed 💤 amber, skipped ⏭️ yellow, missed ❌ red, unwell 🤒 orange, help 🚨 red.

Elder screen rules: text at least 28px, buttons at least 64px tall, no dark mode, very few elements. Dashboard text at least 14px.

Footer on both screens: "Khayal is a reminder tool, not medical advice. In an emergency, call 112."

## 11. Reminder behavior (used by `reminder.js` and `App.jsx`)

- `runReminder(med, { elderName, demo, lang, onStatus, signal })` returns one of `'taken' | 'skipped' | 'unwell' | 'help' | 'missed' | 'aborted'`.
- `onStatus` receives: `speaking`, `listening`, `thinking`, `waiting`, `done`, `escalated`.
- Wait times: normal retry wait 5 minutes, demo retry wait 8 seconds. Snooze wait: normal `minutes` minutes, demo 8 seconds.
- Maximum 3 unanswered or unclear tries, then log `missed` and alert family. Maximum 3 snoozes, then treat as missed.
- Never listen while speaking. Always `await speak(...)` before `listen(...)`.
- Scheduler: check every 10 seconds, compare local `HH:MM` to each medicine time, fire once per medicine per minute per day, and never start a second reminder while one is running.

## 12. Edge cases that must be handled

- Speech recognition unsupported or microphone denied: show a clear message and keep the "I took it" button fully working.
- Autoplay and mic rules: nothing speaks until the user presses Start.
- Every `fetch` has `try/catch`. A failed Telegram call or failed API call must never crash the app or freeze the orb.
- Empty states: no medicines, no logs, server unreachable.
- Pressing "I took it" while a reminder is running cancels that reminder (`signal`, `stopAll()`).
- Server restarts reset in-memory data to seed data. That is expected.

## 13. Definition of done for the whole project

1. `npm run dev` works in both `server` and `client`.
2. Saying "haan le li" logs `taken` and the dashboard shows it within 5 seconds.
3. "thodi der baad" snoozes, "mujhe chakkar aa raha hai" sends an instant Telegram alert, and silence leads to 3 retries then a Telegram alert.
4. Demo mode finishes the silence path in under 40 seconds.
5. No secrets in client code or git history. `.env` is ignored.
6. `server/test-interpret.js` passes every phrase.
7. README explains setup and has a 2-minute demo script.

## 14. Out of scope (do not build unless I ask)

Database, login, AI model calls, phone calls, SMS or WhatsApp, voice cloning, payments, push notifications.
