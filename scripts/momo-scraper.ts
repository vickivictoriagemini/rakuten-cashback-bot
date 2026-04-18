/**
 * scripts/momo-scraper.ts
 *
 * Intercepts Momo's internal API calls made by the browser while loading the product page.
 * This avoids direct API auth issues (403) and page.evaluate() tsx __name bugs.
 *
 * Pi 5 cron: 0 * * * * cd /home/pi/rakuten && npx tsx scripts/momo-scraper.ts >> /home/pi/momo.log 2>&1
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
 * Open the Momo product page with a real browser and extract the price from the DOM.
 */
async function scrapeMomoProduct(url: string, browser: any): Promise<ScrapedProduct> {
  const page = await browser.newPage()

  try {
    await page.setViewport({ width: 1280, height: 800 })
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' })

    // Inject Momo cookies if provided in .env
    const cookieString = process.env.SHOPEE_COOKIES || '' // Re-using env variable for convenience
    if (cookieString) {
      const cookies = cookieString.split(';').map(pair => {
        const [name, ...rest] = pair.trim().split('=')
        return {
          name: name.trim(),
          value: rest.join('=').trim(),
          domain: '.momo.tw',
        }
      }).filter(c => c.name && c.value)
      
      await page.setCookie(...cookies)
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    const finalUrl = page.url()
    console.log(`  Final URL: ${finalUrl}`)

    // 📸 Ultimate Burst Mode: Take 8 screenshots over 4 seconds. Keep the largest one (most content).
    let screenshot = null
    try {
      let bestB64 = ''
      for (let s = 0; s < 8; s++) {
        const b64 = await page.screenshot({ type: 'jpeg', quality: 50, encoding: 'base64' })
        if (b64 && b64.length > bestB64.length) {
          bestB64 = b64
        }
        await sleep(500) // Snap every 0.5s
      }
      if (bestB64) {
        screenshot = `data:image/jpeg;base64,${bestB64}`
      }
    } catch {
      // Ignore
    }

    // ─── Document Data Extraction ───
    const data = await page.evaluate(() => {
      // Momo formats Prices in various ways across A/B test UI versions
      const priceText = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') 
                     || document.querySelector('.priceSymbol + b')?.textContent 
                     || document.querySelector('.price b')?.textContent
                     || document.querySelector('.special .price')?.textContent
                     || null
      
      const price = priceText ? parseInt(priceText.replace(/,/g, ''), 10) : null
      
      const imgNode = document.querySelector('.jqzoom img') || document.querySelector('#goodsImg')
      const imageUrl = imgNode ? imgNode.getAttribute('src') : null
      
      // Stock - if "Add to Cart" exists, it's usually in stock
      const buyBtn = document.querySelector('#buy_addcar') 
      const inStock = !!buyBtn

      return { price, imageUrl, inStock }
    })

    return { 
      price: data.price, 
      originalPrice: null, // Momo hides original price often
      discount: null, 
      inStock: data.inStock, 
      imageUrl: data.imageUrl, 
      screenshot 
    }
  } finally {
    await page.close()
  }
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log('\n===== Momo Scraper =====')
  console.log(`Started at: ${new Date().toISOString()}`)

  const targets = await prisma.momoTarget.findMany({ where: { active: true } })
  console.log(`Found ${targets.length} active target(s).\n`)

  if (targets.length === 0) {
    console.log('No active targets. Add products via Dashboard → Momo page.')
    return
  }

  const settings    = await prisma.systemSetting.findFirst()
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || settings?.telegramChatId || ''

  const isMac = process.platform === 'darwin'
  const forceHeadful = process.env.HEADLESS === 'false'

  const browser = await puppeteer.launch({
    headless: forceHeadful ? false : (isMac ? false : true),
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })

  try {
    for (const target of targets) {
      console.log(`Scraping: ${target.name}`)
      try {
        const data = await scrapeMomoProduct(target.url, browser)

        console.log(`  💰 Price: ${data.price} | Original: ${data.originalPrice} | Discount: ${data.discount} | In Stock: ${data.inStock}`)

        if (data.price === null) {
          console.log('  ⚠️  No price captured. Skipping.')
          await sleep(5000)
          continue
        }

        // Update Target with latest image URL if available
        if (data.imageUrl && target.imageUrl !== data.imageUrl) {
          await prisma.momoTarget.update({
            where: { id: target.id },
            data: { imageUrl: data.imageUrl }
          })
          console.log('  📸 Image URL updated in database.')
        }

        await prisma.momoPriceHistory.create({
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
            `<a href="${target.url}">👉 View on Momo</a>`,
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
    // ─── Auto-Cleanup to save DB space ───
    // A 150KB screenshot saved hourly for 5 items = ~18MB/day. Supabase free tier is 500MB.
    // We keep the price history text forever, but delete the heavy image data after 7 days.
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const cleanupResult = await prisma.momoPriceHistory.updateMany({
      where: {
        screenshot: { not: null },
        scrapedAt:  { lt: sevenDaysAgo }
      },
      data: {
        screenshot: null
      }
    })
    if (cleanupResult.count > 0) {
      console.log(`  🧹 Cleaned up ${cleanupResult.count} old screenshots to save database space.`)
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
