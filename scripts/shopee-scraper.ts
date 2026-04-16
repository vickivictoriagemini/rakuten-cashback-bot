/**
 * scripts/shopee-scraper.ts
 *
 * Run this on your Pi 5 (residential IP) to scrape Shopee product prices.
 * Pi 5 cron: 0 * * * * cd /home/pi/rakuten && npx tsx scripts/shopee-scraper.ts >> /home/pi/shopee.log 2>&1
 *
 * Requirements:
 *   - Node.js 20+ installed on Pi 5
 *   - .env file with DATABASE_URL and TELEGRAM_BOT_TOKEN
 *   - npm install (once)
 */

import 'dotenv/config'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { PrismaClient } from '@prisma/client'

puppeteer.use(StealthPlugin())

const prisma = new PrismaClient()
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const ADMIN_CHAT_ID  = process.env.TELEGRAM_ADMIN_CHAT_ID ?? '' // optional: direct admin notification

// ─── Helpers ──────────────────────────────────────────────

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

// ─── Shopee scraping ─────────────────────────────────────

interface ScrapedProduct {
  price: number | null
  originalPrice: number | null
  discount: string | null
  inStock: boolean
}

async function scrapeShopeeProduct(url: string, browser: any): Promise<ScrapedProduct> {
  const page = await browser.newPage()

  try {
    // Set viewport and user agent like a real mobile browser
    await page.setViewport({ width: 1280, height: 800 })
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })

    // Wait for price element (Shopee renders prices via React)
    await page.waitForSelector('[class*="price"]', { timeout: 20000 }).catch(() => null)

    // Give JS a moment to fully render
    await sleep(2000)

    const result = await page.evaluate(() => {
      const toPrice = (el: Element | null): number | null => {
        if (!el) return null
        const t = el.textContent?.replace(/[^\d.]/g, '') ?? ''
        const n = parseFloat(t)
        return isNaN(n) ? null : n
      }

      const q = (selectors: string[]): Element | null => {
        for (const s of selectors) {
          const el = document.querySelector(s)
          if (el) return el
        }
        return null
      }

      const priceEl = q([
        '[class*="pricePaid"]',
        '[class*="price-current"]',
        '[class*="current-price"]',
        '[class*="product-price"]',
        '[data-squid-id*="price"]',
        '[class*="sDq_FX"]',   // common Shopee TW class
        '[class*="Z6WM8h"]',
      ])

      const origEl = q([
        '[class*="priceOriginal"]',
        '[class*="price-before-discount"]',
        '[class*="price-org"]',
        '[class*="YKiqKD"]',
      ])

      const discountEl = q([
        '[class*="discountTag"]',
        '[class*="discount"]',
        '[class*="off-tag"]',
        '[class*="RvFDLR"]',
      ])

      const bodyText = document.body.textContent?.toLowerCase() ?? ''
      const inStock = !bodyText.includes('已售完') &&
                      !bodyText.includes('out of stock') &&
                      !bodyText.includes('售完') &&
                      !bodyText.includes('缺貨')

      return {
        price: toPrice(priceEl),
        originalPrice: toPrice(origEl),
        discount: discountEl?.textContent?.trim() ?? null,
        inStock,
      }
    })

    return result
  } finally {
    await page.close()
  }
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log(`\n===== Shopee Scraper =====`)
  console.log(`Started at: ${new Date().toISOString()}`)

  const targets = await prisma.shopeeTarget.findMany({ where: { active: true } })
  console.log(`Found ${targets.length} active target(s).\n`)

  if (targets.length === 0) {
    console.log('No active targets. Add products via the Dashboard → Shopee page.')
    return
  }

  // Fetch admin chat ID from settings if not set in env
  const settings = await prisma.systemSetting.findFirst()
  const adminChatId = ADMIN_CHAT_ID || settings?.telegramChatId || ''

  const browser = await puppeteer.launch({
    headless: true,
    // On ARM64 (Raspberry Pi), set PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
    // Puppeteer's bundled Chrome is x86_64 only and won't run on ARM.
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })

  try {
    for (const target of targets) {
      console.log(`Scraping: ${target.name} (${target.url})`)
      try {
        const data = await scrapeShopeeProduct(target.url, browser)

        console.log(`  Price: ${data.price}, Original: ${data.originalPrice}, Discount: ${data.discount}, In Stock: ${data.inStock}`)

        if (data.price === null) {
          console.log('  ⚠️  Could not extract price (Cloudflare or layout change). Skipping.')
          await sleep(5000)
          continue
        }

        // Save price history
        await prisma.shopeePriceHistory.create({
          data: {
            targetId: target.id,
            price: data.price,
            originalPrice: data.originalPrice,
            discount: data.discount,
            inStock: data.inStock,
          },
        })

        // Send alert if price is at or below target
        if (data.price <= target.targetPrice && adminChatId) {
          const msg = [
            `🛒 <b>Price Alert!</b>`,
            ``,
            `<b>${target.name}</b> dropped to <b>${target.currency} ${data.price.toLocaleString()}</b>`,
            `Your target: ${target.currency} ${target.targetPrice.toLocaleString()}`,
            data.discount ? `Discount: ${data.discount}` : '',
            data.originalPrice ? `Original price: ${target.currency} ${data.originalPrice.toLocaleString()}` : '',
            ``,
            `<a href="${target.url}">👉 View on Shopee</a>`,
          ].filter(Boolean).join('\n')

          console.log(`  🔔 Price at/below target! Sending Telegram alert...`)
          await sendTelegram(adminChatId, msg)
        }

        // Rate-limit between requests
        await sleep(4000 + Math.random() * 3000)
      } catch (err) {
        console.error(`  ❌ Error scraping ${target.name}:`, err)
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
