'use client'

import { useState, useEffect } from 'react'

const CATEGORY_OPTIONS = [
  { label: '👗 Fashion', value: 'Fashion', emoji: '👗' },
  { label: '💄 Beauty', value: 'Beauty', emoji: '💄' },
  { label: '💻 Electronics', value: 'Electronics', emoji: '💻' },
  { label: '🍔 Food & Dining', value: 'Food & Dining', emoji: '🍔' },
  { label: '✈️ Travel', value: 'Travel', emoji: '✈️' },
  { label: '🏥 Health', value: 'Health', emoji: '🏥' },
  { label: '🏠 Home & Garden', value: 'Home & Garden', emoji: '🏠' },
  { label: '🎮 Gaming', value: 'Gaming', emoji: '🎮' },
  { label: '🏃 Sports', value: 'Sports', emoji: '🏃' },
  { label: '🐾 Pets', value: 'Pets', emoji: '🐾' },
  { label: '📚 Education', value: 'Education', emoji: '📚' },
  { label: '🛒 General', value: 'General', emoji: '🛒' },
]

interface Rule { id: number; keyword: string; category: string; emoji: string }

export default function CategoriesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('Fashion')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  const fetchRules = async () => {
    const res = await fetch('/api/categories')
    if (res.ok) setRules(await res.json())
  }

  useEffect(() => { fetchRules() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword.trim()) return
    setSaving(true)
    const selectedCat = CATEGORY_OPTIONS.find(c => c.value === category)
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: keyword.trim(), category, emoji: selectedCat?.emoji ?? '🛒' }),
    })
    if (res.ok) {
      setKeyword('')
      setStatus('✅ Rule saved!')
      await fetchRules()
    } else {
      setStatus('❌ Failed to save rule')
    }
    setSaving(false)
    setTimeout(() => setStatus(''), 3000)
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    setRules(prev => prev.filter(r => r.id !== id))
  }

  const filtered = rules.filter(r =>
    r.keyword.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  )

  // Group by category
  const grouped = CATEGORY_OPTIONS.map(cat => ({
    ...cat,
    rules: filtered.filter(r => r.category === cat.value),
  })).filter(g => g.rules.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Add Rule Form */}
      <div className="glass-panel animate-fade-in delay-1">
        <h2>Add Category Rule</h2>
        <p className="text-secondary" style={{ marginBottom: '20px', lineHeight: 1.6 }}>
          When a store name contains this keyword, it will be automatically tagged with the selected category.
          Keywords are case-insensitive.
        </p>

        {status && (
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '16px' }}>
            {status}
          </div>
        )}

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <label>Keyword</label>
            <input
              type="text"
              placeholder="e.g. adidas"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              required
            />
          </div>
          <div className="input-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
            <label>Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '0.9rem' }}
            >
              {CATEGORY_OPTIONS.map(c => (
                <option key={c.value} value={c.value} style={{ background: '#1a1a2e' }}>{c.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn" disabled={saving} style={{ flexShrink: 0 }}>
            {saving ? 'Saving…' : '+ Add Rule'}
          </button>
        </form>
      </div>

      {/* Rules Table */}
      <div className="glass-panel animate-fade-in delay-2">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>All Rules <span className="text-secondary" style={{ fontSize: '0.85rem', fontWeight: 400 }}>({rules.length} total)</span></h2>
          <input
            type="text"
            placeholder="Search keyword or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.9rem', width: '220px' }}
          />
        </div>

        {grouped.length === 0 ? (
          <p className="text-secondary" style={{ textAlign: 'center', padding: '40px' }}>No rules found.</p>
        ) : (
          grouped.map(group => (
            <div key={group.value} style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '10px' }}>
                {group.emoji} {group.label.split(' ').slice(1).join(' ')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {group.rules.map(rule => (
                  <div key={rule.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', borderRadius: '20px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '0.85rem'
                  }}>
                    <span>{rule.keyword}</span>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,100,100,0.7)', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                      title="Delete rule"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
