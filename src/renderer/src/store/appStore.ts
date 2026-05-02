import { create } from 'zustand'
import { Account, Category, DashboardSummary } from '../../../shared/types'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppState {
  isAuthenticated: boolean
  accounts: Account[]
  categories: Category[]
  toasts: Toast[]
  dashboardSummary: DashboardSummary | null
  isLoading: boolean

  setAuthenticated: (value: boolean) => void
  setAccounts: (accounts: Account[]) => void
  setCategories: (categories: Category[]) => void
  setDashboardSummary: (summary: DashboardSummary) => void
  setLoading: (value: boolean) => void
  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  accounts: [],
  categories: [],
  toasts: [],
  dashboardSummary: null,
  isLoading: false,

  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setAccounts: (accounts) => set({ accounts }),
  setCategories: (categories) => set({ categories }),
  setDashboardSummary: (summary) => set({ dashboardSummary: summary }),
  setLoading: (value) => set({ isLoading: value }),

  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(7)
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }))
    // Auto-remove after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }))
    }, 4000)
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
}))
