import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Rakuten Cron Dashboard',
  description: 'Smart cashback tracker and Telegram notifier',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="animate-fade-in">
            <h1>Rakuten Tracker</h1>
            <nav className="glass-panel" style={{ padding: '8px 16px', marginBottom: '32px' }}>
              <Link href="/">Overview</Link>
              <Link href="/targets">Watchlist</Link>
              <Link href="/settings">Settings</Link>
            </nav>
          </header>
          <main>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
