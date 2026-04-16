/**
 * scripts/shopee-scraper.ts
 *
 * Scrapes Shopee product prices via Shopee's internal JSON API.
 * No browser / Puppeteer needed — just fetch with real browser headers.
 *
 * Pi 5 cron: 0 * * * * cd /home/pi/rakuten && npx tsx scripts/shopee-scraper.ts >> /home/pi/shopee.log 2>&1
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''

// ─── Helpers ─────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function sendTelegram(chatId: string, text: string) {
  if (!TELEGRAM_TOKEN || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch (err) {
    console.error('Telegram send error:', err)
  }
}

/**
 * Parse shopid and itemid from a Shopee product URL.
 * Supports:
 *   https://shopee.tw/xxx-i.265108719.28623737682
 *   https://shopee.tw/product/265108719/28623737682
 */
function parseShopeeUrl(url: string): { shopId: string; itemId: string } | null {
  const m1 = url.match(/i\.(\d+)\.(\d+)/)
  if (m1) return { shopId: m1[1], itemId: m1[2] }

  const m2 = url.match(/\/product\/(\d+)\/(\d+)/)
  if (m2) return { shopId: m2[1], itemId: m2[2] }

  return null
}

interface ScrapedProduct {
  price: number | null
  originalPrice: number | null
  discount: string | null
  inStock: boolean
  name: string | null
}

async function scrapeShopeeProduct(url: string): Promise<ScrapedProduct> {
  const ids = parseShopeeUrl(url)
  if (!ids) throw new Error(`Cannot parse shopId/itemId from URL: ${url}`)

  const { shopId, itemId } = ids
  const apiUrl = `https://shopee.tw/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`

  console.log(`  API: ${apiUrl}`)

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      'Referer': 'https://shopee.tw/',
      'x-api-source': 'pc',
      'x-shopee-language': 'zh-Hant',
      'af-ac-enc-dat': '1',
    },
  })

  if (!res.ok) throw new Error(`Shopee API returned HTTP ${res.status}`)

  const json = await res.json() as any
  console.log(`  Raw response keys: ${Object.keys(json ?? {}).join(', ')}`)

  const item = json?.data?.item

  if (!item) {
    console.log(`  Full response: ${JSON.stringify(json).slice(0, 500)}`)
    throw new Error('Shopee API returned no item data')
  }

  // Price is in smallest unit (e.g. 999000000 = TWD 9990)
  const rawPrice    = item.price_min ?? item.price
  const rawOriginal = item.price_min_before_discount ?? item.price_before_discount

  const price = rawPrice ? Math.round(rawPrice / 100000) : null
  const originalPrice = (rawOriginal && rawOriginal !== rawPrice)
    ? Math.round(rawOriginal / 100000)
    : null
  const discount = item.discount ? `${item.discount}% OFF` : null
  const inStock  = (item.stock ?? 0) > 0 || item.item_status === 'normal'
  const name     = item.name ?? null

  return { price, originalPrice, discount, inStock, name }
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log('\n===== Shopee Scraper =====')
  console.log(`Started at: ${new Date().toISOString()}`)

  const targets = await prisma.shopeeTarget.findMany({ where: { active: true } })
  console.log(`Found ${targets.length} active target(s).\n`)

  if (targets.length === 0) {
    console.log('No active targets. Add products via Dashboard → Shopee page.')
    return
  }

  const settings    = await prisma.systemSetting.findFirst()
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || settings?.telegramChatId || ''

  for (const target of targets) {
    console.log(`Scraping: ${target.name}`)
    try {
      const data = await scrapeShopeeProduct(target.url)

      console.log(`  💰 Price: ${data.price} | Original: ${data.originalPrice} | Discount: ${data.discount} | In Stock: ${data.inStock}`)

      if (data.price === null) {
        console.log('  ⚠️  Could not extract price. Skipping DB write.')
        await sleep(3000)
        continue
      }

      await prisma.shopeePriceHistory.create({
        data: {
          targetId:      target.id,
          price:         data.price,
          originalPrice: data.originalPrice,
          discount:      data.discount,
          inStock:       data.inStock,
        },
      })

      if (data.price <= target.targetPrice && adminChatId) {
        const saving = data.originalPrice ? data.originalPrice - data.price : null
        const msg = [
          `🛒 <b>Price Alert!</b>`,
          ``,
          `<b>${target.name}</b> is now <b>${target.currency} ${data.price.toLocaleString()}</b>`,
          `Your target: ${target.currency} ${target.targetPrice.toLocaleString()}`,
          saving             ? `You save: ${target.currency} ${saving.toLocaleString()}` : '',
          data.discount      ? `Discount: ${data.discount}` : '',
          ``,
          `<a href="${target.url}">👉 View on Shopee</a>`,
        ].filter(Boolean).join('\n')

        console.log(`  🔔 Price at/below target! Sending Telegram alert...`)
        await sendTelegram(adminChatId, msg)
      }

      await sleep(2000 + Math.random() * 2000)
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`)
      await sleep(3000)
    }
  }

  await prisma.$disconnect()
  console.log(`\nDone at: ${new Date().toISOString()}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
