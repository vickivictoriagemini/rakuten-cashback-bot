import TelegramBot from 'node-telegram-bot-api'
import fetch from 'node-fetch'

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!TELEGRAM_TOKEN) {
  console.error("Please set TELEGRAM_BOT_TOKEN in .env")
  process.exit(1)
}

// Start polling
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true })

console.log("🤖 Telegram local tester is running... Send /track in your Telegram app!")

bot.on('message', async (msg) => {
  console.log(`Received message from ${msg.chat.first_name || msg.chat.id}: ${msg.text}`)
  
  // Forward the message to our own local Next.js Webhook endpoint!
  try {
    const res = await fetch('http://localhost:3000/api/telegram-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: Math.random() * 1000000 | 0,
        message: msg
      })
    })
    console.log(`Forwarded to Next.js Webhook! Response status: ${res.status}`)
  } catch (err: any) {
    console.error("Failed to forward to Next.js array. Is `npm run dev` running?", err.message)
  }
})
