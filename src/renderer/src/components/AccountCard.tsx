import React from 'react'
import { Account } from '../../../shared/types'
import { Wallet, CreditCard, TrendingUp, Home, Building } from 'lucide-react'

interface AccountCardProps {
  account: Account
  onClick?: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

function getAccountIcon(type: Account['type']): React.ReactElement {
  switch (type) {
    case 'checking':
    case 'savings':
      return <Wallet className="w-4 h-4" />
    case 'credit_card':
      return <CreditCard className="w-4 h-4" />
    case 'brokerage':
    case 'retirement':
    case 'hsa':
      return <TrendingUp className="w-4 h-4" />
    case 'real_estate':
      return <Home className="w-4 h-4" />
    default:
      return <Building className="w-4 h-4" />
  }
}

function getTypeLabel(type: Account['type']): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AccountCard({ account, onClick }: AccountCardProps): React.ReactElement {
  const isLiability = ['credit_card', 'loan', 'student_loan', 'liability'].includes(account.type)
  const balance = account.balance

  return (
    <div
      className={`card flex items-center gap-3 cursor-pointer hover:border-surface-600 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isLiability ? 'bg-red-900/30 text-red-400' : 'bg-primary-900/30 text-primary-400'
        }`}
      >
        {getAccountIcon(account.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-surface-100 font-medium text-sm truncate">{account.name}</p>
        {account.institution && (
          <p className="text-surface-500 text-xs truncate">{account.institution}</p>
        )}
        <p className="text-surface-500 text-xs">{getTypeLabel(account.type)}</p>
      </div>
      <div className="text-right">
        <p className={`font-semibold text-sm ${isLiability ? 'text-red-400' : balance >= 0 ? 'text-surface-100' : 'text-red-400'}`}>
          {formatCurrency(balance)}
        </p>
        {account.credit_limit && isLiability && (
          <p className="text-surface-500 text-xs">of {formatCurrency(account.credit_limit)}</p>
        )}
      </div>
    </div>
  )
}
