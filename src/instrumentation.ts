export async function register() {
  // Only run in the Node.js server runtime.
  // This is skipped during build time and Edge Runtime.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler')
    startScheduler()
  }
}
