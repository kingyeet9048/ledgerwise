import { contextBridge, ipcRenderer } from 'electron'

// Expose IPC methods to renderer via contextBridge
const api = {
  // DB lifecycle
  db: {
    isSetup: () => ipcRenderer.invoke('db:is-setup'),
    setup: (passphrase: string) => ipcRenderer.invoke('db:setup', passphrase),
    unlock: (passphrase: string) => ipcRenderer.invoke('db:unlock', passphrase),
    changePassphrase: (oldPassphrase: string, newPassphrase: string) =>
      ipcRenderer.invoke('db:change-passphrase', oldPassphrase, newPassphrase)
  },

  // Accounts
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    create: (account: unknown) => ipcRenderer.invoke('accounts:create', account),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('accounts:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('accounts:delete', id)
  },

  // Transactions
  transactions: {
    list: (filter?: unknown) => ipcRenderer.invoke('transactions:list', filter),
    create: (tx: unknown) => ipcRenderer.invoke('transactions:create', tx),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('transactions:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('transactions:delete', id),
    bulkReview: (ids: string[]) => ipcRenderer.invoke('transactions:bulk-review', ids)
  },

  // Categories
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (cat: unknown) => ipcRenderer.invoke('categories:create', cat),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('categories:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('categories:delete', id)
  },

  // Category rules
  categoryRules: {
    list: () => ipcRenderer.invoke('category-rules:list'),
    create: (rule: unknown) => ipcRenderer.invoke('category-rules:create', rule),
    delete: (id: string) => ipcRenderer.invoke('category-rules:delete', id)
  },

  // Goals
  goals: {
    list: () => ipcRenderer.invoke('goals:list'),
    create: (goal: unknown) => ipcRenderer.invoke('goals:create', goal),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('goals:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('goals:delete', id),
    addContribution: (contribution: unknown) =>
      ipcRenderer.invoke('goals:add-contribution', contribution)
  },

  // Holdings
  holdings: {
    list: () => ipcRenderer.invoke('holdings:list'),
    create: (holding: unknown) => ipcRenderer.invoke('holdings:create', holding),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('holdings:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('holdings:delete', id)
  },

  // Allocation targets
  allocationTargets: {
    list: () => ipcRenderer.invoke('allocation-targets:list'),
    upsert: (target: unknown) => ipcRenderer.invoke('allocation-targets:upsert', target)
  },

  // Recurring items
  recurring: {
    list: () => ipcRenderer.invoke('recurring:list'),
    create: (item: unknown) => ipcRenderer.invoke('recurring:create', item),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('recurring:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('recurring:delete', id)
  },

  // Import
  import: {
    parse: (args: unknown) => ipcRenderer.invoke('import:parse', args),
    confirm: (args: unknown) => ipcRenderer.invoke('import:confirm', args)
  },

  // Projections
  projections: {
    run: (assumptions: unknown) => ipcRenderer.invoke('projections:run', assumptions)
  },

  // Backup
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import')
  },

  // CSV export
  exportCsv: () => ipcRenderer.invoke('export:csv'),

  // Dashboard
  dashboard: {
    summary: () => ipcRenderer.invoke('dashboard:summary')
  },

  // Plan notes
  planNotes: {
    list: () => ipcRenderer.invoke('plan-notes:list'),
    create: (note: unknown) => ipcRenderer.invoke('plan-notes:create', note),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('plan-notes:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('plan-notes:delete', id)
  },

  // Net worth history
  netWorth: {
    history: () => ipcRenderer.invoke('net-worth:history')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
