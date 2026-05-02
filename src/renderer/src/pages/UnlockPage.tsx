import React, { useState } from 'react'
import { Shield, Eye, EyeOff, Lock } from 'lucide-react'

interface UnlockPageProps {
  onUnlock: () => void
}

export default function UnlockPage({ onUnlock }: UnlockPageProps): React.ReactElement {
  const [passphrase, setPassphrase] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)

  async function handleUnlock(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!passphrase.trim()) return

    setError('')
    setLoading(true)
    try {
      const res = await window.api.db.unlock(passphrase)
      if (res.success) {
        onUnlock()
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setError(
          newAttempts >= 3
            ? 'Incorrect passphrase. Please double-check your passphrase.'
            : 'Incorrect passphrase'
        )
        setPassphrase('')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-surface-50">LedgerWise</h1>
          <p className="text-surface-400 text-sm mt-1">Enter your passphrase to unlock</p>
        </div>

        <div className="card border-surface-700 p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-surface-700 rounded-xl mx-auto mb-5">
            <Lock className="w-6 h-6 text-surface-300" />
          </div>

          <form onSubmit={handleUnlock} className="flex flex-col gap-4">
            <div>
              <label className="label">Passphrase</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter your passphrase"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm px-4 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-2.5"
              disabled={loading || !passphrase.trim()}
            >
              {loading ? 'Unlocking...' : 'Unlock'}
            </button>
          </form>
        </div>

        <p className="text-center text-surface-600 text-xs mt-4">
          Your data is encrypted and stored locally
        </p>
      </div>
    </div>
  )
}
