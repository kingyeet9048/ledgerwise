import React, { useEffect, useState } from 'react'
import { Category, CategoryRule, RecurringItem } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { Plus, Trash2, Download, Upload, FileDown, Key, Eye, EyeOff } from 'lucide-react'

type SettingsTab = 'categories' | 'rules' | 'recurring' | 'backup' | 'passphrase'

export default function SettingsPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('categories')
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [recurring, setRecurring] = useState<RecurringItem[]>([])
  const [loading, setLoading] = useState(true)
  const { addToast } = useAppStore()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(): Promise<void> {
    setLoading(true)
    const [catRes, ruleRes, recRes] = await Promise.all([
      window.api.categories.list(),
      window.api.categoryRules.list(),
      window.api.recurring.list()
    ])
    if (catRes.success && catRes.data) setCategories(catRes.data)
    if (ruleRes.success && ruleRes.data) setRules(ruleRes.data)
    if (recRes.success && recRes.data) setRecurring(recRes.data)
    setLoading(false)
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'categories', label: 'Categories' },
    { id: 'rules', label: 'Category Rules' },
    { id: 'recurring', label: 'Recurring Items' },
    { id: 'backup', label: 'Backup & Export' },
    { id: 'passphrase', label: 'Change Passphrase' }
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-surface-700 text-surface-100'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-surface-500">Loading...</div>
      ) : (
        <>
          {activeTab === 'categories' && (
            <CategoriesTab categories={categories} onRefresh={loadData} addToast={addToast} />
          )}
          {activeTab === 'rules' && (
            <RulesTab rules={rules} categories={categories} onRefresh={loadData} addToast={addToast} />
          )}
          {activeTab === 'recurring' && (
            <RecurringTab recurring={recurring} onRefresh={loadData} addToast={addToast} />
          )}
          {activeTab === 'backup' && (
            <BackupTab addToast={addToast} />
          )}
          {activeTab === 'passphrase' && (
            <PassphraseTab addToast={addToast} />
          )}
        </>
      )}
    </div>
  )
}

