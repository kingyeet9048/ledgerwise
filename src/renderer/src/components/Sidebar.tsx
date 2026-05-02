import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Upload,
  Target,
  TrendingUp,
  BarChart3,
  BookOpen,
  Settings,
  Shield
} from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/accounts', label: 'Accounts', icon: Wallet },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { path: '/import', label: 'Import', icon: Upload },
  { path: '/goals', label: 'Goals', icon: Target },
  { path: '/investments', label: 'Investments', icon: TrendingUp },
  { path: '/projections', label: 'Projections', icon: BarChart3 },
  { path: '/plan-notes', label: 'Plan Notes', icon: BookOpen },
  { path: '/settings', label: 'Settings', icon: Settings }
]

export default function Sidebar(): React.ReactElement {
  return (
    <aside className="w-56 flex-shrink-0 bg-surface-900 border-r border-surface-800 flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-surface-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-surface-50 font-bold text-sm leading-tight">LedgerWise</div>
            <div className="text-surface-500 text-xs">Personal Finance</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'nav-link-active' : 'nav-link')}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-surface-800">
        <p className="text-surface-600 text-xs text-center">v0.1.0 • Local-first</p>
      </div>
    </aside>
  )
}
