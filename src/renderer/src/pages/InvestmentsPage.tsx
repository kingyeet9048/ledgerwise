import React, { useEffect, useState } from 'react'
import { Holding, Account, AllocationTarget } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import HoldingForm from '../components/forms/HoldingForm'
import AllocationChart, { getAssetClassColor } from '../components/AllocationChart'
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown } from 'lucide-react'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

function getAssetClassLabel(cls: string): string {
  const labels: Record<string, string> = {
    us_equity: 'US Equity',
    intl_equity: 'Intl Equity',
    bonds: 'Bonds',
    cash: 'Cash',
    real_estate: 'Real Estate',
    crypto: 'Crypto',
    other: 'Other'
  }
  return labels[cls] || cls
}

export default function InvestmentsPage(): React.ReactElement {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [allocationTargets, setAllocationTargets] = useState<AllocationTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editHolding, setEditHolding] = useState<Holding | undefined>()
  const [deleteHolding, setDeleteHolding] = useState<Holding | undefined>()
  const { addToast } = useAppStore()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(): Promise<void> {
    setLoading(true)
    const [holdingsRes, accountsRes, targetsRes] = await Promise.all([
      window.api.holdings.list(),
      window.api.accounts.list(),
      window.api.allocationTargets.list()
    ])
    if (holdingsRes.success && holdingsRes.data) setHoldings(holdingsRes.data)
    if (accountsRes.success && accountsRes.data) setAccounts(accountsRes.data)
    if (targetsRes.success && targetsRes.data) setAllocationTargets(targetsRes.data)
    setLoading(false)
  }

  async function handleDelete(): Promise<void> {
    if (!deleteHolding) return
    const res = await window.api.holdings.delete(deleteHolding.id)
    if (res.success) {
      addToast('Holding deleted', 'success')
      loadData()
    } else {
      addToast(res.error || 'Failed to delete', 'error')
    }
    setDeleteHolding(undefined)
  }

  const totalValue = holdings.reduce((s, h) => s + (h.current_value || 0), 0)
  const totalCostBasis = holdings.reduce((s, h) => s + (h.cost_basis || 0), 0)
  const totalGainLoss = totalValue - totalCostBasis
  const gainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0

  // Build allocation data
  const allocationByClass: Record<string, number> = {}
  for (const h of holdings) {
    const cls = h.asset_class || 'other'
    allocationByClass[cls] = (allocationByClass[cls] || 0) + (h.current_value || 0)
  }

  const allocationData = Object.entries(allocationByClass)
    .filter(([, val]) => val > 0)
    .map(([cls, val]) => ({
      name: getAssetClassLabel(cls),
      value: totalValue > 0 ? (val / totalValue) * 100 : 0,
      color: getAssetClassColor(cls)
    }))

  // Drift calculations
  const targetMap: Record<string, number> = {}
  for (const t of allocationTargets) {
    targetMap[t.asset_class] = t.target_pct
  }

  const driftData = Object.entries(allocationByClass).map(([cls, val]) => {
    const currentPct = totalValue > 0 ? (val / totalValue) * 100 : 0
    const target = targetMap[cls] || 0
    const drift = currentPct - target
    return {
      cls,
      label: getAssetClassLabel(cls),
      currentPct,
      targetPct: target,
      drift,
      color: getAssetClassColor(cls)
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h1 className="page-title">Investments</h1>
        <button
          onClick={() => { setEditHolding(undefined); setShowForm(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Holding
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="metric-card">
          <p className="text-surface-400 text-sm mb-1">Total Portfolio Value</p>
          <p className="text-2xl font-bold text-surface-50">{formatCurrency(totalValue)}</p>
        </div>
        <div className="metric-card">
          <p className="text-surface-400 text-sm mb-1">Total Cost Basis</p>
          <p className="text-2xl font-bold text-surface-300">{formatCurrency(totalCostBasis)}</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-1">
            {totalGainLoss >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <p className="text-surface-400 text-sm">Total Gain/Loss</p>
          </div>
          <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss)}
            <span className="text-base ml-1">({gainLossPct.toFixed(2)}%)</span>
          </p>
        </div>
      </div>

      {/* Allocation + Drift */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="section-title">Asset Allocation</h2>
          <AllocationChart data={allocationData} />
        </div>

        <div className="card">
          <h2 className="section-title">Allocation vs Target</h2>
          {driftData.length > 0 ? (
            <div className="flex flex-col gap-3 mt-2">
              {driftData.map((d) => (
                <div key={d.cls}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-surface-300 font-medium">{d.label}</span>
                    <span className={`font-medium ${Math.abs(d.drift) > 5 ? 'text-yellow-400' : 'text-surface-400'}`}>
                      {d.currentPct.toFixed(1)}% {d.targetPct > 0 && `(target: ${d.targetPct}%)`}
                      {d.drift !== 0 && (
                        <span className={d.drift > 0 ? 'text-red-400 ml-1' : 'text-green-400 ml-1'}>
                          {d.drift > 0 ? '+' : ''}{d.drift.toFixed(1)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(d.currentPct, 100)}%`, backgroundColor: d.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-surface-500 text-sm">
              No holdings to analyze
            </div>
          )}
        </div>
      </div>

      {/* Holdings table */}
      <div className="card">
        <h2 className="section-title">Holdings</h2>
        {loading ? (
          <div className="text-center py-8 text-surface-500">Loading...</div>
        ) : holdings.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Symbol</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Name</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Account</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Quantity</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Price</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Value</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Cost Basis</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Gain/Loss</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Class</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const gainLoss = (h.current_value || 0) - (h.cost_basis || 0)
                const gainPct = h.cost_basis ? (gainLoss / h.cost_basis) * 100 : 0
                return (
                  <tr key={h.id} className="border-b border-surface-700 hover:bg-surface-800/50 group">
                    <td className="py-3 px-3 text-primary-400 font-mono text-sm font-medium">
                      {h.symbol || '—'}
                    </td>
                    <td className="py-3 px-3 text-surface-200 text-sm max-w-xs truncate">{h.name}</td>
                    <td className="py-3 px-3 text-surface-400 text-sm">{h.account_name || '—'}</td>
                    <td className="py-3 px-3 text-right text-surface-300 text-sm">
                      {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <td className="py-3 px-3 text-right text-surface-300 text-sm">
                      {h.current_price ? formatCurrency(h.current_price) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-surface-100 font-medium text-sm">
                      {h.current_value ? formatCurrency(h.current_value) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-surface-400 text-sm">
                      {h.cost_basis ? formatCurrency(h.cost_basis) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-sm">
                      {h.cost_basis && h.current_value ? (
                        <span className={gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}
                          <span className="text-xs ml-1">({gainPct.toFixed(1)}%)</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      {h.asset_class && (
                        <span
                          className="badge text-white text-xs"
                          style={{ backgroundColor: getAssetClassColor(h.asset_class) + '40', color: getAssetClassColor(h.asset_class) }}
                        >
                          {getAssetClassLabel(h.asset_class)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditHolding(h); setShowForm(true) }}
                          className="p-1.5 text-surface-400 hover:text-primary-400 hover:bg-surface-700 rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteHolding(h)}
                          className="p-1.5 text-surface-400 hover:text-red-400 hover:bg-surface-700 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-surface-500 text-sm">
            No holdings yet. Add your investments to track your portfolio.
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditHolding(undefined) }}
        title={editHolding ? 'Edit Holding' : 'Add Holding'}
        size="lg"
      >
        <HoldingForm
          holding={editHolding}
          accounts={accounts}
          onSuccess={() => { setShowForm(false); setEditHolding(undefined); loadData() }}
          onCancel={() => { setShowForm(false); setEditHolding(undefined) }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteHolding}
        onClose={() => setDeleteHolding(undefined)}
        onConfirm={handleDelete}
        title="Delete Holding"
        message={`Delete "${deleteHolding?.name}"?`}
        confirmLabel="Delete"
        isDestructive
      />
    </div>
  )
}
