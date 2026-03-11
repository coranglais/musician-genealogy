import { Link } from 'react-router-dom'

export default function MusicianCard({ musician, subtitle }) {
  const dates = formatDates(musician)

  return (
    <Link
      to={`/musician/${musician.id}`}
      className="block rounded-lg border border-stone-200 bg-white px-5 py-4 shadow-sm
        hover:border-amber-300 hover:shadow-md transition-all"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold text-stone-800">
          {musician.first_name} {musician.last_name}
        </h3>
        {dates && <span className="text-sm text-stone-400 whitespace-nowrap">{dates}</span>}
      </div>
      {musician.nationality && (
        <p className="mt-1 text-sm text-stone-500">{musician.nationality}</p>
      )}
      {subtitle && (
        <p className="mt-1 text-sm text-stone-400">{subtitle}</p>
      )}
    </Link>
  )
}

function formatDates(m) {
  if (!m.birth_date && !m.death_date) return null
  return `(${m.birth_date || '?'}–${m.death_date || ''})`
}
