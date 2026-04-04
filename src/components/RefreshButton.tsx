"use client"

export default function RefreshButton() {
  return (
    <button className="btn" style={{ width: '100%' }} onClick={() => window.location.reload()}>
      Refresh Dashboard
    </button>
  )
}
