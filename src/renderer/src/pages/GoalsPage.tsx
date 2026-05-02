import React, { useEffect, useState } from 'react'
import { Goal } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import GoalCard from '../components/GoalCard'
import GoalForm from '../components/forms/GoalForm'
import { Plus } from 'lucide-react'

export default function GoalsPage(): React.ReactElement {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | undefined>()
  const [deleteGoal, setDeleteGoal] = useState<Goal | undefined>()
  const { addToast } = useAppStore()

  useEffect(() => {
    loadGoals()
  }, [])

  async function loadGoals(): Promise<void> {
    setLoading(true)
    const res = await window.api.goals.list()
    if (res.success && res.data) setGoals(res.data)
    setLoading(false)
  }

  async function handleDelete(): Promise<void> {
    if (!deleteGoal) return
    const res = await window.api.goals.delete(deleteGoal.id)
    if (res.success) {
      addToast('Goal deleted', 'success')
      loadGoals()
    } else {
      addToast(res.error || 'Failed to delete goal', 'error')
    }
    setDeleteGoal(undefined)
  }

  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
  const totalCurrent = goals.reduce((s, g) => s + g.current_amount, 0)
  const overallPct = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h1 className="page-title">Goals</h1>
        <button
          onClick={() => { setEditGoal(undefined); setShowForm(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {/* Summary */}
      {goals.length > 0 && (
        <div className="card">
          <div className="flex justify-between mb-2">
            <span className="text-surface-300 text-sm font-medium">Overall Progress</span>
            <span className="text-surface-300 text-sm">
              ${totalCurrent.toLocaleString()} of ${totalTarget.toLocaleString()}
            </span>
          </div>
          <div className="h-2.5 bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${Math.min(overallPct, 100)}%` }}
            />
          </div>
          <p className="text-surface-500 text-xs mt-1">{overallPct.toFixed(1)}% complete across {goals.length} goals</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-surface-500">Loading goals...</div>
      ) : goals.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={(g) => { setEditGoal(g); setShowForm(true) }}
              onDelete={setDeleteGoal}
            />
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="text-surface-500 mb-2">No goals yet</div>
          <p className="text-surface-600 text-sm mb-4">
            Set financial goals like building an emergency fund, paying off debt, or saving for a down payment.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Goal
          </button>
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditGoal(undefined) }}
        title={editGoal ? 'Edit Goal' : 'Add Goal'}
      >
        <GoalForm
          goal={editGoal}
          onSuccess={() => { setShowForm(false); setEditGoal(undefined); loadGoals() }}
          onCancel={() => { setShowForm(false); setEditGoal(undefined) }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteGoal}
        onClose={() => setDeleteGoal(undefined)}
        onConfirm={handleDelete}
        title="Delete Goal"
        message={`Delete "${deleteGoal?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isDestructive
      />
    </div>
  )
}
