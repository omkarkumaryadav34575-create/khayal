// server/test-interpret.js
import { interpretLocal } from './interpret.js'

const testCases = [
  { phrase: 'haan le li', expectedIntent: 'TAKEN', expectedMinutes: null },
  { phrase: 'yes done', expectedIntent: 'TAKEN', expectedMinutes: null },
  { phrase: 'le liya', expectedIntent: 'TAKEN', expectedMinutes: null },
  { phrase: 'han kha li', expectedIntent: 'TAKEN', expectedMinutes: null },
  { phrase: 'हाँ ले ली', expectedIntent: 'TAKEN', expectedMinutes: null },
  { phrase: 'ok', expectedIntent: 'UNCLEAR', expectedMinutes: null },
  { phrase: 'thodi der baad', expectedIntent: 'SNOOZE', expectedMinutes: 10 },
  { phrase: '20 minute baad', expectedIntent: 'SNOOZE', expectedMinutes: 20 },
  { phrase: '1 hour later', expectedIntent: 'SNOOZE', expectedMinutes: 60 },
  { phrase: 'abhi nahi li', expectedIntent: 'SNOOZE', expectedMinutes: 10 },
  { phrase: 'nahi li', expectedIntent: 'SNOOZE', expectedMinutes: 10 },
  { phrase: 'not yet', expectedIntent: 'SNOOZE', expectedMinutes: 10 },
  { phrase: 'no', expectedIntent: 'SNOOZE', expectedMinutes: 10 },
  { phrase: 'nahi lunga', expectedIntent: 'SKIP', expectedMinutes: null },
  { phrase: "I don't want it", expectedIntent: 'SKIP', expectedMinutes: null },
  { phrase: 'mujhe chakkar aa raha hai', expectedIntent: 'UNWELL', expectedMinutes: null },
  { phrase: 'sir mein dard hai', expectedIntent: 'UNWELL', expectedMinutes: null },
  { phrase: 'i feel dizzy', expectedIntent: 'UNWELL', expectedMinutes: null },
  { phrase: 'mujhe chakkar aa raha hai haan', expectedIntent: 'UNWELL', expectedMinutes: null },
  { phrase: 'मुझे चक्कर आ रहा है', expectedIntent: 'UNWELL', expectedMinutes: null },
  { phrase: 'bachao', expectedIntent: 'HELP', expectedMinutes: null },
  { phrase: 'I fell down', expectedIntent: 'HELP', expectedMinutes: null },
  { phrase: 'main gir gaya', expectedIntent: 'HELP', expectedMinutes: null },
  { phrase: 'chest pain', expectedIntent: 'HELP', expectedMinutes: null },
  { phrase: 'seene mein dard', expectedIntent: 'HELP', expectedMinutes: null },
  { phrase: 'बचाओ', expectedIntent: 'HELP', expectedMinutes: null },
  { phrase: 'pata nahi', expectedIntent: 'UNCLEAR', expectedMinutes: null },
  { phrase: 'kuch bhi', expectedIntent: 'UNCLEAR', expectedMinutes: null },
  { phrase: '', expectedIntent: 'UNCLEAR', expectedMinutes: null, label: '(empty string)' },
]

let passed = 0
let failed = 0

for (const { phrase, expectedIntent, expectedMinutes, label } of testCases) {
  const result = interpretLocal(phrase)
  const displayPhrase = label || phrase
  const intentMatch = result.intent === expectedIntent
  const minutesMatch = result.minutes === expectedMinutes

  if (intentMatch && minutesMatch) {
    console.log(`PASS: "${displayPhrase}" -> intent: ${result.intent}, minutes: ${result.minutes}`)
    passed++
  } else {
    console.error(
      `FAIL: "${displayPhrase}" -> got { intent: "${result.intent}", minutes: ${result.minutes} }, expected { intent: "${expectedIntent}", minutes: ${expectedMinutes} }`
    )
    failed++
  }
}

console.log(`\nTotal: ${testCases.length}, Passed: ${passed}, Failed: ${failed}`)

if (failed > 0) {
  process.exit(1)
}
