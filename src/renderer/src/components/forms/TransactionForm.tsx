import React, { useState, useEffect } from 'react'
import { Transaction, Account, Category } from '../../../../shared/types'
import { useAppStore } from '../../store/appStore'
import { format } from 'date-fns'

interface TransactionFormProps {
  transaction?: Transaction
  accounts: Account[]
  categories: Category[]
  onSuccess: (tx: Transaction) => void
  onCancel: () => void
}

const TX_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'fee', label: 'Fee' },
  { value: 'interest', label: 'Interest' },
  { value: 'other', label: 'Other' }
]

export default function TransactionForm({
  transaction: tx,
  accounts,
  categories,
  onSuccess,
  onCancel
}: TransactionFormProps): React.ReactElement {
  const { addToast } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    account_id: tx?.account_id || accounts[0]?.id || '',
    date: tx?.date || format(new Date(), 'yyyy-MM-dd'),
    amount: tx ? Math.abs(tx.amount) : 0,
    payee: tx?.payee || '',
    memo: tx?.memo || '',
    category_id: tx?.category_id || '',
    type: tx?.type || 'expense',
    status: tx?.status || 'posted',
    notes: tx?.notes || ''
  })

  function handleChange(field: string, value: unknown): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.account_id) {
      addToast('Please select an account', 'error')
      return
    }
    if (!form.amount || parseFloat(String(form.amount)) <= 0) {
      addToast('Amount must be greater than 0', 'error')
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...form,
        amount: parseFloat(String(form.amount)),
        category_id: form.category_id || undefined,
        currency: 'USD'
      }

      const res = tx
        ? await window.api.transactions.update(tx.id, payload)
        : await window.api.transactions.create(payload)

      if (res.success && res.data) {
        addToast(`Transaction ${tx ? 'updated' : 'created'}`, 'success')
        onSuccess(res.data)
      } else {
        addToast(res.error || 'Failed to save transaction', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const expenseCategories = categories.filter((c) =>
    ['expense', 'income', 'transfer'].includes(c.type)
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Account *</label>
          <select
            className="input"
            value={form.account_id}
            onChange={(e) => handleChange('account_id', e.target.value)}
            required
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Date *</label>
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => handleChange('date', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Amount *</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => handleChange('amount', e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={form.type}
            onChange={(e) => handleChange('type', e.target.value)}
          >
            {TX_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Payee</label>
        <input
          className="input"
          value={form.payee}
          onChange={(e) => handleChange('payee', e.target.value)}
          placeholder="e.g. Amazon, Whole Foods"
        />
      </div>

      <div>
        <label className="label">Category</label>
        <select
          className="input"
          value={form.category_id}
          onChange={(e) => handleChange('category_id', e.target.value)}
        >
          <option value="">Uncategorized</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Memo</label>
        <input
          className="input"
          value={form.memo}
          onChange={(e) => handleChange('memo', e.target.value)}
          placeholder="Optional memo"
        />
      </div>

      <div>
        <label className="label">Status</label>
        <select
          className="input"
          value={form.status}
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="posted">Posted</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : tx ? 'Update Transaction' : 'Create Transaction'}
        </button>
      </div>
    </form>
  )
}
