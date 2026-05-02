import React, { useEffect, useState } from 'react'
import { Account, AccountType } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import AccountForm from '../components/forms/AccountForm'
import { Plus, Edit2, Trash2 } from 'lucide-react'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const ASSET_TYPES: AccountType[] = [
  'checking', 'savings', 'brokerage', 'retirement', 'hsa', 'real_estate', 'manual_asset'
]

const LIABILITY_TYPES: AccountType[] = ['credit_card', 'loan', 'student_loan', 'liability']

function getTypeLabel(type: AccountType): string {
  const labels: Partial<Record<AccountType, string>> = {
    checking: 'Checking',
    savings: 'Savings',
    credit_card: 'Credit Card',
    loan: 'Loan',
    student_loan: 'Student Loan',
    brokerage: 'Brokerage',
    retirement: 'Retirement',
    hsa: 'HSA',
    real_estate: 'Real Estate',
    manual_asset: 'Manual Asset',
    liability: 'Other Liability'
  }
  return labels[type] || type
}

export default function AccountsPage(): React.ReactElement {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | undefined>()
  const [deleteAccount, setDeleteAccount] = useState<Account | undefined>()
  const { addToast } = useAppStore()

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts(): Promise<void> {
    setLoading(true)
    const res = await window.api.accounts.list()
    if (res.success && res.data) setAccounts(res.data)
    setLoading(false)
  }

  function handleFormSuccess(account: Account): void {
    setShowForm(false)
    setEditAccount(undefined)
    loadAccounts()
  }

  async function handleDelete(): Promise<void> {
    if (!deleteAccount) return
    const res = await window.api.accounts.delete(deleteAccount.id)
    if (res.success) {
      addToast('Account removed', 'success')
      loadAccounts()
    } else {
      addToast(res.error || 'Failed to remove account', 'error')
    }
    setDeleteAccount(undefined)
  }

  const assets = accounts.filter((a) => ASSET_TYPES.includes(a.type))
  const liabilities = accounts.filter((a) => LIABILITY_TYPES.includes(a.type))

  const totalAssets = assets.reduce((sum, a) => sum + Math.max(a.balance, 0), 0)
  const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(Math.min(a.balance, 0)), 0)
  const netWorth = totalAssets - totalLiabilities

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h1 className="page-title">Accounts</h1>
        <button
          onClick={() => { setEditAccount(undefined); setShowForm(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="metric-card">
          <p className="text-surface-400 text-sm mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(totalAssets)}</p>
        </div>
        <div className="metric-card">
          <p className="text-surface-400 text-sm mb-1">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(totalLiabilities)}</p>
        </div>
        <div className="metric-card">
          <p className="text-surface-400 text-sm mb-1">Net Worth</p>
          <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-surface-50' : 'text-red-400'}`}>
            {formatCurrency(netWorth)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-surface-500">Loading accounts...</div>
      ) : (
        <>
          {/* Assets */}
          <div className="card">
            <h2 className="section-title text-green-400">Assets</h2>
            {assets.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Account</th>
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Institution</th>
                    <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Balance</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((account) => (
                    <tr key={account.id} className="border-b border-surface-700 hover:bg-surface-800/50 group">
                      <td className="py-3 px-3 text-surface-100 font-medium text-sm">{account.name}</td>
                      <td className="py-3 px-3 text-surface-400 text-sm">{getTypeLabel(account.type)}</td>
                      <td className="py-3 px-3 text-surface-400 text-sm">{account.institution || '—'}</td>
                      <td className="py-3 px-3 text-right text-green-400 font-semibold text-sm">
                        {formatCurrency(account.balance)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditAccount(account); setShowForm(true) }}
                            className="p-1.5 text-surface-400 hover:text-primary-400 hover:bg-surface-700 rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteAccount(account)}
                            className="p-1.5 text-surface-400 hover:text-red-400 hover:bg-surface-700 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-surface-600">
                    <td colSpan={3} className="py-3 px-3 text-surface-300 text-sm font-semibold">Total Assets</td>
                    <td className="py-3 px-3 text-right text-green-400 font-bold text-sm">{formatCurrency(totalAssets)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="text-surface-500 text-sm py-4">No asset accounts yet</p>
            )}
          </div>

          {/* Liabilities */}
          <div className="card">
            <h2 className="section-title text-red-400">Liabilities</h2>
            {liabilities.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Account</th>
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Institution</th>
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Interest Rate</th>
                    <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Balance</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {liabilities.map((account) => (
                    <tr key={account.id} className="border-b border-surface-700 hover:bg-surface-800/50 group">
                      <td className="py-3 px-3 text-surface-100 font-medium text-sm">{account.name}</td>
                      <td className="py-3 px-3 text-surface-400 text-sm">{getTypeLabel(account.type)}</td>
                      <td className="py-3 px-3 text-surface-400 text-sm">{account.institution || '—'}</td>
                      <td className="py-3 px-3 text-surface-400 text-sm">
                        {account.interest_rate ? `${account.interest_rate}%` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-red-400 font-semibold text-sm">
                        {formatCurrency(Math.abs(account.balance))}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditAccount(account); setShowForm(true) }}
                            className="p-1.5 text-surface-400 hover:text-primary-400 hover:bg-surface-700 rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteAccount(account)}
                            className="p-1.5 text-surface-400 hover:text-red-400 hover:bg-surface-700 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-surface-600">
                    <td colSpan={4} className="py-3 px-3 text-surface-300 text-sm font-semibold">Total Liabilities</td>
                    <td className="py-3 px-3 text-right text-red-400 font-bold text-sm">{formatCurrency(totalLiabilities)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="text-surface-500 text-sm py-4">No liability accounts yet</p>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditAccount(undefined) }}
        title={editAccount ? 'Edit Account' : 'Add Account'}
      >
        <AccountForm
          account={editAccount}
          onSuccess={handleFormSuccess}
          onCancel={() => { setShowForm(false); setEditAccount(undefined) }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteAccount}
        onClose={() => setDeleteAccount(undefined)}
        onConfirm={handleDelete}
        title="Remove Account"
        message={`Are you sure you want to remove "${deleteAccount?.name}"? This will close the account but preserve its transactions.`}
        confirmLabel="Remove"
        isDestructive
      />
    </div>
  )
}
