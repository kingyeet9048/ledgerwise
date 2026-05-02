import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface NetWorthCardProps {
  netWorth: number
  prevNetWorth?: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default function NetWorthCard({ netWorth, prevNetWorth }: NetWorthCardProps): React.ReactElement {
  const change = prevNetWorth !== undefined ? netWorth - prevNetWorth : 0
  const changePct = prevNetWorth && prevNetWorth !== 0 ? (change / Math.abs(prevNetWorth)) * 100 : 0
  const isPositive = change >= 0

  return (
    <div className="metric-card flex flex-col gap-2">
      <p className="text-surface-400 text-sm font-medium">Net Worth</p>
      <p className={`text-3xl font-bold ${netWorth >= 0 ? 'text-surface-50' : 'text-red-400'}`}>
        {formatCurrency(netWorth)}
      </p>
      {prevNetWorth !== undefined && (
        <div className={`flex items-center gap-1.5 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>
            {isPositive ? '+' : ''}{formatCurrency(change)} ({changePct.toFixed(1)}%) from last month
          </span>
        </div>
      )}
    </div>
  )
}
