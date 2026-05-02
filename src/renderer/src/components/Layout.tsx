import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout(): React.ReactElement {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
