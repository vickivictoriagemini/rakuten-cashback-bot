import cron from 'node-cron'
import { runScraper } from '@/services/scraper'

let isSchedulerStarted = false

export function startScheduler() {
  // Guard: only start once, even if Next.js hot-reloads this module
  if (isSchedulerStarted) {
    console.log('⏭️  Scheduler already running, skipping duplicate start.')
    return
  }
  isSchedulerStarted = true

  // Run every day at 09:00 Japan/Taiwan time (Asia/Tokyo = UTC+9)
  // Cron format: minute hour day month weekday
  cron.schedule('0 9 * * *', async () => {
    console.log(`⏰ [Scheduler] Daily scrape triggered at ${new Date().toISOString()}`)
    try {
      const result = await runScraper()
      console.log('✅ [Scheduler] Scrape completed:', result)
    } catch (err) {
      console.error('❌ [Scheduler] Scrape failed:', err)
    }
  }, {
    timezone: 'Asia/Tokyo'
  })

  console.log('✅ [Scheduler] Started — daily scrape scheduled at 09:00 Asia/Tokyo')
}
