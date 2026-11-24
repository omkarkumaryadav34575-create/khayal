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
