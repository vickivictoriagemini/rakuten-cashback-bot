import { scrapeRakuten } from './rakuten'
import { scrapeCapitalOneShopping } from './capitalOneShopping'
import { ScrapedOffer } from './types'

export type { ScrapedOffer }

export async function runAllScrapers(): Promise<{
  all: ScrapedOffer[]
  bySource: Record<string, ScrapedOffer[]>
}> {
  console.log('Running all scrapers in parallel...')

  const results = await Promise.allSettled([
    scrapeRakuten(),
    scrapeCapitalOneShopping(),
  ])

  const all: ScrapedOffer[] = []
  const bySource: Record<string, ScrapedOffer[]> = {}

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const offers = result.value
      for (const offer of offers) {
        all.push(offer)
        if (!bySource[offer.source]) bySource[offer.source] = []
        bySource[offer.source].push(offer)
      }
    } else {
      console.error('A scraper failed:', result.reason)
    }
  }

  console.log(`All scrapers done. Total offers: ${all.length}`)
  return { all, bySource }
}
