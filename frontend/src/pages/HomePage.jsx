import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import InstrumentFilter from '../components/InstrumentFilter'
import { listMusicians } from '../api'
import { SITE_NAME_SHORT } from '../constants'

const FEATURED = [
  { id: 1, name: 'Georges Gillet', desc: 'Father of the French oboe school' },
  { id: 4, name: 'Marcel Tabuteau', desc: 'Founder of the American school of oboe' },
  { id: 12, name: 'Laila Storch', desc: 'Performer, historian, author of Marcel Tabuteau' },
  { id: 7, name: 'John Mack', desc: 'Cleveland Orchestra, legendary pedagogue' },
  { id: 18, name: 'Elaine Douvas', desc: 'Met Opera principal, Juilliard faculty' },
  { id: 28, name: 'Nancy Ambrose King', desc: 'University of Michigan, orchestral soloist' },
]

export default function HomePage() {
  const [recentMusicians, setRecentMusicians] = useState([])
  const [instrument, setInstrument] = useState(null)

  useEffect(() => {
    const params = { per_page: 12 }
    if (instrument) params.instrument = instrument
    listMusicians(params).then(setRecentMusicians).catch(() => {})
  }, [instrument])

  return (
    <div>
      <section className="py-12 text-center">
        <h1 className="text-4xl font-bold text-stone-800 mb-3">
          {SITE_NAME_SHORT}
        </h1>
        <p className="text-lg text-stone-500 italic mb-8 max-w-xl mx-auto">
          Every teacher matters. Every lineage counts.
        </p>
        <div className="mx-auto max-w-lg">
          <SearchBar autoFocus />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-stone-700 mb-4">Featured Lineages</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURED.map(f => (
            <Link
              key={f.id}
              to={`/musician/${f.id}`}
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm
                hover:border-amber-300 hover:shadow-md transition-all"
            >
              <h3 className="font-semibold text-stone-800">{f.name}</h3>
              <p className="mt-1 text-sm text-stone-500">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold text-stone-700">Browse Musicians</h2>
          <InstrumentFilter value={instrument} onChange={setInstrument} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentMusicians.map(m => (
            <Link
              key={m.id}
              to={`/musician/${m.id}`}
              className="rounded-md border border-stone-200 bg-white px-4 py-3
                hover:border-amber-300 hover:bg-amber-50/30 transition-all text-sm"
            >
              <span className="font-medium text-stone-800">
                {m.first_name} {m.last_name}
              </span>
              {m.birth_date && (
                <span className="ml-2 text-stone-400">
                  ({m.birth_date}{m.death_date ? `–${m.death_date}` : ''})
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
