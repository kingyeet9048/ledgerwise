import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { NetWorthSnapshot } from '../../../shared/types'
import { format, parseISO } from 'date-fns'

interface NetWorthChartProps {
  data: NetWorthSnapshot[]
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

export default function NetWorthChart({ data }: NetWorthChartProps): React.ReactElement {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-surface-500 text-sm">
        No net worth history yet
      </div>
    )
  }

  const chartData = data.map((snap) => ({
    date: format(parseISO(snap.date), 'MMM yy'),
    netWorth: snap.net_worth,
    assets: snap.total_assets,
    liabilities: snap.total_liabilities
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
          width={70}
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
        <Line
          type="monotone"
          dataKey="netWorth"
          name="Net Worth"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