// Categories Tab
function CategoriesTab({ categories, onRefresh, addToast }: {
  categories: Category[]
  onRefresh: () => void
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}): React.ReactElement {
  const [showForm, setShowForm] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', type: 'expense' as Category['type'], color: '#6b7280' })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const customCategories = categories.filter((c) => !c.is_system)
  const systemCategories = categories.filter((c) => c.is_system && !c.parent_id)

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!newCat.name.trim()) return
    const res = await window.api.categories.create(newCat)
    if (res.success) {
      addToast('Category created', 'success')
      setShowForm(false)
      setNewCat({ name: '', type: 'expense', color: '#6b7280' })
      onRefresh()
    } else {
      addToast(res.error || 'Failed to create', 'error')
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteId) return
    const res = await window.api.categories.delete(deleteId)
    if (res.success) {
      addToast('Category deleted', 'success')
      onRefresh()
    } else {
      addToast(res.error || 'Failed to delete', 'error')
    }
    setDeleteId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <p className="text-surface-400 text-sm">Manage spending and income categories</p>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Custom categories */}
      <div className="card">
        <h3 className="text-surface-200 font-medium mb-3">Custom Categories</h3>
        {customCategories.length > 0 ? (
          <div className="flex flex-col gap-2">
            {customCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2 border-b border-surface-700 last:border-0">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color || '#6b7280' }}
                  />
                  <span className="text-surface-200 text-sm">{cat.name}</span>
                  <span className="badge bg-surface-700 text-surface-400">{cat.type}</span>
                </div>
                <button
                  onClick={() => setDeleteId(cat.id)}
                  className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-surface-700 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-surface-500 text-sm">No custom categories yet</p>
        )}
      </div>

      {/* System categories summary */}
      <div className="card">
        <h3 className="text-surface-200 font-medium mb-3">System Categories ({categories.filter(c => c.is_system).length})</h3>
        <div className="flex flex-wrap gap-2">
          {systemCategories.map((cat) => (
            <span key={cat.id} className="badge bg-surface-700 text-surface-400">
              {cat.name}
            </span>
          ))}
        </div>
        <p className="text-surface-600 text-xs mt-2">System categories cannot be deleted</p>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Category" size="sm">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={newCat.name}
              onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))}
              placeholder="Category name"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={newCat.type}
                onChange={(e) => setNewCat((p) => ({ ...p, type: e.target.value as Category['type'] }))}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label className="label">Color</label>
              <input
                className="input h-9"
                type="color"
                value={newCat.color}
                onChange={(e) => setNewCat((p) => ({ ...p, color: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message="Delete this category? Transactions assigned to it will become uncategorized."
        confirmLabel="Delete"
        isDestructive
      />
    </div>
  )
}

// Rules Tab
function RulesTab({ rules, categories, onRefresh, addToast }: {
  rules: CategoryRule[]
  categories: Category[]
  onRefresh: () => void
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}): React.ReactElement {
  const [showForm, setShowForm] = useState(false)
  const [newRule, setNewRule] = useState({ pattern: '', category_id: '', field: 'payee', priority: 0 })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!newRule.pattern || !newRule.category_id) return
    const res = await window.api.categoryRules.create(newRule)
    if (res.success) {
      addToast('Rule created', 'success')
      setShowForm(false)
      setNewRule({ pattern: '', category_id: '', field: 'payee', priority: 0 })
      onRefresh()
    } else {
      addToast(res.error || 'Failed to create rule', 'error')
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteId) return
    const res = await window.api.categoryRules.delete(deleteId)
    if (res.success) {
      addToast('Rule deleted', 'success')
      onRefresh()
    } else {
      addToast(res.error || 'Failed to delete', 'error')
    }
    setDeleteId(null)
  }

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <p className="text-surface-400 text-sm">Auto-categorize transactions based on payee/memo patterns</p>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      <div className="card">
        {rules.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Pattern</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Field</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Category</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Priority</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-surface-700/50 hover:bg-surface-800/30">
                  <td className="py-2.5 px-3 text-surface-200 text-sm font-mono">{rule.pattern}</td>
                  <td className="py-2.5 px-3 text-surface-400 text-sm capitalize">{rule.field}</td>
                  <td className="py-2.5 px-3 text-surface-300 text-sm">{catMap[rule.category_id] || '—'}</td>
                  <td className="py-2.5 px-3 text-right text-surface-400 text-sm">{rule.priority}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setDeleteId(rule.id)}
                      className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-surface-700 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8 text-surface-500 text-sm">
            No rules yet. Add rules to automatically categorize imported transactions.
          </div>
        )}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Category Rule" size="sm">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="label">Pattern (case-insensitive contains)</label>
            <input
              className="input font-mono"
              value={newRule.pattern}
              onChange={(e) => setNewRule((p) => ({ ...p, pattern: e.target.value }))}
              placeholder="e.g. Amazon, Whole Foods"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Match Field</label>
              <select
                className="input"
                value={newRule.field}
                onChange={(e) => setNewRule((p) => ({ ...p, field: e.target.value }))}
              >
                <option value="payee">Payee</option>
                <option value="memo">Memo</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <input
                className="input"
                type="number"
                value={newRule.priority}
                onChange={(e) => setNewRule((p) => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Assign to Category</label>
            <select
              className="input"
              value={newRule.category_id}
              onChange={(e) => setNewRule((p) => ({ ...p, category_id: e.target.value }))}
              required
            >
              <option value="">Select category</option>
              {categories.filter((c) => !c.parent_id || c.parent_id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Rule</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Rule"
        message="Delete this category rule?"
        confirmLabel="Delete"
        isDestructive
      />
    </div>
  )
}

// Recurring Tab
function RecurringTab({ recurring, onRefresh, addToast }: {
  recurring: RecurringItem[]
  onRefresh: () => void
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}): React.ReactElement {
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', amount: 0, type: 'expense' as 'income' | 'expense',
    frequency: 'monthly' as RecurringItem['frequency'],
    next_date: new Date().toISOString().split('T')[0]
  })

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const res = await window.api.recurring.create({
      ...form,
      amount: parseFloat(String(form.amount)),
      is_active: 1
    })
    if (res.success) {
      addToast('Recurring item created', 'success')
      setShowForm(false)
      onRefresh()
    } else {
      addToast(res.error || 'Failed', 'error')
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteId) return
    const res = await window.api.recurring.delete(deleteId)
    if (res.success) {
      addToast('Removed', 'success')
      onRefresh()
    }
    setDeleteId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <p className="text-surface-400 text-sm">Track bills, subscriptions, and income for projections</p>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      <div className="card">
        {recurring.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Name</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Type</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Frequency</th>
                <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Amount</th>
                <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Next Date</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((item) => (
                <tr key={item.id} className="border-b border-surface-700/50 hover:bg-surface-800/30">
                  <td className="py-2.5 px-3 text-surface-200 text-sm">{item.name}</td>
                  <td className="py-2.5 px-3">
                    <span className={`badge ${item.type === 'income' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-surface-400 text-sm capitalize">{item.frequency}</td>
                  <td className={`py-2.5 px-3 text-right font-medium text-sm ${item.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    ${item.amount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-surface-400 text-sm">{item.next_date}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-surface-700 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8 text-surface-500 text-sm">
            No recurring items. Add bills and subscriptions to use in projections.
          </div>
        )}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Recurring Item" size="sm">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as 'income' | 'expense' }))}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input className="input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Frequency</label>
              <select className="input" value={form.frequency} onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as RecurringItem['frequency'] }))}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
            <div>
              <label className="label">Next Date</label>
              <input className="input" type="date" value={form.next_date} onChange={(e) => setForm((p) => ({ ...p, next_date: e.target.value }))} required />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remove Recurring Item"
        message="Remove this recurring item?"
        confirmLabel="Remove"
        isDestructive
      />
    </div>
  )
}

