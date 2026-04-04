import { prisma } from '@/lib/prisma'
import { formatDistanceToNow } from 'date-fns'
import RefreshButton from '@/components/RefreshButton'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const latestLog = await prisma.scrapeLog.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  
  const recentOffers = await prisma.storeOffer.findMany({
    orderBy: { date: 'desc' },
    take: 10
  })

  // To count triggers per day, mock dashboard stats
  const totalOffersToday = await prisma.storeOffer.count({
    where: {
      date: {
        gte: new Date(new Date().setHours(0,0,0,0))
      }
    }
  })

  return (
    <div className="grid">
      <div className="grid-2 animate-fade-in delay-1">
        <div className="glass-panel">
          <h3>Last Scrape Run</h3>
          <p className={latestLog?.status === 'SUCCESS' ? 'text-success' : 'text-danger'} style={{ fontSize: '1.2rem', fontWeight: 600 }}>
            {latestLog?.status || 'Never Run'}
          </p>
          <p className="text-secondary" style={{ marginTop: '8px' }}>
            {latestLog ? formatDistanceToNow(new Date(latestLog.createdAt), { addSuffix: true }) : ''}
          </p>
          {latestLog?.message && (
            <div className="text-secondary" style={{ marginTop: '16px', fontSize: '0.9rem', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              {latestLog.message}
            </div>
          )}
        </div>
        <div className="glass-panel text-center flex-between" style={{ flexDirection: 'column' }}>
          <h3>High Value Offers Found Today</h3>
          <div style={{ fontSize: '3rem', fontWeight: 800 }} className="text-accent">
            {totalOffersToday}
          </div>
          <RefreshButton />
        </div>
      </div>

      <div className="glass-panel animate-fade-in delay-2">
        <div className="flex-between">
          <h2>Recent Offers</h2>
        </div>
        {recentOffers.length === 0 ? (
          <p className="text-secondary" style={{ textAlign: 'center', padding: '40px' }}>No offers scraped yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Store</th>
                <th>Cashback Rate</th>
                <th>Time Scraped</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentOffers.map((offer) => (
                <tr key={offer.id}>
                  <td style={{ fontWeight: 600 }}>{offer.storeName}</td>
                  <td className="text-success">{offer.cashback}</td>
                  <td className="text-secondary">{formatDistanceToNow(new Date(offer.date), { addSuffix: true })}</td>
                  <td>
                    <a href={offer.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                      Visit
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
