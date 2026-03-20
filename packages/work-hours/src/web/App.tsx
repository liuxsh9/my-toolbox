import { useState, useEffect, useCallback } from 'react'
import { TodayView } from './components/TodayView'
import { DayView } from './components/DayView'
import { WeekView } from './components/WeekView'
import { MonthView } from './components/MonthView'
import { TrendView } from './components/TrendView'
import { SummaryCards } from './components/SummaryCards'

type Tab = 'today' | 'day' | 'week' | 'month' | 'trend'

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'trend', label: 'Trend' },
]

const WIDGET_TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'trend', label: 'Trend' },
]

export default function App() {
  const isWidget = new URLSearchParams(window.location.search).get('mode') === 'widget'
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [dayViewDate, setDayViewDate] = useState<string | null>(null)

  const navigateToDay = useCallback((date: string) => {
    setDayViewDate(date)
    setActiveTab('day')
  }, [])

  // Apply dark theme when embedded as widget (portal is dark-themed)
  useEffect(() => {
    if (isWidget) {
      document.documentElement.classList.add('theme-dark')
    }
  }, [isWidget])

  if (isWidget) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--wh-bg)',
        color: 'var(--wh-text)',
        overflow: 'hidden',
      }}>
        {/* Widget tab bar */}
        <nav style={{
          display: 'flex',
          gap: 2,
          padding: '6px 10px 0',
          borderBottom: '1px solid var(--wh-border)',
          flexShrink: 0,
        }}>
          {WIDGET_TABS.map(tab => {
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--wh-primary)' : 'var(--wh-text-secondary)',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--wh-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: -1,
                  transition: 'color .15s, border-color .15s',
                  letterSpacing: '0.01em',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Widget content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'today' && <DayView initialDate={null} widget />}
          {activeTab === 'week' && <WeekView widget />}
          {activeTab === 'month' && <MonthView onDayClick={navigateToDay} widget />}
          {activeTab === 'trend' && <TrendView widget />}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--wh-bg)',
      color: 'var(--wh-text)',
    }}>
      {/* Header */}
      <header style={{
        padding: '32px 40px 0',
        maxWidth: 1100,
        margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 28 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--wh-text)',
            letterSpacing: '-0.02em',
          }}>
            Work Hours
          </h1>
          <span style={{ fontSize: 13, color: 'var(--wh-text-secondary)' }}>
            time tracking
          </span>
        </div>

        <SummaryCards />

        {/* Tab bar */}
        <nav style={{
          display: 'flex',
          gap: 4,
          marginTop: 28,
          borderBottom: '1px solid var(--wh-border)',
        }}>
          {TABS.map(tab => {
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key)
                  if (tab.key === 'day') setDayViewDate(null)
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--wh-primary)' : 'var(--wh-text-secondary)',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--wh-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: -1,
                  transition: 'color .15s, border-color .15s',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Content */}
      <main style={{
        padding: '24px 40px 48px',
        maxWidth: 1100,
        margin: '0 auto',
      }}>
        {activeTab === 'today' && <TodayView />}
        {activeTab === 'day' && <DayView initialDate={dayViewDate} />}
        {activeTab === 'week' && <WeekView />}
        {activeTab === 'month' && <MonthView onDayClick={navigateToDay} />}
        {activeTab === 'trend' && <TrendView />}
      </main>
    </div>
  )
}
