import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store/appStore'
import Layout from './components/Layout'
import SetupPage from './pages/SetupPage'
import UnlockPage from './pages/UnlockPage'
import DashboardPage from './pages/DashboardPage'
import AccountsPage from './pages/AccountsPage'
import TransactionsPage from './pages/TransactionsPage'
import ImportPage from './pages/ImportPage'
import GoalsPage from './pages/GoalsPage'
import InvestmentsPage from './pages/InvestmentsPage'
import ProjectionsPage from './pages/ProjectionsPage'
import PlanNotesPage from './pages/PlanNotesPage'
import SettingsPage from './pages/SettingsPage'
import ToastContainer from './components/ToastContainer'

type AppState = 'loading' | 'setup' | 'locked' | 'unlocked'

export default function App(): React.ReactElement {
  const [appState, setAppState] = useState<AppState>('loading')
  const { isAuthenticated, setAuthenticated } = useAppStore()

  useEffect(() => {
    checkDbState()
  }, [])

  async function checkDbState(): Promise<void> {
    try {
      const res = await window.api.db.isSetup()
      if (res.success && res.data) {
        setAppState('locked')
      } else {
        setAppState('setup')
      }
    } catch {
      setAppState('setup')
    }
  }

  function handleSetupComplete(): void {
    setAuthenticated(true)
    setAppState('unlocked')
  }

  function handleUnlockComplete(): void {
    setAuthenticated(true)
    setAppState('unlocked')
  }

  if (appState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950">
        <div className="text-surface-400 text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <HashRouter>
      <ToastContainer />
      {appState === 'setup' && (
        <SetupPage
          onComplete={handleSetupComplete}
          onAlreadyExists={() => setAppState('locked')}
        />
      )}
      {appState === 'locked' && <UnlockPage onUnlock={handleUnlockComplete} />}
      {appState === 'unlocked' && (
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/investments" element={<InvestmentsPage />} />
            <Route path="/projections" element={<ProjectionsPage />} />
            <Route path="/plan-notes" element={<PlanNotesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      )}
    </HashRouter>
  )
}
