import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import SearchBar from './SearchBar'
import { SITE_NAME_SHORT, SITE_NAME } from '../constants'
import { logout } from '../api'

export default function Layout({ isAdmin, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  async function handleLogout() {
    try { await logout() } catch {}
    onLogout()
    setMenuOpen(false)
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  // Close menu on navigation
  const NavLink = ({ to, children, className = '' }) => (
    <Link to={to} onClick={closeMenu} className={className}>
      {children}
    </Link>
  )

  const isActive = (path) => location.pathname === path

  const linkClass = (path) =>
    `text-sm transition-colors ${
      isActive(path)
        ? 'text-amber-300'
        : 'text-stone-400 hover:text-amber-300'
    }`

  const mobileLinkClass = (path) =>
    `block px-4 py-2.5 text-sm transition-colors ${
      isActive(path)
        ? 'text-amber-300 bg-stone-700/50'
        : 'text-stone-300 hover:text-amber-300 hover:bg-stone-700/50'
    }`

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="bg-stone-800 text-stone-100 shadow-md relative z-40">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          {/* Logo + desktop nav */}
          <div className="flex items-baseline gap-4 min-w-0">
            <NavLink to="/" className="text-xl font-semibold tracking-tight hover:text-amber-300 transition-colors shrink-0">
              {SITE_NAME_SHORT}
            </NavLink>
            <nav className="hidden md:flex items-baseline gap-4">
              <NavLink to="/about" className={linkClass('/about')}>About</NavLink>
              <NavLink to="/instruments" className={linkClass('/instruments')}>Browse</NavLink>
              <NavLink to="/how-it-works" className={linkClass('/how-it-works')}>How It Works</NavLink>
              <NavLink to="/submit" className={linkClass('/submit')}>Contribute</NavLink>
              <NavLink to="/contact" className={linkClass('/contact')}>Contact</NavLink>
            </nav>
          </div>

          {/* Desktop right side */}
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="hidden md:flex items-center gap-2">
                <NavLink to="/admin" className="text-sm text-amber-300 hover:text-amber-200 transition-colors">
                  Review Queue
                </NavLink>
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

            {/* Hamburger button — visible below md */}
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="md:hidden p-1.5 rounded text-stone-400 hover:text-stone-200 hover:bg-stone-700 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <nav className="md:hidden border-t border-stone-700 bg-stone-800 pb-2">
            {/* Search on mobile */}
            <div className="sm:hidden px-4 py-3 border-b border-stone-700">
              <SearchBar compact onNavigate={closeMenu} />
            </div>
            <NavLink to="/about" className={mobileLinkClass('/about')}>About</NavLink>
            <NavLink to="/instruments" className={mobileLinkClass('/instruments')}>Browse by Instrument</NavLink>
            <NavLink to="/how-it-works" className={mobileLinkClass('/how-it-works')}>How It Works</NavLink>
            <NavLink to="/submit" className={mobileLinkClass('/submit')}>Contribute</NavLink>
            <NavLink to="/contact" className={mobileLinkClass('/contact')}>Contact</NavLink>
            {isAdmin && (
              <>
                <div className="border-t border-stone-700 mt-1 pt-1">
                  <NavLink to="/admin" className={mobileLinkClass('/admin')}>
                    Review Queue
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2.5 text-sm text-stone-400 hover:text-stone-200 hover:bg-stone-700/50 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-stone-200 py-6 text-center text-sm text-stone-400">
        <span>{SITE_NAME}</span>
        <span className="mx-2">&middot;</span>
        <Link to="/contact" className="hover:text-stone-600 transition-colors">
          Contact
        </Link>
        <span className="mx-2">&middot;</span>
        <Link to="/privacy" className="hover:text-stone-600 transition-colors">
          Privacy Policy
        </Link>
      </footer>
    </div>
  )
}
