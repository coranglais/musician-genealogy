import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { listInstruments, getMusiciansForInstrument } from '../api'
import MusicianCard from '../components/MusicianCard'

const PER_PAGE = 50

export default function InstrumentDetail() {
  const { id } = useParams()
  const instrumentId = parseInt(id)
  const [instrument, setInstrument] = useState(null)
  const [musicians, setMusicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [includeCompanions, setIncludeCompanions] = useState(true)

  // Load instrument info
  useEffect(() => {
    listInstruments().then(instruments => {
      const found = instruments.find(i => i.id === instrumentId)
      setInstrument(found || null)
    }).catch(() => {})
  }, [instrumentId])

  // Load musicians when instrument, page, or companions toggle changes
  const loadMusicians = useCallback(() => {
    setLoading(true)
    getMusiciansForInstrument(instrumentId, includeCompanions, page, PER_PAGE)
      .then(data => {
        setMusicians(data)
        setHasMore(data.length === PER_PAGE)
      })
      .catch(() => setMusicians([]))
      .finally(() => setLoading(false))
  }, [instrumentId, includeCompanions, page])

  useEffect(() => {
    loadMusicians()
  }, [loadMusicians])

  // Reset page when toggling companions or changing instrument
  useEffect(() => {
    setPage(1)
  }, [instrumentId, includeCompanions])

  if (!instrument && !loading) {
    return <div className="py-12 text-center text-stone-500">Instrument not found.</div>
  }

  const companions = instrument?.companions || []
  const hasCompanions = companions.length > 0

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-stone-400">
        <Link to="/instruments" className="hover:text-amber-700 transition-colors">Instruments</Link>
        <span className="mx-2">/</span>
        <span className="text-stone-600">{instrument?.name || '...'}</span>
      </div>

      {/* Header */}
      {instrument && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-stone-800">{instrument.name}</h1>
          <div className="mt-2 flex items-center gap-3 text-stone-500">
            <span className="rounded-full bg-stone-100 px-3 py-0.5 text-sm font-medium text-stone-600">
              {instrument.family}
            </span>
            {hasCompanions && (
              <span className="text-sm">
                Related: {companions.map(c => c.name).join(', ')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <p className="text-sm text-stone-500">
          {loading ? 'Loading...' : `${musicians.length}${hasMore ? '+' : ''} musicians`}
        </p>
        {hasCompanions && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm text-stone-500 truncate max-w-48 sm:max-w-none">
              Include {companions.map(c => c.name).join(', ')}
            </span>
            <button
              role="switch"
              aria-checked={includeCompanions}
              onClick={() => setIncludeCompanions(prev => !prev)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                includeCompanions ? 'bg-amber-600' : 'bg-stone-300'
              }`}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                style={{ transform: includeCompanions ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </button>
          </label>
        )}
      </div>

      {/* Musicians grid */}
      {!loading && musicians.length === 0 && (
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
          <p className="text-stone-500">No musicians found for this instrument.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {musicians.map(m => (
          <MusicianCard key={m.id} musician={m} />
        ))}
      </div>

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="rounded px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200
              hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-stone-400">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
            className="rounded px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200
              hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
