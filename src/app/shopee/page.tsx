'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface PriceHistory {
  id: number
  price: number
  originalPrice: number | null
  discount: string | null
  inStock: boolean
  scrapedAt: string
  screenshot: string | null
}

interface ShopeeTarget {
  id: number
  name: string
  url: string
  targetPrice: number
  currency: string
  active: boolean
  createdAt: string
  history: PriceHistory[]
  imageUrl: string | null
}

function PriceBadge({ current, target }: { current: number | null; target: number }) {
  if (current === null) return <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Not scraped yet</span>
  const diff = ((current - target) / target) * 100
  if (current <= target) {
    return <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '1rem' }}>🟢 ${current.toLocaleString()} ✅ Below target!</span>
  } else if (diff <= 10) {
    return <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1rem' }}>🟡 ${current.toLocaleString()} (close!)</span>
  } else {
    return <span style={{ color: '#f87171', fontWeight: 600, fontSize: '1rem' }}>🔴 ${current.toLocaleString()}</span>
  }
}

export default function ShopeePage() {
  const [targets, setTargets] = useState<ShopeeTarget[]>([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [currency, setCurrency] = useState('TWD')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [history, setHistory] = useState<Record<number, PriceHistory[]>>({})

  const fetchTargets = async () => {
    const res = await fetch('/api/shopee/targets')
    if (res.ok) setTargets(await res.json())
  }

  useEffect(() => { fetchTargets() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/shopee/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, targetPrice, currency }),
    })
    if (res.ok) {
      setName(''); setUrl(''); setTargetPrice('')
      setStatus('✅ Product added to watchlist!')
      await fetchTargets()
    } else {
      const err = await res.json()
      setStatus(`❌ ${err.error}`)
    }
    setSaving(false)
    setTimeout(() => setStatus(''), 4000)
  }

  const handleToggle = async (target: ShopeeTarget) => {
    await fetch(`/api/shopee/targets/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !target.active }),
    })
    await fetchTargets()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this product from watchlist?')) return
    await fetch(`/api/shopee/targets/${id}`, { method: 'DELETE' })
    setTargets(prev => prev.filter(t => t.id !== id))
  }

  const toggleHistory = async (targetId: number) => {
    if (expandedId === targetId) { setExpandedId(null); return }
    setExpandedId(targetId)
    if (!history[targetId]) {
      const res = await fetch(`/api/shopee/history/${targetId}`)
      if (res.ok) {
        const data = await res.json()
        setHistory(prev => ({ ...prev, [targetId]: data }))
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Add Product Form */}
      <div className="glass-panel animate-fade-in delay-1">
        <h2>🛒 Add Product to Watchlist</h2>
        <p className="text-secondary" style={{ marginBottom: '20px', lineHeight: 1.6 }}>
          Paste a Shopee product URL. Your Pi 5 will check the price hourly and alert you when it drops below your target.
        </p>

        {status && (
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '16px' }}>
            {status}
          </div>
        )}

        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
              <label>Product Name</label>
              <input type="text" placeholder="e.g. AirPods Pro" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="input-group" style={{ flex: '1 1 100px', marginBottom: 0 }}>
              <label>Target Price</label>
              <input type="number" step="1" placeholder="e.g. 5000" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} required />
            </div>
            <div className="input-group" style={{ flex: '0 0 90px', marginBottom: 0 }}>
              <label>Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '0.9rem' }}
              >
                <option value="TWD" style={{ background: '#1a1a2e' }}>TWD</option>
                <option value="JPY" style={{ background: '#1a1a2e' }}>JPY</option>
                <option value="USD" style={{ background: '#1a1a2e' }}>USD</option>
              </select>
            </div>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Shopee Product URL</label>
            <input type="url" placeholder="https://shopee.tw/product/..." value={url} onChange={e => setUrl(e.target.value)} required />
          </div>
          <button type="submit" className="btn" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Adding…' : '+ Add to Watchlist'}
          </button>
        </form>
      </div>

      {/* Watchlist */}
      <div className="glass-panel animate-fade-in delay-2">
        <h2 style={{ marginBottom: '20px' }}>
          Watchlist <span className="text-secondary" style={{ fontSize: '0.85rem', fontWeight: 400 }}>({targets.length} products)</span>
        </h2>

        {targets.length === 0 ? (
          <p className="text-secondary" style={{ textAlign: 'center', padding: '40px' }}>
            No products yet. Add a Shopee product URL above to start monitoring!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {targets.map(target => {
              const latest = target.history[0] ?? null
              const isExpanded = expandedId === target.id
              return (
                <div key={target.id} style={{
                  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                  background: target.active ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
                  overflow: 'hidden',
                  opacity: target.active ? 1 : 0.5,
                }}>
                  {/* Main row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', flexWrap: 'wrap' }}>
                    {target.imageUrl && (
                      <div style={{ flexShrink: 0, width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                        <img src={target.imageUrl} alt={target.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
                        {target.name}
                        {!target.active && <span style={{ marginLeft: '8px', fontSize: '0.75rem', opacity: 0.6 }}>(paused)</span>}
                      </div>
                      <PriceBadge current={latest?.price ?? null} target={target.targetPrice} />
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>
                      <div>Target: <strong style={{ color: '#fff' }}>{target.currency} {target.targetPrice.toLocaleString()}</strong></div>
                      {latest && (
                        <div style={{ marginTop: '2px' }}>
                          Updated {formatDistanceToNow(new Date(latest.scrapedAt), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => toggleHistory(target.id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        {isExpanded ? 'Hide' : 'History'}
                      </button>
                      <a href={target.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        Visit
                      </a>
                      <button
                        onClick={() => handleToggle(target)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        {target.active ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => handleDelete(target.id)}
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', color: '#f87171', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Price history */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}>
                      {(history[target.id] ?? []).length === 0 ? (
                        <p className="text-secondary" style={{ margin: 0, fontSize: '0.85rem' }}>No price history yet. Run the Pi 5 scraper to start collecting data.</p>
                      ) : (
                        <table style={{ width: '100%', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                              <th style={{ paddingBottom: '8px', fontWeight: 600 }}>Time</th>
                              <th style={{ paddingBottom: '8px', fontWeight: 600 }}>Price</th>
                              <th style={{ paddingBottom: '8px', fontWeight: 600 }}>Original</th>
                              <th style={{ paddingBottom: '8px', fontWeight: 600 }}>Discount</th>
                              <th style={{ paddingBottom: '8px', fontWeight: 600 }}>Stock</th>
                              <th style={{ paddingBottom: '8px', fontWeight: 600 }}>Screenshot</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(history[target.id] ?? []).map(h => (
                              <tr key={h.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '6px 0', color: 'rgba(255,255,255,0.5)' }}>{formatDistanceToNow(new Date(h.scrapedAt), { addSuffix: true })}</td>
                                <td style={{ padding: '6px 0', fontWeight: 600, color: h.price <= target.targetPrice ? '#4ade80' : '#fff' }}>
                                  {target.currency} {h.price.toLocaleString()}
                                </td>
                                <td style={{ padding: '6px 0', color: 'rgba(255,255,255,0.5)' }}>{h.originalPrice ? `${target.currency} ${h.originalPrice.toLocaleString()}` : '—'}</td>
                                <td style={{ padding: '6px 0', color: '#fbbf24' }}>{h.discount ?? '—'}</td>
                                <td style={{ padding: '6px 0' }}>
                                  <span style={{ color: h.inStock ? '#4ade80' : '#f87171' }}>{h.inStock ? 'In Stock' : 'Out'}</span>
                                </td>
                                <td style={{ padding: '6px 0' }}>
                                  {h.screenshot ? (
                                    <a href={h.screenshot} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline', fontSize: '0.8rem' }}>
                                      View
                                    </a>
                                  ) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pi 5 Setup Instructions */}
      <div className="glass-panel animate-fade-in delay-3" style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
        <h3>⚙️ Pi 5 Scraper Setup</h3>
        <p className="text-secondary" style={{ marginBottom: '16px', lineHeight: 1.6 }}>
          The scraper runs on your Pi 5 at home (using your residential IP to bypass Shopee's bot protection). Run these once to set it up:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            '# 1. Install Node.js on Pi 5 (if not already)',
            'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs',
            '',
            '# 2. Clone the repo and install dependencies',
            'git clone https://github.com/vickivictoriagemini/rakuten-cashback-bot.git ~/rakuten',
            'cd ~/rakuten && npm install',
            '',
            '# 3. Create .env file with your Supabase URL',
            'echo \'DATABASE_URL="postgresql://..."\' > ~/rakuten/.env',
            'echo \'TELEGRAM_BOT_TOKEN="..."\' >> ~/rakuten/.env',
            '',
            '# 4. Test the scraper manually',
            'cd ~/rakuten && npx tsx scripts/shopee-scraper.ts',
            '',
            '# 5. Add to crontab (run hourly)',
            'crontab -e',
            '# Add: 0 * * * * cd /home/pi/rakuten && npx tsx scripts/shopee-scraper.ts >> /home/pi/shopee.log 2>&1',
          ].map((line, i) => (
            <code key={i} style={{
              display: 'block',
              padding: line === '' ? '2px' : '4px 12px',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              background: line.startsWith('#') ? 'transparent' : 'rgba(0,0,0,0.3)',
              borderRadius: line.startsWith('#') ? 0 : '6px',
              color: line.startsWith('#') ? 'rgba(255,255,255,0.4)' : '#a5f3fc',
            }}>{line || ' '}</code>
          ))}
        </div>
      </div>
    </div>
  )
}
