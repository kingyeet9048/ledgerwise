import React, { useEffect, useState } from 'react'
import { DashboardSummary } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import NetWorthCard from '../components/NetWorthCard'
import AccountCard from '../components/AccountCard'
import NetWorthChart from '../components/NetWorthChart'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Percent, Calendar } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default function DashboardPage(): React.ReactElement {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const { addToast } = useAppStore()

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard(): Promise<void> {
    setLoading(true)
    try {
      const res = await window.api.dashboard.summary()
      if (res.success && res.data) {
        setSummary(res.data)
      }
    } catch {
      addToast('Failed to load dashboard', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-surface-400">Loading dashboard...</div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-surface-400">No data available</div>
      </div>
    )
  }

  const prevNetWorth =
    summary.netWorthHistory.length > 1
      ? summary.netWorthHistory[summary.netWorthHistory.length - 2]?.net_worth
      : undefined

  const spendingChartData = summary.spendingByCategory.map((cat) => ({
    name: cat.category,
    value: cat.amount,
    color: cat.color || '#6b7280'
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <button onClick={loadDashboard} className="btn-ghost text-sm">
          Refresh
        </button>
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1">
          <NetWorthCard netWorth={summary.netWorth} prevNetWorth={prevNetWorth} />
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="text-surface-400 text-sm font-medium">Monthly Income</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(summary.monthlyIncome)}</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-surface-400 text-sm font-medium">Monthly Spending</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(summary.monthlySpending)}</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-4 h-4 text-primary-400" />
            <p className="text-surface-400 text-sm font-medium">Savings Rate</p>
          </div>
          <p className={`text-2xl font-bold ${summary.savingsRate >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
            {summary.savingsRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="section-title">Net Worth History</h2>
          <NetWorthChart data={summary.netWorthHistory} />
        </div>
        <div className="card">
          <h2 className="section-title">Spending by Category</h2>
          {spendingChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={spendingChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {spendingChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Spending']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-surface-500 text-sm">
              No spending data this month
            </div>
          )}
        </div>
      </div>

      {/* Accounts + Upcoming bills */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 card">
          <h2 className="section-title">Accounts</h2>
          {summary.accounts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {summary.accounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-surface-500 text-sm">
              No accounts yet. Add your first account in the Accounts section.
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="section-title">Upcoming Bills</h2>
          {summary.upcomingBills.length > 0 ? (
            <div className="flex flex-col gap-3">
              {summary.upcomingBills.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-surface-500 flex-shrink-0" />
                    <div>
                      <p className="text-surface-200 text-sm font-medium">{bill.name}</p>
                      <p className="text-surface-500 text-xs">
                        {format(new Date(bill.next_date), 'MMM d')}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${bill.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {bill.type === 'income' ? '+' : '-'}{formatCurrency(bill.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-surface-500 text-sm">
              No upcoming bills in the next 30 days
            </div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <h2 className="section-title">Recent Transactions</h2>
        {summary.recentTransactions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Date</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Payee</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Account</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Category</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Amount</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-surface-700/50 hover:bg-surface-800/30 transition-colors">
                  <td className="py-3 px-3 text-surface-400 text-sm whitespace-nowrap">
                    {format(new Date(tx.date), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 px-3 text-surface-100 text-sm font-medium">{tx.payee || '—'}</td>
                  <td className="py-3 px-3 text-surface-400 text-sm">{tx.account_name || '—'}</td>
                  <td className="py-3 px-3">
                    {tx.category_name ? (
                      <span className="badge bg-surface-700 text-surface-300">{tx.category_name}</span>
                    ) : <span className="text-surface-600 text-xs">—</span>}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-semibold text-sm ${
                      ['income','dividend','interest'].includes(tx.type) ? 'text-green-400' :
                      ['expense','fee'].includes(tx.type) ? 'text-red-400' : 'text-surface-300'
                    }`}>
                      {['income','dividend','interest'].includes(tx.type) ? '+' :
                       ['expense','fee'].includes(tx.type) ? '-' : ''}
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Math.abs(tx.amount))}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`badge ${
                      tx.status === 'pending' ? 'bg-yellow-900/40 text-yellow-400' :
                      tx.status === 'posted' ? 'bg-blue-900/40 text-blue-400' :
                      'bg-green-900/40 text-green-400'
                    }`}>{tx.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8 text-surface-500 text-sm">
            No transactions yet. Import or add transactions to get started.
          </div>
        )}
      </div>
    </div>
  )
}
