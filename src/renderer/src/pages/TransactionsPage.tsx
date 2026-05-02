import React, { useEffect, useState, useCallback } from 'react'
import { Transaction, Account, Category, TransactionFilter } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import TransactionForm from '../components/forms/TransactionForm'
import { Plus, Search, CheckSquare, Filter, Edit2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

export default function TransactionsPage(): React.ReactElement {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'review'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | undefined>()
  const [deleteTx, setDeleteTx] = useState<Transaction | undefined>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<TransactionFilter>({})
  const [searchQuery, setSearchQuery] = useState('')
  const { addToast } = useAppStore()

  useEffect(() => {
    loadMeta()
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [activeTab, filter])

  async function loadMeta(): Promise<void> {
    const [accRes, catRes] = await Promise.all([
      window.api.accounts.list(),
      window.api.categories.list()
    ])
    if (accRes.success && accRes.data) setAccounts(accRes.data)
    if (catRes.success && catRes.data) setCategories(catRes.data)
  }

  async function loadTransactions(): Promise<void> {
    setLoading(true)
    const txFilter: TransactionFilter = {
      ...filter,
      status: activeTab === 'review' ? 'pending' : filter.status,
      search: searchQuery || undefined
    }
    const res = await window.api.transactions.list(txFilter)
    if (res.success && res.data) setTransactions(res.data)
    setLoading(false)
  }

  async function handleSearch(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setFilter((prev) => ({ ...prev, search: searchQuery || undefined }))
    loadTransactions()
  }

  async function handleBulkReview(): Promise<void> {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const res = await window.api.transactions.bulkReview(ids)
    if (res.success) {
      addToast(`Marked ${ids.length} transactions as reviewed`, 'success')
      setSelectedIds(new Set())
      loadTransactions()
    } else {
      addToast(res.error || 'Failed to review transactions', 'error')
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTx) return
    const res = await window.api.transactions.delete(deleteTx.id)
    if (res.success) {
      addToast('Transaction deleted', 'success')
      loadTransactions()
    } else {
      addToast(res.error || 'Failed to delete', 'error')
    }
    setDeleteTx(undefined)
  }

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll(): void {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)))
    }
  }

  const pendingCount = transactions.filter((t) => t.status === 'pending').length

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h1 className="page-title">Transactions</h1>
        <button
          onClick={() => { setEditTx(undefined); setShowForm(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-surface-700 text-surface-100'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          All Transactions
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'review'
              ? 'bg-surface-700 text-surface-100'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          Review Queue
          {pendingCount > 0 && (
            <span className="bg-yellow-600 text-yellow-100 text-xs px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-center">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-48">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <input
                className="input pl-9"
                placeholder="Search payee, memo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-secondary">Search</button>
          </form>

          <select
            className="input w-40"
            value={filter.accountId || ''}
            onChange={(e) => setFilter((prev) => ({ ...prev, accountId: e.target.value || undefined }))}
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <input
            className="input w-36"
            type="date"
            value={filter.startDate || ''}
            onChange={(e) => setFilter((prev) => ({ ...prev, startDate: e.target.value || undefined }))}
          />
          <span className="text-surface-500 text-sm">to</span>
          <input
            className="input w-36"
            type="date"
            value={filter.endDate || ''}
            onChange={(e) => setFilter((prev) => ({ ...prev, endDate: e.target.value || undefined }))}
          />

          {(filter.accountId || filter.startDate || filter.endDate || filter.search) && (
            <button
              onClick={() => { setFilter({}); setSearchQuery('') }}
              className="btn-ghost text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary-900/30 border border-primary-800 rounded-xl px-4 py-2.5">
          <span className="text-primary-300 text-sm">{selectedIds.size} selected</span>
          <button onClick={handleBulkReview} className="btn-primary py-1.5 text-sm flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5" />
            Mark as Reviewed
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="btn-ghost text-sm">
            Deselect all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-surface-500">Loading transactions...</div>
        ) : transactions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="py-2 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === transactions.length && transactions.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-surface-600 bg-surface-800 text-primary-600"
                  />
                </th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Date</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Payee</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Account</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Category</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Amount</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Status</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-surface-700 hover:bg-surface-800/50 transition-colors group">
                  <td className="py-3 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="rounded border-surface-600 bg-surface-800 text-primary-600"
                    />
                  </td>
                  <td className="py-3 px-3 text-surface-400 text-sm whitespace-nowrap">
                    {format(new Date(tx.date), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-surface-100 text-sm font-medium">{tx.payee || '—'}</span>
                      {tx.memo && <span className="text-surface-500 text-xs truncate max-w-xs">{tx.memo}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-surface-400 text-sm">{tx.account_name || '—'}</td>
                  <td className="py-3 px-3">
                    {tx.category_name ? (
                      <span className="badge bg-surface-700 text-surface-300">{tx.category_name}</span>
                    ) : (
                      <span className="text-surface-600 text-xs">Uncategorized</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-semibold text-sm ${
                      ['income','dividend','interest','sell'].includes(tx.type) ? 'text-green-400' :
                      ['expense','fee','buy'].includes(tx.type) ? 'text-red-400' : 'text-surface-300'
                    }`}>
                      {['income','dividend','interest','sell'].includes(tx.type) ? '+' :
                       ['expense','fee','buy'].includes(tx.type) ? '-' : ''}
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Math.abs(tx.amount))}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`badge ${
                      tx.status === 'pending' ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800' :
                      tx.status === 'posted' ? 'bg-blue-900/40 text-blue-400 border border-blue-800' :
                      'bg-green-900/40 text-green-400 border border-green-800'
                    }`}>{tx.status}</span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditTx(tx); setShowForm(true) }}
                        className="p-1.5 text-surface-400 hover:text-primary-400 hover:bg-surface-700 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTx(tx)}
                        className="p-1.5 text-surface-400 hover:text-red-400 hover:bg-surface-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-surface-500 text-sm">
            {activeTab === 'review' ? 'No transactions in review queue' : 'No transactions found'}
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditTx(undefined) }}
        title={editTx ? 'Edit Transaction' : 'Add Transaction'}
      >
        <TransactionForm
          transaction={editTx}
          accounts={accounts}
          categories={categories}
          onSuccess={() => { setShowForm(false); setEditTx(undefined); loadTransactions() }}
          onCancel={() => { setShowForm(false); setEditTx(undefined) }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTx}
        onClose={() => setDeleteTx(undefined)}
        onConfirm={handleDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This cannot be undone."
        confirmLabel="Delete"
        isDestructive
      />
    </div>
  )
}
