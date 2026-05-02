import React from 'react'
import { Transaction } from '../../../shared/types'
import { format } from 'date-fns'
import { Edit2, Trash2 } from 'lucide-react'

interface TransactionRowProps {
  transaction: Transaction
  onEdit?: (tx: Transaction) => void
  onDelete?: (tx: Transaction) => void
  showAccount?: boolean
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

function getAmountColor(tx: Transaction): string {
  if (['income', 'dividend', 'interest', 'sell'].includes(tx.type)) return 'text-green-400'
  if (['expense', 'fee', 'buy'].includes(tx.type)) return 'text-red-400'
  return 'text-surface-300'
}

function getAmountPrefix(tx: Transaction): string {
  if (['income', 'dividend', 'interest', 'sell'].includes(tx.type)) return '+'
  if (['expense', 'fee', 'buy'].includes(tx.type)) return '-'
  return ''
}

function getStatusBadge(status: Transaction['status']): React.ReactElement {
  const styles = {
    pending: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
    posted: 'bg-blue-900/40 text-blue-400 border border-blue-800',
    reviewed: 'bg-green-900/40 text-green-400 border border-green-800'
  }
  return <span className={`badge ${styles[status]}`}>{status}</span>
}

export default function TransactionRow({
  transaction: tx,
  onEdit,
  onDelete,
  showAccount = true
}: TransactionRowProps): React.ReactElement {
  return (
    <tr className="border-b border-surface-700 hover:bg-surface-800/50 transition-colors group">
      <td className="py-3 px-3 text-surface-400 text-sm whitespace-nowrap">
        {format(new Date(tx.date), 'MMM d, yyyy')}
      </td>
      <td className="py-3 px-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-surface-100 text-sm font-medium">{tx.payee || '—'}</span>
          {tx.memo && <span className="text-surface-500 text-xs truncate max-w-xs">{tx.memo}</span>}
        </div>
      </td>
      {showAccount && (
        <td className="py-3 px-3 text-surface-400 text-sm">{tx.account_name || '—'}</td>
      )}
      <td className="py-3 px-3">
        {tx.category_name ? (
          <span className="badge bg-surface-700 text-surface-300">{tx.category_name}</span>
        ) : (
          <span className="text-surface-600 text-xs">Uncategorized</span>
        )}
      </td>
      <td className="py-3 px-3 text-right">
        <span className={`font-semibold text-sm ${getAmountColor(tx)}`}>
          {getAmountPrefix(tx)}{formatCurrency(Math.abs(tx.amount))}
        </span>
      </td>
      <td className="py-3 px-3 text-right">{getStatusBadge(tx.status)}</td>
      <td className="py-3 px-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={() => onEdit(tx)}
              className="p-1.5 text-surface-400 hover:text-primary-400 hover:bg-surface-700 rounded-lg transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(tx)}
              className="p-1.5 text-surface-400 hover:text-red-400 hover:bg-surface-700 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
