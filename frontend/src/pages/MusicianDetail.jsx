import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getMusician, getMusicianTeachers, getMusicianStudents } from '../api'

function formatDates(m) {
  if (!m.birth_date && !m.death_date) return null
  return `${m.birth_date || '?'}–${m.death_date || ''}`
}

function RelationshipBadge({ type }) {
  const styles = {
    formal_study: 'bg-amber-100 text-amber-800',
    private_study: 'bg-amber-100 text-amber-800',
    apprenticeship: 'bg-amber-100 text-amber-800',
    festival: 'bg-sky-100 text-sky-800',
    masterclass: 'bg-violet-100 text-violet-800',
    workshop: 'bg-violet-100 text-violet-800',
    informal: 'bg-sky-100 text-sky-800',
  }
  const labels = {
    formal_study: 'Formal Study',
    private_study: 'Private Study',
    apprenticeship: 'Apprenticeship',
    festival: 'Festival',
    masterclass: 'Masterclass',
    workshop: 'Workshop',
    informal: 'Informal',
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[type] || 'bg-stone-100 text-stone-600'}`}>
      {labels[type] || type}
    </span>
  )
}

function LineageItem({ lineage, role }) {
  const person = role === 'teacher' ? lineage.teacher : lineage.student

  return (
    <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white px-5 py-4 shadow-sm
      hover:border-amber-300 hover:shadow-md transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/musician/${person.id}`}
            className="font-semibold text-stone-800 hover:text-amber-700 transition-colors"
          >
            {person.first_name} {person.last_name}
          </Link>
          <RelationshipBadge type={lineage.relationship_type} />
        </div>
        <div className="mt-1 flex items-center gap-3 text-sm text-stone-500">
          {formatDates(person) && <span>{formatDates(person)}</span>}
          {lineage.institution && <span>{lineage.institution.name}</span>}
          {lineage.start_year && (
            <span>
              {lineage.start_year}{lineage.end_year ? `–${lineage.end_year}` : ''}
            </span>
          )}
        </div>
        {lineage.notes && (
          <p className="mt-1 text-sm text-stone-400 italic">{lineage.notes}</p>
        )}
      </div>
    </div>
  )
}

export default function MusicianDetail() {
  const { id } = useParams()
  const [musician, setMusician] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getMusician(id),
      getMusicianTeachers(id),
      getMusicianStudents(id),
    ])
      .then(([m, t, s]) => {
        setMusician(m)
        setTeachers(t)
        setStudents(s)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="py-12 text-center text-stone-400">Loading...</div>
  }

  if (!musician) {
    return <div className="py-12 text-center text-stone-500">Musician not found.</div>
  }

  const dates = formatDates(musician)
  const instruments = musician.musician_instruments?.map(mi => mi.instrument.name) || []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-800">
          {musician.first_name} {musician.last_name}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-stone-500">
          {dates && <span className="text-lg">{dates}</span>}
          {musician.nationality && <span>{musician.nationality}</span>}
          {instruments.length > 0 && (
            <span className="rounded-full bg-stone-100 px-3 py-0.5 text-sm font-medium text-stone-600">
              {instruments.join(', ')}
            </span>
          )}
        </div>
      </div>

      {musician.bio_notes && (
        <section className="mb-8">
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-stone-700 leading-relaxed">{musician.bio_notes}</p>
          </div>
        </section>
      )}

      {musician.alternate_names?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-stone-700 mb-3">Also Known As</h2>
          <div className="flex flex-wrap gap-2">
            {musician.alternate_names.map(an => (
              <span key={an.id} className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                {an.name}
                <span className="ml-1 text-stone-400">({an.name_type})</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {teachers.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-stone-700 mb-3">
            Teachers
            <span className="ml-2 text-sm font-normal text-stone-400">({teachers.length})</span>
          </h2>
          <div className="space-y-2">
            {teachers.map(t => (
              <LineageItem key={t.id} lineage={t} role="teacher" />
            ))}
          </div>
        </section>
      )}

      {students.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-stone-700 mb-3">
            Students
            <span className="ml-2 text-sm font-normal text-stone-400">({students.length})</span>
          </h2>
          <div className="space-y-2">
            {students.map(s => (
              <LineageItem key={s.id} lineage={s} role="student" />
            ))}
          </div>
        </section>
      )}

      {teachers.length === 0 && students.length === 0 && (
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
          <p className="text-stone-500">No lineage records yet for this musician.</p>
        </div>
      )}
    </div>
  )
}
