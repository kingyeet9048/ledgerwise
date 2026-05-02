import React from 'react'
import { Goal } from '../../../shared/types'
import { Target, Calendar, Edit2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

interface GoalCardProps {
  goal: Goal
  onEdit?: (goal: Goal) => void
  onDelete?: (goal: Goal) => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

function getGoalTypeLabel(type: Goal['type']): string {
  const labels: Record<Goal['type'], string> = {
    emergency_fund: 'Emergency Fund',
    debt_paydown: 'Debt Paydown',
    sinking_fund: 'Sinking Fund',
    down_payment: 'Down Payment',
    retirement: 'Retirement',
    savings: 'Savings'
  }
  return labels[type] || type
}

export default function GoalCard({ goal, onEdit, onDelete }: GoalCardProps): React.ReactElement {
  const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0
  const clampedProgress = Math.min(Math.max(progress, 0), 100)

  const remaining = goal.target_amount - goal.current_amount
  const monthsToGo =
    goal.monthly_contribution && goal.monthly_contribution > 0 && remaining > 0
      ? Math.ceil(remaining / goal.monthly_contribution)
      : null

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary-900/40 rounded-lg flex items-center justify-center text-primary-400">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <p className="text-surface-100 font-semibold">{goal.name}</p>
            <p className="text-surface-500 text-xs">{getGoalTypeLabel(goal.type)}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(goal)}
              className="p-1.5 text-surface-500 hover:text-primary-400 hover:bg-surface-700 rounded-lg transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(goal)}
              className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-surface-700 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-surface-100 font-semibold">{formatCurrency(goal.current_amount)}</span>
          <span className="text-surface-400">of {formatCurrency(goal.target_amount)}</span>
        </div>
        <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-surface-400">{clampedProgress.toFixed(1)}% complete</span>
          {remaining > 0 && <span className="text-surface-500">{formatCurrency(remaining)} remaining</span>}
        </div>
      </div>

      <div className="flex gap-4 text-xs">
        {goal.target_date && (
          <div className="flex items-center gap-1 text-surface-400">
            <Calendar className="w-3 h-3" />
            <span>Target: {format(new Date(goal.target_date), 'MMM yyyy')}</span>
          </div>
        )}
        {monthsToGo !== null && (
          <div className="text-surface-400">
            ~{monthsToGo} months at {formatCurrency(goal.monthly_contribution!)}/mo
          </div>
        )}
      </div>
    </div>
  )
}
