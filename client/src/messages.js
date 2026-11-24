// client/src/messages.js

const phrases = {
  'en-IN': {
    remind:
      'Hello {name}! It is time for your {medicine}. {note}. Have you taken it?',
    retry:
      '{name}, just checking again. Have you taken your {medicine}?',
    taken:
      'Very good {name}! I have noted it. Take care.',
    snooze:
      'Okay, I will remind you again in {minutes} minutes.',
    skip:
      'Okay. I have informed your family.',
    alerted:
      'I am letting your family know right now. Please stay calm.',
    unclear:
      'Sorry, I did not catch that.',
    doubledose:
      'You already took your {medicine} a little while ago. Please do not take it again.',
  },
  'hi-IN': {
    remind:
      'नमस्ते {name}! आपकी {medicine} लेने का समय हो गया है। {note}। क्या आपने ले ली?',
    retry:
      '{name}, एक बार फिर पूछ लूँ, क्या आपने {medicine} ले ली?',
    taken:
      'बहुत अच्छा {name}! मैंने लिख लिया है। अपना ध्यान रखिए।',
    snooze:
      'ठीक है। {minutes} मिनट बाद फिर से याद दिलाया जाएगा।',
    skip:
      'ठीक है। परिवार को बता दिया गया है।',
    alerted:
      'परिवार को अभी खबर दी जा रही है। कृपया शांत रहिए।',
    unclear:
      'माफ़ कीजिए, बात साफ़ सुनाई नहीं दी।',
    doubledose:
      'आपने अभी थोड़ी देर पहले {medicine} ले ली है। कृपया दोबारा न लें।',
  },
}

const alertTexts = {
  missed:
    '⚠️ {name} did not respond to the {medicine} reminder ({time}). Please call them.',
  skipped:
    'ℹ️ {name} chose to skip {medicine}.',
  unwell:
    '🚨 {name} said: "{transcript}" during the {medicine} reminder. Please check on them now.',
  help:
    '🚨 EMERGENCY: {name} said: "{transcript}" during the {medicine} reminder. Please call them immediately.',
  doubledose:
    '⚠️ {name} may have taken {medicine} twice within a short time. Please check on them.',
}

/**
 * Replace {varName} placeholders.  If {note} resolves to empty,
 * collapse the stray ". ." or "। ।" that the template would leave.
 */
function interpolate(template, vars = {}) {
  let result = template.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? vars[k] : `{${k}}`,
  )
  // When note is empty the template becomes "… . . Have you…" or "… । ।"
  // Clean up double-dot / double-daari with optional whitespace.
  result = result.replace(/\.\s*\./g, '.').replace(/।\s*।/g, '।')
  return result
}

/**
 * Look up a spoken phrase.
 * @param {string} lang  'en-IN' or 'hi-IN'
 * @param {string} key   one of the phrase keys
 * @param {object} vars  replacement values
 */
export function t(lang, key, vars) {
  const table = phrases[lang] || phrases['en-IN']
  const template = table[key]
  if (!template) return key
  return interpolate(template, vars)
}

/**
 * Build a Telegram alert string.
 * @param {string} key   one of missed, skipped, unwell, help, doubledose
 * @param {object} vars  replacement values
 */
export function alertText(key, vars) {
  const template = alertTexts[key]
  if (!template) return key
  return interpolate(template, vars)
}
