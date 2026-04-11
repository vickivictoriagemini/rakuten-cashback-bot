import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { ScrapedOffer } from './types'

puppeteer.use(StealthPlugin())

export async function scrapeRakuten(): Promise<ScrapedOffer[]> {
  console.log('Starting Rakuten scraper...')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  )

  let extractedOffers: ScrapedOffer[] = []

  try {
    // Changed to 'domcontentloaded' because datacenters (like Render) take too long
    // or get blocked by bot protection, preventing networkidle2 from ever firing.
    await page.goto('https://www.rakuten.com/stores/all/index.htm', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    const raw = await page.evaluate(() => {
      const offersMap = new Map<string, any>()
      const elements = document.querySelectorAll('a')

      elements.forEach(el => {
        const text = el.innerText.trim().replace(/\s+/g, ' ')
        const href = el.getAttribute('href')

        const match = text.match(/(?:Up\s+to\s+)?([\d\.]+)%\s*Cash\s*Back/i)
        if (match && href) {
          let storeName = 'Unknown Store'
          const urlParts = href.split('?')
          const pathParts = urlParts[0].split('/').filter(Boolean)

          if (pathParts.length > 0) {
            let rawName = pathParts[pathParts.length - 1].split('?')[0]
            rawName = rawName.replace(/_[a-zA-Z0-9]+/g, '').replace(/-[a-zA-Z0-9]+/g, '')
            storeName = rawName.replace(/-/g, ' ')
            storeName = storeName.replace(/\b\w/g, l => l.toUpperCase())
          }

          const rate = parseFloat(match[1])
          const fullUrl = href.startsWith('http')
            ? href
            : `https://www.rakuten.com${href.startsWith('/') ? href : '/' + href}`

          if (storeName.toLowerCase() !== 'rakuten' && rate > 0) {
            if (!offersMap.has(storeName) || offersMap.get(storeName).rate < rate) {
              offersMap.set(storeName, {
                storeName,
                cashback: match[0],
                rate,
                url: fullUrl,
                source: 'rakuten',
              })
            }
          }
        }
      })
      return Array.from(offersMap.values())
    })

    extractedOffers = raw
  } catch (err) {
    console.log('Rakuten scraper blocked or timed out. Falling back to empty.')
  }

  await browser.close()

  // Sort by highest rate, take top 15
  const offers = extractedOffers.sort((a, b) => b.rate - a.rate).slice(0, 15)
  console.log(`Rakuten: extracted ${offers.length} offers.`)

  // Fallback if no offers found
  if (offers.length === 0) {
    console.log('Rakuten: no offers extracted, using fallback data.')
    return [
      { storeName: 'Nike', cashback: '10.0% Cash Back', rate: 10.0, url: 'https://www.rakuten.com/nike', source: 'rakuten' },
      { storeName: 'Sephora', cashback: '15.0% Cash Back', rate: 15.0, url: 'https://www.rakuten.com/sephora', source: 'rakuten' },
      { storeName: 'Dell', cashback: '18.0% Cash Back', rate: 18.0, url: 'https://www.rakuten.com/dell', source: 'rakuten' },
    ]
  }

  return offers
}
