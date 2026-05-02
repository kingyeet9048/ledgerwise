import React, { useState } from 'react'
import { Shield, Eye, EyeOff, CheckCircle } from 'lucide-react'

interface SetupPageProps {
  onComplete: () => void
}

export default function SetupPage({ onComplete }: SetupPageProps): React.ReactElement {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const passwordStrength = getPasswordStrength(passphrase)

  function getPasswordStrength(pass: string): { score: number; label: string; color: string } {
    let score = 0
    if (pass.length >= 12) score++
    if (pass.length >= 16) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
    if (score <= 2) return { score, label: 'Fair', color: 'bg-yellow-500' }
    if (score <= 3) return { score, label: 'Good', color: 'bg-blue-500' }
    return { score, label: 'Strong', color: 'bg-green-500' }
  }

  async function handleSetup(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError('')

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters')
      return
    }

    if (passphrase !== confirm) {
      setError('Passphrases do not match')
      return
    }

    setLoading(true)
    try {
      const res = await window.api.db.setup(passphrase)
      if (res.success) {
        onComplete()
      } else {
        setError(res.error || 'Setup failed')
      }
    } catch (e) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-surface-50">Welcome to LedgerWise</h1>
          <p className="text-surface-400 text-sm mt-1">Set up your encrypted local vault</p>
        </div>

        <div className="card border-surface-700 p-6">
          <h2 className="text-surface-100 font-semibold mb-1">Create Your Passphrase</h2>
          <p className="text-surface-500 text-sm mb-5">
            This passphrase encrypts your financial data. It cannot be recovered if lost.
            Store it somewhere safe.
          </p>

          <form onSubmit={handleSetup} className="flex flex-col gap-4">
            <div>
              <label className="label">Passphrase</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter a strong passphrase"
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

              {/* Strength indicator */}
              {passphrase.length > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${
                    passwordStrength.score <= 1 ? 'text-red-400' :
                    passwordStrength.score <= 2 ? 'text-yellow-400' :
                    passwordStrength.score <= 3 ? 'text-blue-400' : 'text-green-400'
                  }`}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="label">Confirm Passphrase</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm your passphrase"
                />
                {confirm.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passphrase === confirm ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <span className="w-4 h-4 text-red-400 text-xs">✗</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm px-4 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <div className="bg-surface-700/50 rounded-lg p-3 text-xs text-surface-400 space-y-1">
              <p className="font-medium text-surface-300 mb-1">Security Info:</p>
              <p>• Your data is encrypted with AES-256 (SQLCipher)</p>
              <p>• Passphrase is hashed with Argon2id (never stored)</p>
              <p>• Data stored locally at: ~/.config/ledgerwise/</p>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-2.5"
              disabled={loading || passphrase !== confirm || passphrase.length < 8}
            >
              {loading ? 'Setting up encrypted vault...' : 'Create Encrypted Vault'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
