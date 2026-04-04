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

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [subscriberSearch, setSubscriberSearch] = useState('')
  const [mounted, setMounted] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    const res = await fetch('/api/subscribers')
    if (res.ok) {
      setSubscribers(await res.json())
    }
    setIsLoading(false)
  }

  useEffect(() => {
    setMounted(true)
    fetchData()
  }, [])

  if (!mounted) {
    return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading Subscribers...</div>
  }

  const filteredSubscribers = subscribers.filter(sub => 
    (sub.name?.toLowerCase() || '').includes(subscriberSearch.toLowerCase()) || 
    sub.chatId.includes(subscriberSearch)
  )

  return (
    <div className="glass-panel animate-fade-in delay-1" style={{ background: 'rgba(25, 30, 45, 0.7)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <span style={{ fontSize: '1.4rem' }}>👥</span> Community Subscribers
        </h2>
        <div style={{ flex: '1', minWidth: '250px', maxWidth: '400px' }}>
          <input 
            type="text" 
            placeholder="Search by name or Chat ID..." 
            value={subscriberSearch}
            onChange={e => setSubscriberSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem' }}
          />
        </div>
      </div>
      
      {isLoading ? (
        <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading community data...</div>
      ) : subscribers.length === 0 ? (
        <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No community members have interacted with the bot yet.</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-muted)', width: '25%' }}>Subscriber Info</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-muted)', width: '15%' }}>Platform Source</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-muted)' }}>Personal Tracked Targets</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No matches found for "{subscriberSearch}".
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                    <td style={{ padding: '20px 16px', verticalAlign: 'top', borderLeft: '3px solid var(--accent-primary)' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '1.1rem' }}>{sub.name || 'Unknown User'}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'monospace' }}>ID: {sub.chatId}</div>
                    </td>
                    <td style={{ padding: '20px 16px', verticalAlign: 'top' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', padding: '4px 10px', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {sub.source}
                      </span>
                    </td>
                    <td style={{ padding: '20px 16px', verticalAlign: 'top' }}>
                      {sub.targets && sub.targets.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {sub.targets.map(t => (
                            <span key={t.id} style={{ fontSize: '0.9rem', background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '1rem' }}>🎯</span> {t.name} <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>&gt;={t.threshold}%</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                          No personal targets tracked yet.
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
  )
}
