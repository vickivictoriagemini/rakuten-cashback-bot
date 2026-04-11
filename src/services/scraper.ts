import { prisma } from '@/lib/prisma'
import { sendTelegramMessage } from './telegram'
import { runAllScrapers, ScrapedOffer } from './scrapers/index'

const SOURCE_LABELS: Record<string, string> = {
  rakuten: '🔶 Rakuten',
  capital_one_shopping: '🔷 Capital One Shopping',
}

export type { ScrapedOffer }

export async function runScraper() {
  try {
    const settings = await prisma.systemSetting.findFirst()
    const globalThreshold = settings?.globalThreshold ?? 15.0
    const focusTargets = await prisma.focusTarget.findMany()

    // --- Run all scrapers ---
    const { all: allOffers, bySource } = await runAllScrapers()

    // --- Save to DB ---
    for (const offer of allOffers) {
      await prisma.storeOffer.create({
        data: {
          storeName: offer.storeName,
          cashback: offer.cashback,
          rate: offer.rate,
          url: offer.url,
          source: offer.source,
        },
      })
    }

    // --- Broadcast to each subscriber ---
    const subscribers = await prisma.telegramSubscriber.findMany()
    const chatIds = new Set<string>()
    if (settings?.telegramChatId) chatIds.add(settings.telegramChatId.toString())
    subscribers.forEach((sub: any) => chatIds.add(sub.chatId))

    let sentCount = 0

    for (const chatId of chatIds) {
      const myTargets = focusTargets.filter(
        (t: any) => t.chatId === chatId || t.chatId === null || t.chatId === ''
      )

      const message = buildMessage(allOffers, bySource, myTargets, globalThreshold)

      if (message) {
        const sent = await sendTelegramMessage(chatId, message)
        if (sent) sentCount++
      }
    }

    await prisma.scrapeLog.create({
      data: {
        status: 'SUCCESS',
        message: `Scraped ${allOffers.length} offers from ${Object.keys(bySource).length} sources. Sent to ${sentCount} users.`,
      },
    })

    return { success: true, offers: allOffers }
  } catch (error) {
    console.error('Scraper Error:', error)
    await prisma.scrapeLog.create({
      data: {
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    return { success: false, error }
  }
}

function buildMessage(
  allOffers: ScrapedOffer[],
  bySource: Record<string, ScrapedOffer[]>,
  myTargets: any[],
  globalThreshold: number
): string {
  let message = '📊 *Daily Cashback Review* 📊\n\n'
  let hasContent = false

  // --- Top picks per source ---
  for (const [source, offers] of Object.entries(bySource)) {
    if (offers.length === 0) continue
    hasContent = true
    const label = SOURCE_LABELS[source] ?? source
    const top3 = offers.slice(0, 3)
    const medals = ['🥇', '🥈', '🥉']
    message += `${label} *Top Picks*:\n`
    top3.forEach((o, i) => {
      message += `${medals[i]} <a href="${o.url}"><b>${o.storeName}</b></a>: ${o.cashback}\n`
    })
    message += '\n'
  }

  // --- High cashback across all platforms ---
  const highValue = allOffers.filter(o => o.rate >= globalThreshold)
  if (highValue.length > 0) {
    hasContent = true
    message += `🔥 *High Cashback (>= ${globalThreshold}%)*:\n`
    highValue.forEach(o => {
      const label = SOURCE_LABELS[o.source] ?? o.source
      message += `- <a href="${o.url}"><b>${o.storeName}</b></a>: ${o.cashback} (${label})\n`
    })
    message += '\n'
  }

  // --- Focus targets ---
  const triggered: { target: any; offer: ScrapedOffer }[] = []
  for (const offer of allOffers) {
    for (const target of myTargets) {
      if (
        offer.storeName.toLowerCase().includes(target.keyword.toLowerCase()) &&
        offer.rate >= target.threshold
      ) {
        triggered.push({ target, offer })
        break
      }
    }
  }

  if (triggered.length > 0) {
    hasContent = true
    message += `🎯 *Focus Targets Reached*:\n`
    triggered.forEach(({ target, offer }) => {
      message += `✅ <a href="${offer.url}"><b>${target.name}</b></a> reached: ${offer.cashback} (Threshold: ${target.threshold}%)\n`
    })
  }

  return hasContent ? message : ''
}
