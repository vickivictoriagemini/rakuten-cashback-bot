/**
 * scripts/shopee-scraper.ts
 *
 * Intercepts Shopee's internal API calls made by the browser while loading the product page.
 * This avoids direct API auth issues (403) and page.evaluate() tsx __name bugs.
 *
 * Pi 5 cron: 0 * * * * cd /home/pi/rakuten && npx tsx scripts/shopee-scraper.ts >> /home/pi/shopee.log 2>&1
 * Requires: PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium in .env
 */

import 'dotenv/config'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { PrismaClient } from '@prisma/client'

puppeteer.use(StealthPlugin())

const prisma = new PrismaClient()
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''

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

interface ScrapedProduct {
  price: number | null
  originalPrice: number | null
  discount: string | null
  inStock: boolean
}

/**
 * Open the product page with a real browser and intercept the internal API response.
 * Shopee's JS automatically calls /api/v4/item/get with all required cookies/headers.
 * We just capture that response — no page.evaluate() needed.
 */
async function scrapeShopeeProduct(url: string, browser: any): Promise<ScrapedProduct> {
  const page = await browser.newPage()

  let apiData: any = null

  // Intercept the Shopee API response before it reaches the page
  page.on('response', async (response: any) => {
    const responseUrl = response.url()
    if (responseUrl.includes('/api/v4/item/get') && response.ok()) {
      try {
        const json = await response.json()
        if (json?.data?.item) {
          apiData = json.data.item
        }
      } catch {
        // ignore parse errors
      }
    }
  })

  try {
    await page.setViewport({ width: 1280, height: 800 })
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' })

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

    // Give extra time for the API call to complete if networkidle2 wasn't enough
    if (!apiData) await sleep(5000)

    if (!apiData) {
      console.log('  ⚠️  API data not captured. Page may have redirected to login.')
      return { price: null, originalPrice: null, discount: null, inStock: false }
    }

    // Shopee stores price in smallest unit (÷100000 = TWD)
    const rawPrice    = apiData.price_min ?? apiData.price
    const rawOriginal = apiData.price_min_before_discount ?? apiData.price_before_discount

    const price = rawPrice ? Math.round(rawPrice / 100000) : null
    const originalPrice = (rawOriginal && rawOriginal !== rawPrice)
      ? Math.round(rawOriginal / 100000)
      : null
    const discount = apiData.discount ? `${apiData.discount}% OFF` : null
    const inStock  = (apiData.stock ?? 0) > 0 || apiData.item_status === 'normal'

    return { price, originalPrice, discount, inStock }
  } finally {
    await page.close()
  }
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

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })

  try {
    for (const target of targets) {
      console.log(`Scraping: ${target.name}`)
      try {
        const data = await scrapeShopeeProduct(target.url, browser)

        console.log(`  💰 Price: ${data.price} | Original: ${data.originalPrice} | Discount: ${data.discount} | In Stock: ${data.inStock}`)

        if (data.price === null) {
          console.log('  ⚠️  No price captured. Skipping.')
          await sleep(5000)
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
            saving        ? `You save: ${target.currency} ${saving.toLocaleString()}` : '',
            data.discount ? `Discount: ${data.discount}` : '',
            ``,
            `<a href="${target.url}">👉 View on Shopee</a>`,
          ].filter(Boolean).join('\n')

          console.log(`  🔔 Price at/below target! Sending Telegram alert...`)
          await sendTelegram(adminChatId, msg)
        }

        await sleep(5000 + Math.random() * 3000)
      } catch (err: any) {
        console.error(`  ❌ Error: ${err.message}`)
        await sleep(5000)
      }
    }
  } finally {
    await browser.close()
    await prisma.$disconnect()
  }

  console.log(`\nDone at: ${new Date().toISOString()}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
