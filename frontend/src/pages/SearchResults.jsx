import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchMusicians } from '../api'
import MusicianCard from '../components/MusicianCard'

export default function SearchResults() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!q) return
    setLoading(true)
    searchMusicians(q)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [q])

  const musicians = results.filter(r => r.result_type === 'musician')
  const institutions = results.filter(r => r.result_type === 'institution')

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-1">
        Search Results
      </h1>
      <p className="text-stone-500 mb-6">
        {loading ? 'Searching...' : `${results.length} results for "${q}"`}
      </p>

      {!loading && results.length === 0 && q && (
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
          <p className="text-stone-500">No results found for "{q}".</p>
          <p className="mt-2 text-sm text-stone-400">
            Try a different spelling or a partial name.
          </p>
        </div>
      )}

      {musicians.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-stone-700 mb-3">Musicians</h2>
          <div className="space-y-3">
            {musicians.map(r => (
              <MusicianCard
                key={r.id}
                musician={{
                  id: r.id,
                  first_name: r.display_name.split(' ').slice(0, -1).join(' '),
                  last_name: r.display_name.split(' ').slice(-1)[0],
                  birth_date: r.birth_date,
                  death_date: r.death_date,
                }}
                subtitle={r.matched_via !== 'canonical' ? `Matched via: ${r.matched_via}` : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {institutions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-stone-700 mb-3">Institutions</h2>
          <div className="space-y-3">
            {institutions.map(r => (
              <div
                key={r.id}
                className="rounded-lg border border-stone-200 bg-white px-5 py-4 shadow-sm"
              >
                <h3 className="font-semibold text-stone-800">{r.display_name}</h3>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
