import React, { useState } from 'react'
import { PlanNote, PlanNoteCategory } from '../../../../shared/types'
import { useAppStore } from '../../store/appStore'
import { format } from 'date-fns'

interface PlanNoteFormProps {
  note?: PlanNote
  onSuccess: (note: PlanNote) => void
  onCancel: () => void
}

const NOTE_CATEGORIES: { value: PlanNoteCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'goal_change', label: 'Goal Change' },
  { value: 'allocation_change', label: 'Allocation Change' },
  { value: 'debt_plan', label: 'Debt Plan' },
  { value: 'projection', label: 'Projection' }
]

export default function PlanNoteForm({ note, onSuccess, onCancel }: PlanNoteFormProps): React.ReactElement {
  const { addToast } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: note?.title || '',
    body: note?.body || '',
    category: note?.category || 'general' as PlanNoteCategory,
    effective_date: note?.effective_date || format(new Date(), 'yyyy-MM-dd')
  })

  function handleChange(field: string, value: unknown): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.title.trim()) {
      addToast('Title is required', 'error')
      return
    }
    if (!form.body.trim()) {
      addToast('Body is required', 'error')
      return
    }

    setLoading(true)
    try {
      const res = note
        ? await window.api.planNotes.update(note.id, form)
        : await window.api.planNotes.create(form)

      if (res.success && res.data) {
        addToast(`Plan note ${note ? 'updated' : 'created'} successfully`, 'success')
        onSuccess(res.data)
      } else {
        addToast(res.error || 'Failed to save note', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Title *</label>
        <input
          className="input"
          value={form.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="e.g. Changed emergency fund target to 6 months"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
          >
            {NOTE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Effective Date</label>
          <input
            className="input"
            type="date"
            value={form.effective_date}
            onChange={(e) => handleChange('effective_date', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Details *</label>
        <textarea
          className="input resize-none"
          rows={5}
          value={form.body}
          onChange={(e) => handleChange('body', e.target.value)}
          placeholder="Describe the decision and reasoning..."
          required
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : note ? 'Update Note' : 'Add Note'}
        </button>
      </div>
    </form>
  )
}
