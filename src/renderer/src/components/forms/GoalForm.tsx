import React, { useState } from 'react'
import { Goal, GoalType } from '../../../../shared/types'
import { useAppStore } from '../../store/appStore'

interface GoalFormProps {
  goal?: Goal
  onSuccess: (goal: Goal) => void
  onCancel: () => void
}

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'debt_paydown', label: 'Debt Paydown' },
  { value: 'sinking_fund', label: 'Sinking Fund' },
  { value: 'down_payment', label: 'Down Payment' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'savings', label: 'Savings' }
]

export default function GoalForm({ goal, onSuccess, onCancel }: GoalFormProps): React.ReactElement {
  const { addToast } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: goal?.name || '',
    type: goal?.type || 'savings' as GoalType,
    target_amount: goal?.target_amount || 0,
    current_amount: goal?.current_amount || 0,
    target_date: goal?.target_date || '',
    monthly_contribution: goal?.monthly_contribution || '',
    notes: goal?.notes || '',
    status: goal?.status || 'active'
  })

  function handleChange(field: string, value: unknown): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.name.trim()) {
      addToast('Goal name is required', 'error')
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...form,
        target_amount: parseFloat(String(form.target_amount)) || 0,
        current_amount: parseFloat(String(form.current_amount)) || 0,
        monthly_contribution: form.monthly_contribution !== ''
          ? parseFloat(String(form.monthly_contribution))
          : undefined,
        target_date: form.target_date || undefined
      }

      const res = goal
        ? await window.api.goals.update(goal.id, payload)
        : await window.api.goals.create(payload)

      if (res.success && res.data) {
        addToast(`Goal ${goal ? 'updated' : 'created'} successfully`, 'success')
        onSuccess(res.data)
      } else {
        addToast(res.error || 'Failed to save goal', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Goal Name *</label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g. Emergency Fund"
          required
        />
      </div>

      <div>
        <label className="label">Goal Type</label>
        <select
          className="input"
          value={form.type}
          onChange={(e) => handleChange('type', e.target.value)}
        >
          {GOAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Target Amount *</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={form.target_amount}
            onChange={(e) => handleChange('target_amount', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Current Amount</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={form.current_amount}
            onChange={(e) => handleChange('current_amount', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Target Date</label>
          <input
            className="input"
            type="date"
            value={form.target_date}
            onChange={(e) => handleChange('target_date', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Monthly Contribution</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={form.monthly_contribution}
            onChange={(e) => handleChange('monthly_contribution', e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input resize-none"
          rows={2}
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
        </button>
      </div>
    </form>
  )
}
