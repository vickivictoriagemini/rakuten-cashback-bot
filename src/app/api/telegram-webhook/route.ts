import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTelegramBot } from '@/services/telegram'

export async function POST(request: Request) {
  try {
    const update = await request.json()
    
    if (update.message && update.message.text && update.message.chat) {
      const chatId = update.message.chat.id.toString()
      const text = update.message.text.trim()
      const name = update.message.chat.first_name || update.message.chat.title || 'Unknown'
      const type = update.message.chat.type || 'unknown'
      
      // Auto-register the subscriber
      await prisma.telegramSubscriber.upsert({
        where: { chatId },
        update: { name, source: type },
        create: { chatId, name, source: type }
      })

      const bot = await getTelegramBot()
      if (!bot) return NextResponse.json({ error: 'Bot not configured' }, { status: 500 })

      // Process commands
      if (text.startsWith('/track')) {
        const parts = text.split(' ')
        if (parts.length < 3) {
          await bot.sendMessage(chatId, '⚠️ 用法錯誤！請使用格式：\n`/track 店名 門檻百分比`\n例如：`/track Nike 15`', { parse_mode: 'Markdown' })
          return NextResponse.json({ ok: true })
        }
        const threshold = parseFloat(parts.pop() || '10')
        const brand = parts.slice(1).join(' ')
        
        await prisma.focusTarget.create({
          data: {
            chatId,
            name: brand,
            keyword: brand.toLowerCase(),
            threshold
          }
        })
        await bot.sendMessage(chatId, `✅ 成功為您追蹤：<b>${brand}</b> (回饋大於 ${threshold}% 時通知)`, { parse_mode: 'HTML' })
        
      } else if (text.startsWith('/untrack')) {
        const brand = text.replace('/untrack', '').trim()
        if (!brand) {
          await bot.sendMessage(chatId, '⚠️ 請指定要取消的店名，例如：`/untrack Nike`', { parse_mode: 'Markdown' })
          return NextResponse.json({ ok: true })
        }
        
        const deleted = await prisma.focusTarget.deleteMany({
          where: {
            chatId,
            keyword: {
              contains: brand.toLowerCase()
            }
          }
        })
        
        if (deleted.count > 0) {
          await bot.sendMessage(chatId, `🚫 已取消追蹤包含「${brand}」的店家 (${deleted.count} 筆)`, { parse_mode: 'HTML' })
        } else {
          await bot.sendMessage(chatId, `找不到符合「${brand}」的追蹤設定。`, { parse_mode: 'HTML' })
        }
        
      } else if (text.startsWith('/list')) {
        const targets = await prisma.focusTarget.findMany({ where: { chatId } })
        if (targets.length === 0) {
          await bot.sendMessage(chatId, `📝 您目前沒有追蹤任何專屬品牌。\n請使用 \`/track 品牌 門檻\` 來加入！`, { parse_mode: 'Markdown' })
        } else {
          let listMsg = '📋 <b>您的專屬監控清單</b>：\n\n'
          targets.forEach(t => {
            listMsg += `- <b>${t.name}</b>: >= ${t.threshold}%\n`
          })
          await bot.sendMessage(chatId, listMsg, { parse_mode: 'HTML' })
        }
        
      } else if (text.startsWith('/start') || text.startsWith('/help')) {
        const helpMsg = `🤖 <b>Rakuten 即時監控小幫手</b>\n\n我每天都會主動為您放送最狂的折扣情報！您也可以建立專屬的雷達名單喔！\n\n指令清單：\n🔹 \`/track 品牌 門檻\` (例如 \`/track sephora 15\`)\n🔹 \`/untrack 品牌\` (取消追蹤)\n🔹 \`/list\` (查看您的願望清單)`
        await bot.sendMessage(chatId, helpMsg, { parse_mode: 'HTML' })
      }
    }
    
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
