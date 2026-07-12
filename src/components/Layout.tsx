import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthProvider'
import { useNotificationActions } from '../hooks/useNotificationActions'
import { useTheme } from '../lib/theme'
import ChatWidget from './ChatWidget'
import InstallPrompt from './InstallPrompt'
import { Button } from './ui'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/applications', label: 'Applications', icon: '📋' },
  { to: '/board', label: 'Board', icon: '🗂️' },
  { to: '/reminders', label: 'Reminders', icon: '⏰' },
  { to: '/directory', label: 'Directory', icon: '🏢' },
  { to: '/profile', label: 'Profile', icon: '👤' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Handle snooze actions forwarded by the service worker's notifications.
  useNotificationActions()

  async function handleSignOut() {
    setDrawerOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  const drawerLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300'
        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
    }`

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {/* Hamburger — same on every device */}
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-lg">
              🎯
            </span>
            <span>PlaceMate</span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
              className="rounded-lg p-2 text-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <InstallPrompt />

      {/* Slide-over drawer — same on every device */}
      <div
        className={`fixed inset-0 z-40 ${drawerOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!drawerOpen}
      >
        <div
          className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-lg">
                🎯
              </span>
              PlaceMate
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={drawerLink}
                onClick={() => setDrawerOpen(false)}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            {user?.email && (
              <p className="mb-2 truncate px-1 text-xs text-slate-500">{user.email}</p>
            )}
            <Button variant="secondary" className="w-full" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </aside>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      {/* Floating prep assistant, available on every authenticated screen. */}
      <ChatWidget />
    </div>
  )
}