// Backup Tab
function BackupTab({ addToast }: {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}): React.ReactElement {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleExportBackup(): Promise<void> {
    setLoading('backup')
    const res = await window.api.backup.export()
    if (res.success) {
      addToast('Backup exported successfully', 'success')
    } else if (res.error !== 'Cancelled') {
      addToast(res.error || 'Export failed', 'error')
    }
    setLoading(null)
  }

  async function handleImportBackup(): Promise<void> {
    setLoading('import')
    const res = await window.api.backup.import()
    if (res.success) {
      addToast('Backup restored successfully', 'success')
    } else if (res.error !== 'Cancelled') {
      addToast(res.error || 'Import failed', 'error')
    }
    setLoading(null)
  }

  async function handleExportCSV(): Promise<void> {
    setLoading('csv')
    const res = await window.api.exportCsv()
    if (res.success) {
      addToast('CSV exported successfully', 'success')
    } else if (res.error !== 'Cancelled') {
      addToast(res.error || 'Export failed', 'error')
    }
    setLoading(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 max-w-xl">
        <div className="card flex flex-col gap-3">
          <div>
            <h3 className="text-surface-100 font-semibold">Encrypted Backup</h3>
            <p className="text-surface-500 text-sm">Export all your data as an encrypted .lwbak file</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportBackup}
              disabled={loading === 'backup'}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              {loading === 'backup' ? 'Exporting...' : 'Export Backup'}
            </button>
            <button
              onClick={handleImportBackup}
              disabled={loading === 'import'}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4" />
              {loading === 'import' ? 'Importing...' : 'Import Backup'}
            </button>
          </div>
          <p className="text-surface-600 text-xs">
            Warning: Importing a backup will overwrite all current data.
          </p>
        </div>

        <div className="card flex flex-col gap-3">
          <div>
            <h3 className="text-surface-100 font-semibold">Export as CSV</h3>
            <p className="text-surface-500 text-sm">Export all transactions as a CSV file for external analysis</p>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={loading === 'csv'}
            className="btn-secondary flex items-center gap-2 text-sm w-fit"
          >
            <FileDown className="w-4 h-4" />
            {loading === 'csv' ? 'Exporting...' : 'Export Transactions CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Passphrase Tab
function PassphraseTab({ addToast }: {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}): React.ReactElement {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (form.newPass !== form.confirm) {
      addToast('New passphrases do not match', 'error')
      return
    }
    if (form.newPass.length < 8) {
      addToast('New passphrase must be at least 8 characters', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await window.api.db.changePassphrase(form.current, form.newPass)
      if (res.success) {
        addToast('Passphrase changed successfully', 'success')
        setForm({ current: '', newPass: '', confirm: '' })
      } else {
        addToast(res.error || 'Failed to change passphrase', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <div>
        <label className="label">Current Passphrase</label>
        <div className="relative">
          <input
            className="input pr-10"
            type={showPass ? 'text' : 'password'}
            value={form.current}
            onChange={(e) => setForm((p) => ({ ...p, current: e.target.value }))}
            required
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="label">New Passphrase</label>
        <input
          className="input"
          type={showPass ? 'text' : 'password'}
          value={form.newPass}
          onChange={(e) => setForm((p) => ({ ...p, newPass: e.target.value }))}
          required
        />
      </div>
      <div>
        <label className="label">Confirm New Passphrase</label>
        <input
          className="input"
          type={showPass ? 'text' : 'password'}
          value={form.confirm}
          onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
          required
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 w-fit">
        <Key className="w-4 h-4" />
        {loading ? 'Changing...' : 'Change Passphrase'}
      </button>

      <p className="text-surface-600 text-xs">
        Your data will remain encrypted. The new passphrase will be required on next unlock.
      </p>
    </form>
  )
}
