import React, { useState } from 'react'
import { Account, AccountType } from '../../../../shared/types'
import { useAppStore } from '../../store/appStore'

interface AccountFormProps {
  account?: Account
  onSuccess: (account: Account) => void
  onCancel: () => void
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
  { value: 'student_loan', label: 'Student Loan' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'retirement', label: 'Retirement (401k/IRA)' },
  { value: 'hsa', label: 'HSA' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'manual_asset', label: 'Manual Asset' },
  { value: 'liability', label: 'Other Liability' }
]

export default function AccountForm({ account, onSuccess, onCancel }: AccountFormProps): React.ReactElement {
  const { addToast } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: account?.name || '',
    type: account?.type || 'checking' as AccountType,
    institution: account?.institution || '',
    balance: account?.balance ?? 0,
    credit_limit: account?.credit_limit ?? '',
    interest_rate: account?.interest_rate ?? '',
    is_budget_account: account?.is_budget_account ?? 1,
    notes: account?.notes || ''
  })

  function handleChange(field: string, value: unknown): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.name.trim()) {
      addToast('Account name is required', 'error')
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...form,
        balance: parseFloat(String(form.balance)) || 0,
        credit_limit: form.credit_limit !== '' ? parseFloat(String(form.credit_limit)) : undefined,
        interest_rate: form.interest_rate !== '' ? parseFloat(String(form.interest_rate)) : undefined,
        is_budget_account: form.is_budget_account ? 1 : 0,
        currency: 'USD',
        is_closed: 0
      }

      const res = account
        ? await window.api.accounts.update(account.id, payload)
        : await window.api.accounts.create(payload)

      if (res.success && res.data) {
        addToast(`Account ${account ? 'updated' : 'created'} successfully`, 'success')
        onSuccess(res.data)
      } else {
        addToast(res.error || 'Failed to save account', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Account Name *</label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g. Chase Checking"
          required
        />
      </div>

      <div>
        <label className="label">Account Type *</label>
        <select
          className="input"
          value={form.type}
          onChange={(e) => handleChange('type', e.target.value)}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Institution</label>
        <input
          className="input"
          value={form.institution}
          onChange={(e) => handleChange('institution', e.target.value)}
          placeholder="e.g. Chase Bank"
        />
      </div>

      <div>
        <label className="label">Current Balance</label>
        <input
          className="input"
          type="number"
          step="0.01"
          value={form.balance}
          onChange={(e) => handleChange('balance', e.target.value)}
          placeholder="0.00"
        />
      </div>

      {['credit_card', 'loan', 'student_loan', 'liability'].includes(form.type) && (
        <>
          <div>
            <label className="label">Credit/Loan Limit</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.credit_limit}
              onChange={(e) => handleChange('credit_limit', e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="label">Interest Rate (%)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.interest_rate}
              onChange={(e) => handleChange('interest_rate', e.target.value)}
              placeholder="e.g. 18.99"
            />
          </div>
        </>
      )}

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input resize-none"
          rows={2}
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_budget_account"
          checked={form.is_budget_account === 1}
          onChange={(e) => handleChange('is_budget_account', e.target.checked ? 1 : 0)}
          className="rounded border-surface-600 bg-surface-800 text-primary-600"
        />
        <label htmlFor="is_budget_account" className="text-surface-300 text-sm">
          Include in budget
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : account ? 'Update Account' : 'Create Account'}
        </button>
      </div>
    </form>
  )
}
