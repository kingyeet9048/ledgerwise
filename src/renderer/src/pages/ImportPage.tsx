import React, { useState, useRef } from 'react'
import { Account, ImportPreview, ParsedTransaction } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import { Upload, FileText, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'

type ImportStep = 'select' | 'preview' | 'confirm'

const INSTITUTIONS = [
  { value: '', label: 'Auto-detect' },
  { value: 'chase', label: 'Chase Checking/Savings (CSV)' },
  { value: 'chase_credit', label: 'Chase Credit Card (CSV/QFX)' },
  { value: 'chase_pdf', label: 'Chase Statement (PDF)' },
  { value: 'wells_fargo', label: 'Wells Fargo (CSV/QFX)' },
  { value: 'robinhood', label: 'Robinhood (CSV)' },
  { value: 'vanguard', label: 'Vanguard (CSV)' }
]

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(Math.abs(amount))
}

export default function ImportPage(): React.ReactElement {
  const [step, setStep] = useState<ImportStep>('select')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [institution, setInstitution] = useState<string>('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useAppStore()

  React.useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts(): Promise<void> {
    const res = await window.api.accounts.list()
    if (res.success && res.data) setAccounts(res.data)
  }

  function handleDrop(e: React.DragEvent): void {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  function handleFileSelect(file: File): void {
    // In Electron, we need the full path. With input[type=file], path is available via webkitRelativePath
    // We'll use the file object's path property (Electron exposes this)
    const path = (file as File & { path?: string }).path || ''
    setSelectedFile(path)
    setSelectedFileName(file.name)
  }

  async function handleParse(): Promise<void> {
    if (!selectedFile || !selectedAccount) {
      addToast('Please select a file and account', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await window.api.import.parse({
        filePath: selectedFile,
        accountId: selectedAccount,
        institution: institution || undefined
      })

      if (res.success && res.data) {
        setPreview(res.data)
        setExcludedIds(new Set())
        setStep('preview')
      } else {
        addToast(res.error || 'Failed to parse file', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!preview) return
    setLoading(true)
    try {
      const transactions = preview.transactions
        .map((tx, idx) => ({ ...tx, isDuplicate: tx.isDuplicate || excludedIds.has(idx) }))

      const res = await window.api.import.confirm({
        sessionId: preview.session_id,
        accountId: selectedAccount,
        transactions
      })

      if (res.success && res.data) {
        setImportResult(res.data)
        setStep('confirm')
        addToast(`Imported ${res.data.imported} transactions`, 'success')
      } else {
        addToast(res.error || 'Import failed', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  function resetImport(): void {
    setStep('select')
    setPreview(null)
    setImportResult(null)
    setSelectedFile('')
    setSelectedFileName('')
    setExcludedIds(new Set())
  }

  function toggleExclude(idx: number): void {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const includedCount = preview
    ? preview.transactions.filter((t, i) => !t.isDuplicate && !excludedIds.has(i)).length
    : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h1 className="page-title">Import Transactions</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['select', 'preview', 'confirm'] as ImportStep[]).map((s, idx) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
              step === s
                ? 'bg-primary-900 text-primary-300 border border-primary-800'
                : idx < ['select', 'preview', 'confirm'].indexOf(step)
                ? 'text-green-400'
                : 'text-surface-500'
            }`}>
              {idx < ['select', 'preview', 'confirm'].indexOf(step) ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs">
                  {idx + 1}
                </span>
              )}
              {s === 'select' ? 'Select File' : s === 'preview' ? 'Preview' : 'Confirm'}
            </div>
            {idx < 2 && <ArrowRight className="w-4 h-4 text-surface-600" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Select file */}
      {step === 'select' && (
        <div className="card flex flex-col gap-5">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              isDragOver
                ? 'border-primary-500 bg-primary-950/30'
                : 'border-surface-600 hover:border-surface-500'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-10 h-10 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-200 font-medium mb-1">Drag & drop your file here</p>
            <p className="text-surface-500 text-sm mb-4">Supports CSV, OFX, QFX, QIF, PDF (Chase statements)</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-sm"
            >
              Browse files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.ofx,.qfx,.qif,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
            />
            {selectedFileName && (
              <div className="mt-4 flex items-center justify-center gap-2 text-green-400">
                <FileText className="w-4 h-4" />
                <span className="text-sm">{selectedFileName}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Import to Account *</label>
              <select
                className="input"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Institution Template</label>
              <select
                className="input"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              >
                {INSTITUTIONS.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleParse}
              disabled={!selectedFile || !selectedAccount || loading}
              className="btn-primary"
            >
              {loading ? 'Parsing...' : 'Parse File'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && preview && (
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-surface-100 font-semibold">{preview.filename}</h2>
                <p className="text-surface-500 text-sm">
                  {preview.totalCount} transactions found •{' '}
                  {preview.duplicateCount > 0 && (
                    <span className="text-yellow-400">{preview.duplicateCount} duplicates detected • </span>
                  )}
                  <span className="text-green-400">{includedCount} will be imported</span>
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('select')} className="btn-secondary">
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={includedCount === 0 || loading}
                  className="btn-primary"
                >
                  {loading ? 'Importing...' : `Import ${includedCount} Transactions`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Include</th>
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Payee</th>
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Memo</th>
                    <th className="text-right py-2 px-3 text-surface-500 text-xs font-medium">Amount</th>
                    <th className="text-left py-2 px-3 text-surface-500 text-xs font-medium">Type</th>
                    <th className="text-center py-2 px-3 text-surface-500 text-xs font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.transactions.map((tx, idx) => {
                    const isExcluded = excludedIds.has(idx) || tx.isDuplicate
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-surface-700/50 ${
                          isExcluded ? 'opacity-40' : 'hover:bg-surface-800/30'
                        }`}
                      >
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => {
                              if (!tx.isDuplicate) toggleExclude(idx)
                            }}
                            disabled={tx.isDuplicate}
                            className="rounded border-surface-600 bg-surface-800 text-primary-600"
                          />
                        </td>
                        <td className="py-2 px-3 text-surface-400">{tx.date}</td>
                        <td className="py-2 px-3 text-surface-200 max-w-xs truncate">{tx.payee || '—'}</td>
                        <td className="py-2 px-3 text-surface-500 max-w-xs truncate">{tx.memo || '—'}</td>
                        <td className={`py-2 px-3 text-right font-medium ${
                          ['income', 'dividend'].includes(tx.type) ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {['income', 'dividend'].includes(tx.type) ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-2 px-3 text-surface-400 capitalize">{tx.type}</td>
                        <td className="py-2 px-3 text-center">
                          {tx.isDuplicate ? (
                            <span className="badge bg-yellow-900/40 text-yellow-400 border border-yellow-800">
                              Duplicate
                            </span>
                          ) : (
                            <span className="badge bg-green-900/40 text-green-400 border border-green-800">
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && importResult && (
        <div className="card flex flex-col items-center gap-5 py-10">
          <div className="w-16 h-16 bg-green-900/40 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <h2 className="text-surface-50 font-bold text-xl mb-2">Import Complete!</h2>
            <p className="text-surface-400">
              Successfully imported{' '}
              <span className="text-green-400 font-semibold">{importResult.imported}</span> transactions
              {importResult.skipped > 0 && (
                <>, skipped{' '}
                  <span className="text-yellow-400 font-semibold">{importResult.skipped}</span> duplicates
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={resetImport} className="btn-secondary">
              Import Another File
            </button>
            <a href="#/transactions" className="btn-primary">
              View Transactions
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
