import cron, { ScheduledTask } from 'node-cron'
import { runScraper } from '@/services/scraper'
import { prisma } from '@/lib/prisma'

let currentTask: ScheduledTask | null = null
let isInitialized = false

/** Parse "HH:MM" → { hour, minute } */
function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number)
  return { hour: isNaN(h) ? 9 : h, minute: isNaN(m) ? 0 : m }
}

/** (Re)schedule the daily scrape from the current DB settings. */
export async function reschedule() {
  // Stop any running task first
  if (currentTask) {
    currentTask.stop()
    currentTask = null
  }

  const settings = await prisma.systemSetting.findFirst()
  const time = settings?.scheduleTime ?? '09:00'
  const enabled = settings?.scheduleEnabled ?? true

  if (!enabled) {
    console.log('⏸️  [Scheduler] Schedule is disabled — no task registered.')
    return
  }

  const { hour, minute } = parseTime(time)
  const expression = `${minute} ${hour} * * *`

  currentTask = cron.schedule(expression, async () => {
    console.log(`⏰ [Scheduler] Daily scrape triggered at ${new Date().toISOString()}`)
    try {
      const result = await runScraper()
      console.log('✅ [Scheduler] Scrape completed:', result)
    } catch (err) {
      console.error('❌ [Scheduler] Scrape failed:', err)
    }
  }, { timezone: 'Asia/Tokyo' })

  console.log(`✅ [Scheduler] Scheduled at ${time} Asia/Tokyo (cron: "${expression}")`)
}

/** Called once on server boot. */
export async function startScheduler() {
  if (isInitialized) {
    console.log('⏭️  [Scheduler] Already initialized, skipping.')
    return
  }
  isInitialized = true
  await reschedule()
}
