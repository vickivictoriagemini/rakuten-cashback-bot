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
  imageUrl: string | null
  screenshot: string | null
}

/**
 * Open the product page with a real browser and intercept the internal API response.
 * Shopee's JS automatically calls /api/v4/item/get with all required cookies/headers.
 * We just capture that response — no page.evaluate() needed.
 */
async function scrapeShopeeProduct(url: string, browser: any): Promise<ScrapedProduct> {
  const page = await browser.newPage()

  let apiData: any = null
  const capturedUrls: string[] = []

  // Intercept the Shopee API response before it reaches the page
  page.on('response', async (response: any) => {
    const responseUrl = response.url()
    // Log all Shopee API calls for debugging
    if (responseUrl.includes('/api/')) {
      capturedUrls.push(`${response.status()} ${responseUrl.split('?')[0]}`)
    }
    if ((responseUrl.includes('/api/v4/item/get') || responseUrl.includes('/api/v4/pdp/get_pc')) && response.ok()) {
      try {
        const json = await response.json()
        
        // Handle new /api/v4/pdp/get_pc structure
        if (json?.data?.item) {
          apiData = json.data.item
        } else if (json?.data?.item_info) {
          apiData = json.data.item_info
        } else if (json?.item) {
          apiData = json.item
        }
      } catch {
        // ignore parse errors
      }
    }
  })

  try {
    await page.setViewport({ width: 1280, height: 800 })
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' })

    // Inject Shopee cookies if provided in .env
    const cookieString = process.env.SHOPEE_COOKIES || ''
    if (cookieString) {
      const cookies = cookieString.split(';').map(pair => {
        const [name, ...rest] = pair.trim().split('=')
        return {
          name: name.trim(),
          value: rest.join('=').trim(),
          domain: '.shopee.tw',
        }
      }).filter(c => c.name && c.value)
      
      await page.setCookie(...cookies)
    }

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

    const finalUrl = page.url()
    console.log(`  Final URL: ${finalUrl}`)

    // 📸 Wait for React to mount the main components (like images), then wait 1.5s for text to hydrate, then SNAP
    let screenshot = null
    try {
      await page.waitForSelector('img', { timeout: 5000 })
      await sleep(1500)
      const b64 = await page.screenshot({ type: 'jpeg', quality: 60, encoding: 'base64' })
      screenshot = `data:image/jpeg;base64,${b64}`
    } catch {
      // Ignore if taking screenshot fails
    }

    // ─── Simulate Human Interaction ───
    // Bot prevention looks for people who open a page and immediately leave or never move the mouse.
    
    // 1. Move mouse randomly across the screen
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(Math.random() * 1000) + 100
      const y = Math.floor(Math.random() * 600) + 100
      await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) })
      await sleep(300 + Math.random() * 500)
    }

    // 2. Scroll down slowly (real users scroll to see reviews/description)
    await page.evaluate(() => {
      window.scrollBy({ top: Math.floor(Math.random() * 500) + 300, behavior: 'smooth' })
    })
    await sleep(1500 + Math.random() * 1000)

    // 3. Scroll back up a bit
    await page.evaluate(() => {
      window.scrollBy({ top: -Math.floor(Math.random() * 200), behavior: 'smooth' })
    })
    
    // Give extra time for the API call to complete if it was slow
    if (!apiData) await sleep(5000 + Math.random() * 3000)

    if (!apiData) {
      console.log(`  Intercepted API calls (${capturedUrls.length}):`)
      capturedUrls.slice(0, 10).forEach(u => console.log(`    ${u}`))
      console.log('  ⚠️  API data not captured. Page may have redirected to login.')
      return { price: null, originalPrice: null, discount: null, inStock: false, imageUrl: null, screenshot: null }
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
    
    // Construct full CDN URL for the product image
    const imageUrl = apiData.image ? `https://down-tw.img.susercontent.com/file/${apiData.image}` : null

    return { price, originalPrice, discount, inStock, imageUrl, screenshot }
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

  const isMac = process.platform === 'darwin'
  const browser = await puppeteer.launch({
    headless: isMac ? false : true,
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

        // Update Target with latest image URL if available
        if (data.imageUrl && target.imageUrl !== data.imageUrl) {
          await prisma.shopeeTarget.update({
            where: { id: target.id },
            data: { imageUrl: data.imageUrl }
          })
          console.log('  📸 Image URL updated in database.')
        }

        await prisma.shopeePriceHistory.create({
          data: {
            targetId:      target.id,
            price:         data.price,
            originalPrice: data.originalPrice,
            discount:      data.discount,
            inStock:       data.inStock,
            screenshot:    data.screenshot,
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

        console.log(`  ⏳ Waiting 25 to 45 seconds before the next product to mimic human reading...`)
        await sleep(25000 + Math.random() * 20000)
      } catch (err: any) {
        console.error(`  ❌ Error: ${err.message}`)
        await sleep(30000)
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
