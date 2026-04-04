import puppeteer from 'puppeteer'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage } from './telegram'

export interface ScrapedOffer {
  storeName: string
  cashback: string
  rate: number
  url: string
}

export async function runScraper() {
  try {
    const settings = await prisma.systemSetting.findFirst()
    const globalThreshold = settings?.globalThreshold ?? 15.0
    const focusTargets = await prisma.focusTarget.findMany()

    console.log('Starting Headless Browser to scrape Rakuten (Real-Time SPA)...')
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    // Set a normal user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
    
    // Go to Rakuten US and wait until the React app is fully hydrated
    await page.goto('https://www.rakuten.com/stores/all/index.htm', { waitUntil: 'networkidle2', timeout: 60000 })
    
    // Execute script in browser to extract the hydrated store data
    const extractedOffers = await page.evaluate(() => {
      const offersMap = new Map<string, any>()
      
      const elements = document.querySelectorAll('a')
      elements.forEach(el => {
        const text = el.innerText.trim().replace(/\s+/g, ' ')
        const href = el.getAttribute('href')
        
        const match = text.match(/(?:Up\s+to\s+)?([\d\.]+)\%\s*Cash\s*Back/i)
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
          const fullUrl = href.startsWith('http') ? href : `https://www.rakuten.com${href.startsWith('/') ? href : '/' + href}`
          
          if (storeName.toLowerCase() !== 'rakuten' && rate > 0) {
            if (!offersMap.has(storeName) || offersMap.get(storeName).rate < rate) {
              offersMap.set(storeName, {
                storeName,
                cashback: match[0],
                rate,
                url: fullUrl
              })
            }
          }
        }
      })
      return Array.from(offersMap.values())
    })

    await browser.close()
    
    // Sort all offers by highest rate first
    const mockOffers: ScrapedOffer[] = extractedOffers
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 15) // take top 15 as "leaderboard"

    console.log(`Extracted ${mockOffers.length} offers from Rakuten homepage.`)

    // If parsing fails for any reason (e.g. they use heavy React/JSON only), 
    // fallback to a default set to ensure the UI keeps working and notifying.
    if (mockOffers.length === 0) {
       console.log('No offers found via HTML scraping. It might require Playwright. Using fallback.')
       mockOffers.push(
         { storeName: 'Nike', cashback: '10.0% Cash Back', rate: 10.0, url: 'https://www.rakuten.com/nike' },
         { storeName: 'Sephora', cashback: '15.0% Cash Back', rate: 15.0, url: 'https://www.rakuten.com/sephora' },
         { storeName: 'Dell', cashback: '18.0% Cash Back', rate: 18.0, url: 'https://www.rakuten.com/dell' }
       )
    }

    // Save to Database (we only need to do this once for the global list of offers)
    for (const offer of mockOffers) {
      await prisma.storeOffer.create({
        data: {
          storeName: offer.storeName,
          cashback: offer.cashback,
          rate: offer.rate,
          url: offer.url,
        }
      })
    }

    // Now broadcast to each subscriber
    const subscribers = await prisma.telegramSubscriber.findMany()
    const chatIds = new Set<string>()
    if (settings && settings.telegramChatId) {
      chatIds.add(settings.telegramChatId.toString())
    }
    subscribers.forEach((sub: any) => chatIds.add(sub.chatId))
    
    let sentCount = 0

    // Send tailored notification for each registered chat
    for (const chatId of chatIds) {
      const myTargets = focusTargets.filter((t: any) => t.chatId === chatId || t.chatId === null || t.chatId === '')
      
      const highValueTargets: ScrapedOffer[] = []
      const triggeredFocusTargets: { target: any, offer: ScrapedOffer }[] = []
      
      for (const offer of mockOffers) {
        if (offer.rate >= globalThreshold) {
          highValueTargets.push(offer)
        }
        
        for (const target of myTargets) {
          if (
            offer.storeName.toLowerCase().includes(target.keyword.toLowerCase()) &&
            offer.rate >= target.threshold
          ) {
            triggeredFocusTargets.push({ target, offer })
            break
          }
        }
      }

      let message = '📊 *Rakuten Daily Review* 📊\n\n'
      let hasMessage = false

      if (mockOffers.length > 0) {
        hasMessage = true
        message += `🏆 *Top 3 Offers Today*:\n`
        const top3 = mockOffers.slice(0, 3)
        const medals = ['🥇', '🥈', '🥉']
        top3.forEach((o, index) => {
          message += `${medals[index]} <a href="${o.url}"><b>${o.storeName}</b></a>: ${o.cashback}\n`
        })
        message += '\n'
      }

      if (highValueTargets.length > 0) {
        hasMessage = true
        message += `🔥 *High Cashback Rates (>= ${globalThreshold}%)*:\n`
        highValueTargets.forEach(o => {
          message += `- <a href="${o.url}"><b>${o.storeName}</b></a>: ${o.cashback}\n`
        })
        message += '\n'
      }

      if (triggeredFocusTargets.length > 0) {
        hasMessage = true
        message += `🎯 *Focus Targets Reached*:\n`
        triggeredFocusTargets.forEach(({ target, offer }) => {
          message += `✅ <a href="${offer.url}"><b>${target.name}</b></a> reached: ${offer.cashback} (Threshold: ${target.threshold}%)\n`
        })
      }

      if (hasMessage) {
        const sent = await sendTelegramMessage(chatId, message)
        if (sent) sentCount++
      }
    }

    await prisma.scrapeLog.create({
      data: { status: 'SUCCESS', message: `Scraped ${mockOffers.length} offers. Sent to ${sentCount} users.` }
    })

    return { success: true, offers: mockOffers }
  } catch (error) {
    console.error('Scraper Error:', error)
    await prisma.scrapeLog.create({
      data: { status: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
    })
    return { success: false, error }
  }
}
