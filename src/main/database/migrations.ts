export interface Migration {
  version: number
  sql: string
}

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('checking','savings','credit_card','loan','student_loan','brokerage','retirement','hsa','real_estate','manual_asset','liability')),
        institution TEXT,
        currency TEXT NOT NULL DEFAULT 'USD',
        balance REAL NOT NULL DEFAULT 0,
        credit_limit REAL,
        interest_rate REAL,
        is_budget_account INTEGER NOT NULL DEFAULT 1,
        is_closed INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES categories(id),
        type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
        color TEXT,
        icon TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS category_rules (
        id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        category_id TEXT NOT NULL REFERENCES categories(id),
        field TEXT NOT NULL DEFAULT 'payee',
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        payee TEXT,
        memo TEXT,
        category_id TEXT REFERENCES categories(id),
        type TEXT NOT NULL CHECK(type IN ('expense','income','transfer','buy','sell','dividend','fee','interest','other')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','posted','reviewed')),
        external_id TEXT,
        transfer_id TEXT,
        is_split INTEGER NOT NULL DEFAULT 0,
        tags TEXT,
        notes TEXT,
        attachment_path TEXT,
        source_file TEXT,
        source_parser TEXT,
        import_session_id TEXT,
        security_symbol TEXT,
        quantity REAL,
        price REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

      CREATE TABLE IF NOT EXISTS splits (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        amount REAL NOT NULL,
        category_id TEXT REFERENCES categories(id),
        memo TEXT
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('emergency_fund','debt_paydown','sinking_fund','down_payment','retirement','savings')),
        target_amount REAL NOT NULL,
        current_amount REAL NOT NULL DEFAULT 0,
        target_date TEXT,
        monthly_contribution REAL,
        linked_account_ids TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','completed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goal_contributions (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id),
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS holdings (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        symbol TEXT,
        name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        cost_basis REAL,
        current_price REAL,
        current_value REAL,
        asset_class TEXT CHECK(asset_class IN ('us_equity','intl_equity','bonds','cash','real_estate','crypto','other')),
        tax_bucket TEXT CHECK(tax_bucket IN ('taxable','tax_deferred','tax_free')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS allocation_targets (
        id TEXT PRIMARY KEY,
        asset_class TEXT NOT NULL,
        target_pct REAL NOT NULL,
        tolerance_pct REAL NOT NULL DEFAULT 5,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recurring_items (
        id TEXT PRIMARY KEY,
        account_id TEXT REFERENCES accounts(id),
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income','expense')),
        frequency TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly','quarterly','annually')),
        next_date TEXT NOT NULL,
        category_id TEXT REFERENCES categories(id),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plan_notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT CHECK(category IN ('goal_change','allocation_change','debt_plan','projection','general')),
        effective_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_sessions (
        id TEXT PRIMARY KEY,
        account_id TEXT REFERENCES accounts(id),
        filename TEXT NOT NULL,
        parser TEXT NOT NULL,
        row_count INTEGER NOT NULL DEFAULT 0,
        imported_count INTEGER NOT NULL DEFAULT 0,
        duplicate_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS net_worth_snapshots (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        total_assets REAL NOT NULL,
        total_liabilities REAL NOT NULL,
        net_worth REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Seed default categories
      INSERT OR IGNORE INTO categories (id, name, parent_id, type, color, is_system, created_at) VALUES
        ('cat_income', 'Income', NULL, 'income', '#22c55e', 1, datetime('now')),
        ('cat_salary', 'Salary', 'cat_income', 'income', '#16a34a', 1, datetime('now')),
        ('cat_freelance', 'Freelance', 'cat_income', 'income', '#15803d', 1, datetime('now')),
        ('cat_investment_income', 'Investment Income', 'cat_income', 'income', '#166534', 1, datetime('now')),
        ('cat_rental_income', 'Rental Income', 'cat_income', 'income', '#14532d', 1, datetime('now')),
        ('cat_other_income', 'Other Income', 'cat_income', 'income', '#4ade80', 1, datetime('now')),
        ('cat_expense', 'Expense', NULL, 'expense', '#ef4444', 1, datetime('now')),
        ('cat_housing', 'Housing', 'cat_expense', 'expense', '#dc2626', 1, datetime('now')),
        ('cat_rent_mortgage', 'Rent/Mortgage', 'cat_housing', 'expense', '#b91c1c', 1, datetime('now')),
        ('cat_utilities', 'Utilities', 'cat_housing', 'expense', '#991b1b', 1, datetime('now')),
        ('cat_home_insurance', 'Insurance', 'cat_housing', 'expense', '#7f1d1d', 1, datetime('now')),
        ('cat_food', 'Food', 'cat_expense', 'expense', '#f97316', 1, datetime('now')),
        ('cat_groceries', 'Groceries', 'cat_food', 'expense', '#ea580c', 1, datetime('now')),
        ('cat_dining_out', 'Dining Out', 'cat_food', 'expense', '#c2410c', 1, datetime('now')),
        ('cat_transportation', 'Transportation', 'cat_expense', 'expense', '#eab308', 1, datetime('now')),
        ('cat_gas', 'Gas', 'cat_transportation', 'expense', '#ca8a04', 1, datetime('now')),
        ('cat_car_payment', 'Car Payment', 'cat_transportation', 'expense', '#a16207', 1, datetime('now')),
        ('cat_auto_insurance', 'Auto Insurance', 'cat_transportation', 'expense', '#854d0e', 1, datetime('now')),
        ('cat_parking', 'Parking', 'cat_transportation', 'expense', '#713f12', 1, datetime('now')),
        ('cat_healthcare', 'Healthcare', 'cat_expense', 'expense', '#ec4899', 1, datetime('now')),
        ('cat_medical', 'Medical', 'cat_healthcare', 'expense', '#db2777', 1, datetime('now')),
        ('cat_dental', 'Dental', 'cat_healthcare', 'expense', '#be185d', 1, datetime('now')),
        ('cat_pharmacy', 'Pharmacy', 'cat_healthcare', 'expense', '#9d174d', 1, datetime('now')),
        ('cat_personal', 'Personal', 'cat_expense', 'expense', '#a855f7', 1, datetime('now')),
        ('cat_clothing', 'Clothing', 'cat_personal', 'expense', '#9333ea', 1, datetime('now')),
        ('cat_personal_care', 'Personal Care', 'cat_personal', 'expense', '#7e22ce', 1, datetime('now')),
        ('cat_entertainment', 'Entertainment', 'cat_personal', 'expense', '#6b21a8', 1, datetime('now')),
        ('cat_subscriptions', 'Subscriptions', 'cat_personal', 'expense', '#581c87', 1, datetime('now')),
        ('cat_education', 'Education', 'cat_expense', 'expense', '#06b6d4', 1, datetime('now')),
        ('cat_tuition', 'Tuition', 'cat_education', 'expense', '#0891b2', 1, datetime('now')),
        ('cat_books', 'Books', 'cat_education', 'expense', '#0e7490', 1, datetime('now')),
        ('cat_financial', 'Financial', 'cat_expense', 'expense', '#64748b', 1, datetime('now')),
        ('cat_debt_payment', 'Debt Payment', 'cat_financial', 'expense', '#475569', 1, datetime('now')),
        ('cat_savings_transfer', 'Savings Transfer', 'cat_financial', 'expense', '#334155', 1, datetime('now')),
        ('cat_bank_fees', 'Bank Fees', 'cat_financial', 'expense', '#1e293b', 1, datetime('now')),
        ('cat_shopping', 'Shopping', 'cat_expense', 'expense', '#f43f5e', 1, datetime('now')),
        ('cat_travel', 'Travel', 'cat_expense', 'expense', '#10b981', 1, datetime('now')),
        ('cat_gifts', 'Gifts & Donations', 'cat_expense', 'expense', '#8b5cf6', 1, datetime('now')),
        ('cat_other_expense', 'Other', 'cat_expense', 'expense', '#6b7280', 1, datetime('now')),
        ('cat_transfer', 'Transfer', NULL, 'transfer', '#94a3b8', 1, datetime('now'));
    `
  }
]
