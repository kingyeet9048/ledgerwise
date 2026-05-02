import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CashFlowData {
  month: string
  income: number
  spending: number
}

interface CashFlowChartProps {
  data: CashFlowData[]
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

export default function CashFlowChart({ data }: CashFlowChartProps): React.ReactElement {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-surface-500 text-sm">
        No cash flow data
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="month"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value)]}
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#f1f5f9'
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'capitalize' }}>{value}</span>
          )}
        />
        <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="spending" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
