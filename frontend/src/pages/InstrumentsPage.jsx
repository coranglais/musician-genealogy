import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listInstruments } from '../api'

export default function InstrumentsPage() {
  const [instruments, setInstruments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listInstruments()
      .then(setInstruments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-12 text-center text-stone-400">Loading...</div>
  }

  // Only show primary instruments (no parent_id), grouped by family
  const primaries = instruments.filter(i => !i.parent_id)
  const families = {}
  for (const inst of primaries) {
    const family = inst.family || 'Other'
    if (!families[family]) families[family] = []
    families[family].push(inst)
  }

  // Sort families in a sensible order
  const familyOrder = ['Woodwind', 'Brass', 'String', 'Keyboard', 'Percussion', 'Voice', 'Discipline']
  const sortedFamilies = Object.keys(families).sort((a, b) => {
    const ai = familyOrder.indexOf(a)
    const bi = familyOrder.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div>
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Browse by Instrument</h1>
      <p className="text-stone-500 mb-8">Select an instrument to see all musicians in our database.</p>

      <div className="space-y-8">
        {sortedFamilies.map(family => (
          <section key={family}>
            <h2 className="text-lg font-semibold text-stone-600 mb-3">{family}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {families[family].sort((a, b) => a.name.localeCompare(b.name)).map(inst => {
                const companions = inst.companions || []
                return (
                  <Link
                    key={inst.id}
                    to={`/instrument/${inst.id}`}
                    className="rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm
                      hover:border-amber-300 hover:shadow-md transition-all"
                  >
                    <h3 className="font-semibold text-stone-800">{inst.name}</h3>
                    {companions.length > 0 && (
                      <p className="mt-1 text-xs text-stone-400">
                        + {companions.map(c => c.name).join(', ')}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
