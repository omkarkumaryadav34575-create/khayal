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
