import React, { useState } from 'react'
import { Holding, Account, AssetClass, TaxBucket } from '../../../../shared/types'
import { useAppStore } from '../../store/appStore'

interface HoldingFormProps {
  holding?: Holding
  accounts: Account[]
  onSuccess: (holding: Holding) => void
  onCancel: () => void
}

const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: 'us_equity', label: 'US Equity' },
  { value: 'intl_equity', label: 'International Equity' },
  { value: 'bonds', label: 'Bonds/Fixed Income' },
  { value: 'cash', label: 'Cash/Money Market' },
  { value: 'real_estate', label: 'Real Estate (REIT)' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' }
]

const TAX_BUCKETS: { value: TaxBucket; label: string }[] = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'tax_deferred', label: 'Tax-Deferred (401k/IRA)' },
  { value: 'tax_free', label: 'Tax-Free (Roth)' }
]

export default function HoldingForm({ holding, accounts, onSuccess, onCancel }: HoldingFormProps): React.ReactElement {
  const { addToast } = useAppStore()
  const [loading, setLoading] = useState(false)

  const investmentAccounts = accounts.filter((a) =>
    ['brokerage', 'retirement', 'hsa'].includes(a.type)
  )

  const [form, setForm] = useState({
    account_id: holding?.account_id || investmentAccounts[0]?.id || accounts[0]?.id || '',
    symbol: holding?.symbol || '',
    name: holding?.name || '',
    quantity: holding?.quantity || 0,
    cost_basis: holding?.cost_basis ?? '',
    current_price: holding?.current_price ?? '',
    current_value: holding?.current_value ?? '',
    asset_class: holding?.asset_class || '' as AssetClass | '',
    tax_bucket: holding?.tax_bucket || '' as TaxBucket | ''
  })

  function handleChange(field: string, value: unknown): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.name.trim()) {
      addToast('Holding name is required', 'error')
      return
    }
    if (!form.account_id) {
      addToast('Please select an account', 'error')
      return
    }

    setLoading(true)
    try {
      const quantity = parseFloat(String(form.quantity)) || 0
      const currentPrice = form.current_price !== '' ? parseFloat(String(form.current_price)) : undefined
      const currentValue = form.current_value !== ''
        ? parseFloat(String(form.current_value))
        : currentPrice && quantity ? quantity * currentPrice : undefined

      const payload = {
        account_id: form.account_id,
        symbol: form.symbol || undefined,
        name: form.name,
        quantity,
        cost_basis: form.cost_basis !== '' ? parseFloat(String(form.cost_basis)) : undefined,
        current_price: currentPrice,
        current_value: currentValue,
        asset_class: (form.asset_class as AssetClass) || undefined,
        tax_bucket: (form.tax_bucket as TaxBucket) || undefined
      }

      const res = holding
        ? await window.api.holdings.update(holding.id, payload)
        : await window.api.holdings.create(payload)

      if (res.success && res.data) {
        addToast(`Holding ${holding ? 'updated' : 'created'} successfully`, 'success')
        onSuccess(res.data)
      } else {
        addToast(res.error || 'Failed to save holding', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Account *</label>
        <select
          className="input"
          value={form.account_id}
          onChange={(e) => handleChange('account_id', e.target.value)}
          required
        >
          <option value="">Select account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Symbol/Ticker</label>
          <input
            className="input"
            value={form.symbol}
            onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
            placeholder="e.g. VTSAX"
          />
        </div>
        <div>
          <label className="label">Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Vanguard Total Stock"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Quantity/Shares</label>
          <input
            className="input"
            type="number"
            step="0.0001"
            min="0"
            value={form.quantity}
            onChange={(e) => handleChange('quantity', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Current Price</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={form.current_price}
            onChange={(e) => handleChange('current_price', e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="label">Cost Basis</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={form.cost_basis}
            onChange={(e) => handleChange('cost_basis', e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Asset Class</label>
          <select
            className="input"
            value={form.asset_class}
            onChange={(e) => handleChange('asset_class', e.target.value)}
          >
            <option value="">Select class</option>
            {ASSET_CLASSES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tax Bucket</label>
          <select
            className="input"
            value={form.tax_bucket}
            onChange={(e) => handleChange('tax_bucket', e.target.value)}
          >
            <option value="">Select bucket</option>
            {TAX_BUCKETS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : holding ? 'Update Holding' : 'Add Holding'}
        </button>
      </div>
    </form>
  )
}
