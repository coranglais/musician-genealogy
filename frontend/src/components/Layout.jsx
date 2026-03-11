import { Link, Outlet } from 'react-router-dom'
import SearchBar from './SearchBar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="bg-stone-800 text-stone-100 shadow-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          <Link to="/" className="text-xl font-semibold tracking-tight hover:text-amber-300 transition-colors">
            Musician Genealogy
          </Link>
          <div className="hidden sm:block w-72">
            <SearchBar compact />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-stone-200 py-6 text-center text-sm text-stone-400">
        Musician Genealogy Project
      </footer>
    </div>
  )
}
