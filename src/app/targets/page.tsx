"use client"

import { useState, useEffect } from 'react'

interface Target {
  id: number
  name: string
  keyword: string
  threshold: number
  createdAt: string
}

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form state
  const [name, setName] = useState('')
  const [keyword, setKeyword] = useState('')
  const [threshold, setThreshold] = useState('')

  const fetchTargets = async () => {
    setIsLoading(true)
    const res = await fetch('/api/targets')
    if (res.ok) {
      setTargets(await res.json())
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchTargets()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, keyword, threshold })
    })

    if (res.ok) {
      setName('')
      setKeyword('')
      setThreshold('')
      fetchTargets()
    }
  }

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/targets/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchTargets()
    }
  }

  return (
    <div className="grid grid-2">
      <div className="glass-panel animate-fade-in delay-1">
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

      <div className="glass-panel animate-fade-in delay-2">
        <h2>Your Watchlist</h2>
        {isLoading ? (
          <p className="text-secondary">Loading targets...</p>
        ) : targets.length === 0 ? (
          <p className="text-secondary">No focus targets configured.</p>
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
    </div>
  )
}
