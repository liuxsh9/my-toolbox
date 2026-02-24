import { useState, useEffect } from 'react'
import { Dashboard } from './pages/Dashboard'

export function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#f8fafc' }}>
          My Toolbox
        </h1>
        <span style={{ fontSize: '12px', color: '#64748b' }}>Local Tool Portal</span>
      </header>
      <main style={{ padding: '24px' }}>
        <Dashboard />
      </main>
    </div>
  )
}
