import React, { useState } from 'react'
import { ProjectionResult, ProjectionAssumptions } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import NetWorthChart from '../components/NetWorthChart'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const DEFAULT_ASSUMPTIONS: ProjectionAssumptions = {
  investmentReturnRate: 0.07,
  inflationRate: 0.03,
  incomeGrowthRate: 0.03,
  monthsToProject: 60,
  additionalMonthlyContribution: 0
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

export default function ProjectionsPage(): React.ReactElement {
  const [assumptions, setAssumptions] = useState<ProjectionAssumptions>(DEFAULT_ASSUMPTIONS)
  const [result, setResult] = useState<ProjectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const { addToast } = useAppStore()

  async function runProjection(): Promise<void> {
    setLoading(true)
    try {
      const res = await window.api.projections.run(assumptions)
      if (res.success && res.data) {
        setResult(res.data)
      } else {
        addToast(res.error || 'Projection failed', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleAssumptionChange(field: keyof ProjectionAssumptions, value: number): void {
    setAssumptions((prev) => ({ ...prev, [field]: value }))
  }

  const chartData = result?.months.map((m) => ({
    month: m.month,
    netWorth: m.netWorth,
    assets: m.totalAssets,
    liabilities: m.totalLiabilities
  })) || []

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h1 className="page-title">Projections</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Assumptions panel */}
        <div className="col-span-1 flex flex-col gap-4">
          <div className="card">
            <h2 className="section-title">Assumptions</h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Investment Return Rate</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="30"
                    value={(assumptions.investmentReturnRate * 100).toFixed(1)}
                    onChange={(e) =>
                      handleAssumptionChange('investmentReturnRate', parseFloat(e.target.value) / 100)
                    }
                  />
                  <span className="text-surface-400 text-sm">%/yr</span>
                </div>
              </div>

              <div>
                <label className="label">Inflation Rate</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={(assumptions.inflationRate * 100).toFixed(1)}
                    onChange={(e) =>
                      handleAssumptionChange('inflationRate', parseFloat(e.target.value) / 100)
                    }
                  />
                  <span className="text-surface-400 text-sm">%/yr</span>
                </div>
              </div>

              <div>
                <label className="label">Income Growth Rate</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={(assumptions.incomeGrowthRate * 100).toFixed(1)}
                    onChange={(e) =>
                      handleAssumptionChange('incomeGrowthRate', parseFloat(e.target.value) / 100)
                    }
                  />
                  <span className="text-surface-400 text-sm">%/yr</span>
                </div>
              </div>

              <div>
                <label className="label">Projection Period</label>
                <select
                  className="input"
                  value={assumptions.monthsToProject}
                  onChange={(e) =>
                    handleAssumptionChange('monthsToProject', parseInt(e.target.value))
                  }
                >
                  <option value="12">12 months (1 year)</option>
                  <option value="24">24 months (2 years)</option>
                  <option value="60">60 months (5 years)</option>
                  <option value="120">120 months (10 years)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">What If?</h2>
            <div>
              <label className="label">Extra Monthly Contribution</label>
              <div className="flex items-center gap-2">
                <span className="text-surface-400 text-sm">$</span>
                <input
                  className="input"
                  type="number"
                  step="50"
                  min="0"
                  value={assumptions.additionalMonthlyContribution || 0}
                  onChange={(e) =>
                    handleAssumptionChange(
                      'additionalMonthlyContribution',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="0"
                />
                <span className="text-surface-400 text-sm">/mo</span>
              </div>
              <p className="text-surface-500 text-xs mt-1">
                See how extra savings affects your trajectory
              </p>
            </div>
          </div>

          <button
            onClick={runProjection}
            disabled={loading}
            className="btn-primary w-full py-2.5"
          >
            {loading ? 'Running...' : 'Run Projection'}
          </button>
        </div>

        {/* Results */}
        <div className="col-span-2 flex flex-col gap-4">
          {result ? (
            <>
              {/* Net worth chart */}
              <div className="card">
                <h2 className="section-title">Projected Net Worth</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                      interval={Math.floor(chartData.length / 6)}
                    />
                    <YAxis
                      tickFormatter={formatCurrency}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                      width={75}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9'
                      }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      name="Net Worth"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="assets"
                      name="Total Assets"
                      stroke="#22c55e"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                    <Line
                      type="monotone"
                      dataKey="liabilities"
                      name="Liabilities"
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Debt payoff dates */}
              {Object.keys(result.debtPayoffDates).length > 0 && (
                <div className="card">
                  <h2 className="section-title">Projected Debt Payoff Dates</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(result.debtPayoffDates).map(([accountId, date]) => (
                      <div key={accountId} className="bg-green-900/20 border border-green-900 rounded-lg p-3">
                        <p className="text-green-400 text-sm font-medium">Paid off: {date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly snapshots table */}
              <div className="card">
                <h2 className="section-title">Monthly Snapshot</h2>
                <div className="overflow-y-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-800">
                      <tr className="border-b border-surface-700">
                        <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Month</th>
                        <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Assets</th>
                        <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Liabilities</th>
                        <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Net Worth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.months
                        .filter((_, i) => i % Math.max(1, Math.floor(result.months.length / 24)) === 0)
                        .map((m) => (
                          <tr key={m.month} className="border-b border-surface-700/50 hover:bg-surface-800/30">
                            <td className="py-2 px-3 text-surface-400">{m.month}</td>
                            <td className="py-2 px-3 text-right text-green-400">{formatCurrency(m.totalAssets)}</td>
                            <td className="py-2 px-3 text-right text-red-400">{formatCurrency(m.totalLiabilities)}</td>
                            <td className={`py-2 px-3 text-right font-semibold ${m.netWorth >= 0 ? 'text-surface-100' : 'text-red-400'}`}>
                              {formatCurrency(m.netWorth)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="text-surface-500 mb-2 text-lg">No projection run yet</div>
              <p className="text-surface-600 text-sm mb-4">
                Configure your assumptions and click "Run Projection" to see a forecast.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
