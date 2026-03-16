import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listSubmissions } from '../api'

const STATUS_LABELS = {
  submitted: 'New',
  under_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_COLORS = {
  submitted: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function AdminReviewQueue() {
  const [submissions, setSubmissions] = useState([])
  const [statusFilter, setStatusFilter] = useState('submitted')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listSubmissions(statusFilter)
      .then(setSubmissions)
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false))
  }, [statusFilter])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Review Queue</h1>
        <div className="flex gap-2">
          {['submitted', 'under_review', 'approved', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-stone-400">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="text-stone-400">No submissions with this status.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => (
            <Link
              key={sub.id}
              to={`/admin/submissions/${sub.id}`}
              className="block rounded-lg border border-stone-200 bg-white p-4 shadow-sm
                hover:border-amber-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-medium text-stone-800">
                    #{sub.id} — {sub.submitter_name}
                  </span>
                  <span className="ml-2 text-sm text-stone-400">
                    {sub.submitter_email}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status]}`}>
                  {STATUS_LABELS[sub.status]}
                </span>
              </div>
              <div className="mt-2 text-sm text-stone-500">
                <span>{sub.submission_type}</span>
                <span className="mx-2">·</span>
                <span>{sub.records.length} record{sub.records.length !== 1 ? 's' : ''}</span>
                <span className="mx-2">·</span>
                <span>{new Date(sub.created_at).toLocaleDateString()}</span>
              </div>
              {sub.notes && (
                <p className="mt-2 text-sm text-stone-500 truncate">{sub.notes}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
