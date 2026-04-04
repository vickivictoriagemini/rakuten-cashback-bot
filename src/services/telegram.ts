import TelegramBot from 'node-telegram-bot-api'
import { prisma } from '@/lib/prisma'

let botInstance: TelegramBot | null = null

export async function getTelegramBot() {
  if (botInstance) return botInstance

  const settings = await prisma.systemSetting.findFirst()
  if (!settings || !settings.telegramToken) {
    return null
  }

  // Initialize bot without polling since we only use it to send messages
  botInstance = new TelegramBot(settings.telegramToken, { polling: false })
  return botInstance
}

export async function sendTelegramMessage(message: string) {
  try {
    const settings = await prisma.systemSetting.findFirst()
    if (!settings || !settings.telegramToken || !settings.telegramChatId) {
      console.log('Telegram settings not configured')
      return false
    }

    const bot = await getTelegramBot()
    if (!bot) return false

    await bot.sendMessage(settings.telegramChatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
    return true
  } catch (error) {
    console.error('Failed to send telegram message:', error)
    return false
  }
}
