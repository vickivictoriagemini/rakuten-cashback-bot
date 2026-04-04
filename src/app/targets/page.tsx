"use client"

import { useState, useEffect } from 'react'

interface Target {
  id: number
  name: string
  keyword: string
  threshold: number
  createdAt: string
  chatId?: string | null
}

interface Subscriber {
  id: string
  chatId: string
  name: string | null
  source: string | null
  joinedAt: string
  targets: Target[]
}

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form state
  const [name, setName] = useState('')
  const [keyword, setKeyword] = useState('')
  const [threshold, setThreshold] = useState('')

  const [subscriberSearch, setSubscriberSearch] = useState('')

  const [mounted, setMounted] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    const [resTargets, resSubs] = await Promise.all([
      fetch('/api/targets'),
      fetch('/api/subscribers')
    ])
    
    if (resTargets.ok) {
      const data: Target[] = await resTargets.json()
      // The old view only shows Global watchlists (where chatId is null or empty)
      setTargets(data.filter(t => !t.chatId))
    }
    
    if (resSubs.ok) {
      setSubscribers(await resSubs.json())
    }
    setIsLoading(false)
  }

  useEffect(() => {
    setMounted(true)
    fetchData()
  }, [])

  if (!mounted) {
    return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading Interface...</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, keyword, threshold, chatId: null }) // Global targets have null chatId
    })

    if (res.ok) {
      setName('')
      setKeyword('')
      setThreshold('')
      fetchData()
    }
  }

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/targets/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchData()
    }
  }

  const filteredSubscribers = subscribers.filter(sub => 
    (sub.name?.toLowerCase() || '').includes(subscriberSearch.toLowerCase()) || 
    sub.chatId.includes(subscriberSearch)
  )

  return (
    <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', alignItems: 'start' }}>
      <div className="glass-panel animate-fade-in delay-1" style={{ position: 'sticky', top: '16px' }}>
        <h2>Add Focus Target</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="input-group">
            <label>Store Name (e.g. Nike)</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              placeholder="Nike US" 
            />
          </div>
          <div className="input-group">
            <label>Keyword to Match (e.g. nike)</label>
            <input 
              type="text" 
              value={keyword} 
              onChange={e => setKeyword(e.target.value)} 
              required 
              placeholder="nike" 
            />
          </div>
          <div className="input-group">
            <label>Target Threshold % (e.g. 15.0)</label>
            <input 
              type="number" 
              step="0.1" 
              value={threshold} 
              onChange={e => setThreshold(e.target.value)} 
              required 
              placeholder="15.0" 
            />
          </div>
          <button type="submit" className="btn w-full">Save Target</button>
        </form>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Global Targets Panel */}
        <div className="glass-panel animate-fade-in delay-2">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🌐</span> Global Admin Watchlist
          </h2>
          <p className="text-secondary" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
            Stores listed here will be pushed to ALL subscribers if the threshold is met.
          </p>
          {isLoading ? (
            <p className="text-secondary">Loading...</p>
          ) : targets.length === 0 ? (
            <p className="text-secondary">No global focus targets configured.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {targets.map(target => (
                <div key={target.id} className="flex-between" style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{target.name}</div>
                    <div className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      Keyword: "{target.keyword}" | Threshold: {target.threshold}%
                    </div>
                  </div>
                  <button onClick={() => handleDelete(target.id)} className="btn btn-danger" style={{ padding: '8px 16px' }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Community Subscribers Panel */}
        <div className="glass-panel animate-fade-in delay-3" style={{ background: 'rgba(25, 30, 45, 0.7)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <span style={{ fontSize: '1.2rem' }}>👥</span> Subscribers
            </h2>
            <div style={{ flex: '1', maxWidth: '300px', marginLeft: '16px' }}>
              <input 
                type="text" 
                placeholder="Search name or ID..." 
                value={subscriberSearch}
                onChange={e => setSubscriberSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
              />
            </div>
          </div>
          
          {isLoading ? (
            <p className="text-secondary">Loading...</p>
          ) : subscribers.length === 0 ? (
            <p className="text-secondary">No community members have interacted with the bot yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Subscriber</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Tracked Targets</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscribers.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No matches found.
                      </td>
                    </tr>
                  ) : (
                    filteredSubscribers.map((sub) => (
                      <tr key={sub.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                        <td style={{ padding: '16px', verticalAlign: 'top', borderLeft: '3px solid var(--accent-primary)' }}>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '1.05rem' }}>{sub.name || 'Unknown User'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{sub.chatId}</div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'top' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', textTransform: 'uppercase' }}>
                            {sub.source}
                          </span>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'top' }}>
                          {sub.targets && sub.targets.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {sub.targets.map(t => (
                                <span key={t.id} style={{ fontSize: '0.85rem', background: 'rgba(0,0,0,0.4)', padding: '4px 10px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>
                                  🎯 {t.name} <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>&gt;={t.threshold}%</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              No targets tracked yet.
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
