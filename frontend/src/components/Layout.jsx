import { Link, Outlet } from 'react-router-dom'
import SearchBar from './SearchBar'
import { SITE_NAME_SHORT, SITE_NAME } from '../constants'
import { logout } from '../api'

export default function Layout({ isAdmin, onLogout }) {
  async function handleLogout() {
    try { await logout() } catch {}
    onLogout()
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="bg-stone-800 text-stone-100 shadow-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-2 sm:gap-4 min-w-0">
            <Link to="/" className="text-xl font-semibold tracking-tight hover:text-amber-300 transition-colors shrink-0">
              {SITE_NAME_SHORT}
            </Link>
            <Link to="/about" className="hidden sm:inline text-sm text-stone-400 hover:text-amber-300 transition-colors">
              About
            </Link>
            <Link to="/instruments" className="text-sm text-stone-400 hover:text-amber-300 transition-colors">
              Browse
            </Link>
            <Link to="/how-it-works" className="hidden md:inline text-sm text-stone-400 hover:text-amber-300 transition-colors">
              How It Works
            </Link>
            <Link to="/submit" className="text-sm text-stone-400 hover:text-amber-300 transition-colors">
              Contribute
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Link to="/admin" className="text-sm text-amber-300 hover:text-amber-200 transition-colors">
                  Review Queue
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-stone-400 hover:text-stone-200 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
            <div className="hidden sm:block w-72">
              <SearchBar compact />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-stone-200 py-6 text-center text-sm text-stone-400">
        <span>{SITE_NAME}</span>
        <span className="mx-2">·</span>
        <Link to="/contact" className="hover:text-stone-600 transition-colors">
          Contact
        </Link>
        <span className="mx-2">·</span>
        <Link to="/privacy" className="hover:text-stone-600 transition-colors">
          Privacy Policy
        </Link>
      </footer>
    </div>
  )
}
