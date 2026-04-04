"use client"

import { useState, useEffect } from 'react'

interface Settings {
  telegramToken: string
  telegramChatId: string
  globalThreshold: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    telegramToken: '',
    telegramChatId: '',
    globalThreshold: 15.0
  })
  const [statusText, setStatusText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const fetchSettings = async () => {
    setLoading(true)
    const res = await fetch('/api/settings')
    if (res.ok) {
      setSettings(await res.json())
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })

    if (res.ok) {
      setStatusText('Settings saved successfully!')
      setTimeout(() => setStatusText(''), 3000)
    }
    setSaving(false)
  }

  const handleTestScrape = async () => {
    setTesting(true)
    setStatusText('Running mock scrape...')
    const res = await fetch('/api/cron', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setStatusText('Mock scrape run successful! Check Telegram if thresholds met.')
    } else {
      setStatusText('Mock scrape failed.')
    }
    setTimeout(() => setStatusText(''), 4000)
    setTesting(false)
  }

  if (loading) return <div className="text-secondary text-center" style={{ padding: '40px' }}>Loading...</div>

  return (
    <div className="grid grid-2">
      <div className="glass-panel animate-fade-in delay-1">
        <h2>System Settings</h2>
        
        {statusText && (
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '16px', color: '#fff' }}>
            {statusText}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="input-group">
            <label>Telegram Bot Token</label>
            <input 
              type="text" 
              value={settings.telegramToken || ''} 
              onChange={e => setSettings({ ...settings, telegramToken: e.target.value })} 
              placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" 
            />
          </div>
          <div className="input-group">
            <label>Telegram Chat ID</label>
            <input 
              type="text" 
              value={settings.telegramChatId || ''} 
              onChange={e => setSettings({ ...settings, telegramChatId: e.target.value })} 
              placeholder="e.g. -100123456789" 
            />
          </div>
          <div className="input-group">
            <label>Global High-Cashback Threshold % (Alerts for Everything Above)</label>
            <input 
              type="number" 
              step="0.1" 
              value={settings.globalThreshold} 
              onChange={e => setSettings({ ...settings, globalThreshold: parseFloat(e.target.value) })} 
              required 
            />
          </div>
          
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>
      </div>

      <div className="glass-panel animate-fade-in delay-2" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2>Test Integration</h2>
        <p className="text-secondary" style={{ marginBottom: '24px', lineHeight: '1.6' }}>
          Trigger a manual scrape to test the logic. It will simulate scraping Rakuten US and save recent offers to the database. If there are any targets matched, or Global Threshold met, a message will be sent to your configured Telegram Chat ID.
        </p>
        
        <button className="btn btn-secondary w-full" style={{ marginTop: 'auto', width: '100%' }} onClick={handleTestScrape} disabled={testing}>
          {testing ? 'Running...' : 'Trigger Scrape Now'}
        </button>
      </div>
    </div>
  )
}
