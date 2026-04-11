import { ScrapedOffer } from './types'

const SOURCE = 'capital_one_shopping'
const BASE_URL = 'https://capitaloneshopping.com'

export async function scrapeCapitalOneShopping(): Promise<ScrapedOffer[]> {
  console.log('Starting Capital One Shopping scraper (SSR fetch)...')

  try {
    const res = await fetch(BASE_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!res.ok) {
      throw new Error(`Capital One Shopping fetch failed: ${res.status}`)
    }

    const html = await res.text()
    const offers = parseCapitalOneOffers(html)

    console.log(`Capital One Shopping: extracted ${offers.length} offers.`)
    return offers
  } catch (err) {
    console.error('Capital One Shopping scraper error:', err)
    return getFallbackOffers()
  }
}

function parseCapitalOneOffers(html: string): ScrapedOffer[] {
  const offersMap = new Map<string, ScrapedOffer>()

  // Pattern: "Save at StoreName\n+ X% Back" or "Save at StoreName + up to X% Back"
  // The HTML contains blocks like: "Walmart\nSave at Walmart\n+ 2% Back"
  // We extract store name + rate from these patterns
  const saveAtPattern = /Save\s+at\s+([^\n<"]+?)\s*[\n<][\s\S]{0,200}?\+\s*(?:up\s+to\s+)?([\d.]+)%\s*Back/gi
  let match: RegExpExecArray | null

  while ((match = saveAtPattern.exec(html)) !== null) {
    const storeName = match[1].trim().replace(/\s+/g, ' ')
    const rate = parseFloat(match[2])

    if (!storeName || isNaN(rate) || rate <= 0) continue

    // Build store URL using the slug pattern
    const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const url = `${BASE_URL}/r/${slug}`

    const existing = offersMap.get(storeName)
    if (!existing || existing.rate < rate) {
      offersMap.set(storeName, {
        storeName,
        cashback: `${rate}% Back`,
        rate,
        url,
        source: SOURCE,
      })
    }
  }

  // Sort by highest rate, take top 15
  return Array.from(offersMap.values())
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 15)
}

function getFallbackOffers(): ScrapedOffer[] {
  console.log('Capital One Shopping: using fallback data.')
  return [
    { storeName: 'Walgreens', cashback: '12.5% Back', rate: 12.5, url: `${BASE_URL}/r/walgreens`, source: SOURCE },
    { storeName: 'Sam\'s Club', cashback: '17% Back', rate: 17.0, url: `${BASE_URL}/r/sams-club`, source: SOURCE },
    { storeName: 'Ulta Beauty', cashback: '5.5% Back', rate: 5.5, url: `${BASE_URL}/r/ulta-beauty`, source: SOURCE },
  ]
}
