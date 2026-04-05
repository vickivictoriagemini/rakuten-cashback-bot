import 'dotenv/config'
import { runScraper } from './src/services/scraper.js' // wait, it's ts

async function test() {
  console.log("Testing scraper...")
  const result = await runScraper()
  console.log("Result:", JSON.stringify(result, null, 2))
}

test()
