import React from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function ToastContainer(): React.ReactElement {
  const { toasts, removeToast } = useAppStore()

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg pointer-events-auto max-w-sm transition-all
            ${toast.type === 'success' ? 'bg-green-900 border border-green-700 text-green-100' : ''}
            ${toast.type === 'error' ? 'bg-red-900 border border-red-700 text-red-100' : ''}
            ${toast.type === 'info' ? 'bg-surface-800 border border-surface-600 text-surface-100' : ''}
          `}
        >
          {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />}
          <span className="text-sm flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
