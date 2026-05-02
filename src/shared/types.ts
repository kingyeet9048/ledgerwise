// Shared TypeScript interfaces and enums between main and renderer

export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'loan'
  | 'student_loan'
  | 'brokerage'
  | 'retirement'
  | 'hsa'
  | 'real_estate'
  | 'manual_asset'
  | 'liability'

export interface Account {
  id: string
  name: string
  type: AccountType
  institution?: string
  currency: string
  balance: number
  credit_limit?: number
  interest_rate?: number
  is_budget_account: number
  is_closed: number
  notes?: string
  created_at: string
  updated_at: string
}

export type CategoryType = 'income' | 'expense' | 'transfer'

export interface Category {
  id: string
  name: string
  parent_id?: string
  type: CategoryType
  color?: string
  icon?: string
  is_system: number
  created_at: string
}

export interface CategoryRule {
  id: string
  pattern: string
  category_id: string
  field: string
  priority: number
  created_at: string
}

export type TransactionType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'fee'
  | 'interest'
  | 'other'

export type TransactionStatus = 'pending' | 'posted' | 'reviewed'

export interface Transaction {
  id: string
  account_id: string
  date: string
  amount: number
  currency: string
  payee?: string
  memo?: string
  category_id?: string
  type: TransactionType
  status: TransactionStatus
  external_id?: string
  transfer_id?: string
  is_split: number
  tags?: string
  notes?: string
  attachment_path?: string
  source_file?: string
  source_parser?: string
  import_session_id?: string
  security_symbol?: string
  quantity?: number
  price?: number
  created_at: string
  updated_at: string
  // joined fields
  category_name?: string
  account_name?: string
}

export interface Split {
  id: string
  transaction_id: string
  amount: number
  category_id?: string
  memo?: string
}

export type GoalType =
  | 'emergency_fund'
  | 'debt_paydown'
  | 'sinking_fund'
  | 'down_payment'
  | 'retirement'
  | 'savings'

export type GoalStatus = 'active' | 'paused' | 'completed'

export interface Goal {
  id: string
  name: string
  type: GoalType
  target_amount: number
  current_amount: number
  target_date?: string
  monthly_contribution?: number
  linked_account_ids?: string
  notes?: string
  status: GoalStatus
  created_at: string
  updated_at: string
}

export interface GoalContribution {
  id: string
  goal_id: string
  amount: number
  date: string
  notes?: string
}

export type AssetClass =
  | 'us_equity'
  | 'intl_equity'
  | 'bonds'
  | 'cash'
  | 'real_estate'
  | 'crypto'
  | 'other'

export type TaxBucket = 'taxable' | 'tax_deferred' | 'tax_free'

export interface Holding {
  id: string
  account_id: string
  symbol?: string
  name: string
  quantity: number
  cost_basis?: number
  current_price?: number
  current_value?: number
  asset_class?: AssetClass
  tax_bucket?: TaxBucket
  created_at: string
  updated_at: string
  // joined
  account_name?: string
}

export interface AllocationTarget {
  id: string
  asset_class: string
  target_pct: number
  tolerance_pct: number
  created_at: string
  updated_at: string
}

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'

export interface RecurringItem {
  id: string
  account_id?: string
  name: string
  amount: number
  type: 'income' | 'expense'
  frequency: RecurringFrequency
  next_date: string
  category_id?: string
  is_active: number
  created_at: string
  updated_at: string
}

export type PlanNoteCategory =
  | 'goal_change'
  | 'allocation_change'
  | 'debt_plan'
  | 'projection'
  | 'general'

export interface PlanNote {
  id: string
  title: string
  body: string
  category?: PlanNoteCategory
  effective_date: string
  created_at: string
  updated_at: string
}

export interface ImportSession {
  id: string
  account_id?: string
  filename: string
  parser: string
  row_count: number
  imported_count: number
  duplicate_count: number
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
}

export interface NetWorthSnapshot {
  id: string
  date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
  created_at: string
}

// Projection types
export interface ProjectionAssumptions {
  investmentReturnRate: number
  inflationRate: number
  incomeGrowthRate: number
  monthsToProject: number
  additionalMonthlyContribution?: number
}

export interface ProjectionMonth {
  month: string
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  accountBalances: Record<string, number>
  goalProgress: Record<string, number>
}

export interface ProjectionResult {
  months: ProjectionMonth[]
  debtPayoffDates: Record<string, string>
  assumptions: ProjectionAssumptions
}

// Dashboard summary
export interface DashboardSummary {
  netWorth: number
  monthlyIncome: number
  monthlySpending: number
  savingsRate: number
  accounts: Account[]
  recentTransactions: Transaction[]
  upcomingBills: RecurringItem[]
  netWorthHistory: NetWorthSnapshot[]
  spendingByCategory: { category: string; amount: number; color?: string }[]
}

// Import types
export interface ParsedTransaction {
  date: string
  amount: number
  payee?: string
  memo?: string
  type: TransactionType
  external_id?: string
  security_symbol?: string
  quantity?: number
  price?: number
  isDuplicate?: boolean
}

export interface ImportPreview {
  session_id: string
  filename: string
  parser: string
  transactions: ParsedTransaction[]
  duplicateCount: number
  totalCount: number
}

// IPC response wrapper
export interface IpcResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Filter types for transactions
export interface TransactionFilter {
  accountId?: string
  categoryId?: string
  startDate?: string
  endDate?: string
  status?: TransactionStatus
  search?: string
  type?: TransactionType
  limit?: number
  offset?: number
}
