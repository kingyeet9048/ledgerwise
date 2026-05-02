import React from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AllocationData {
  name: string
  value: number
  color: string
}

interface AllocationChartProps {
  data: AllocationData[]
  title?: string
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  us_equity: '#3b82f6',
  intl_equity: '#8b5cf6',
  bonds: '#10b981',
  cash: '#f59e0b',
  real_estate: '#ef4444',
  crypto: '#f97316',
  other: '#6b7280'
}

export function getAssetClassColor(assetClass: string): string {
  return ASSET_CLASS_COLORS[assetClass] || '#6b7280'
}

export default function AllocationChart({ data, title }: AllocationChartProps): React.ReactElement {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-surface-500 text-sm">
        No holdings data
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {title && <h3 className="text-surface-300 text-sm font-medium">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Allocation']}
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
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
