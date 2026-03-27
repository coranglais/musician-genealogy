import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getSubmission,
  approveSubmission,
  rejectSubmission,
  listPendingMusicians,
  listPendingLineage,
  editPendingMusician,
} from '../api'
import AutocompleteInput from '../components/AutocompleteInput'
import { searchNationalities } from '../utils/nationalities'

export default function AdminSubmissionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [submission, setSubmission] = useState(null)
  const [pendingMusicians, setPendingMusicians] = useState([])
  const [pendingLineage, setPendingLineage] = useState([])
  const [rejectNotes, setRejectNotes] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      getSubmission(id),
      listPendingMusicians(),
      listPendingLineage(),
    ])
      .then(([sub, musicians, lineage]) => {
        setSubmission(sub)
        setPendingMusicians(musicians)
        setPendingLineage(lineage)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  async function handleApprove() {
    setActionLoading(true)
    try {
      const updated = await approveSubmission(id)
      setSubmission(updated)
    } catch (err) {
      alert('Approval failed: ' + err.message)
    }
    setActionLoading(false)
  }

  async function handleReject() {
    setActionLoading(true)
    try {
      const updated = await rejectSubmission(id, rejectNotes)
      setSubmission(updated)
      setShowRejectForm(false)
    } catch (err) {
      alert('Rejection failed: ' + err.message)
    }
    setActionLoading(false)
  }

  if (loading) return <p className="text-stone-400">Loading...</p>
  if (!submission) return <p className="text-stone-500">Submission not found.</p>

  const linkedRecordIds = new Set(submission.records.map(r => r.record_id))
  const linkedMusicians = pendingMusicians.filter(m => linkedRecordIds.has(m.id))
  const linkedLineage = pendingLineage.filter(l => linkedRecordIds.has(l.id))
  const canAct = submission.status === 'submitted' || submission.status === 'under_review'

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate('/admin')}
        className="text-sm text-stone-400 hover:text-stone-600 mb-4 inline-block"
      >
        &larr; Back to queue
      </button>

      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-bold text-stone-800">
            Submission #{submission.id}
          </h1>
          <StatusBadge status={submission.status} />
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-stone-400">Submitter</dt>
            <dd className="text-stone-800">{submission.submitter_name}</dd>
          </div>
          <div>
            <dt className="text-stone-400">Email</dt>
            <dd className="text-stone-800">{submission.submitter_email}</dd>
          </div>
          <div>
            <dt className="text-stone-400">Submitted</dt>
            <dd className="text-stone-800">
              {new Date(submission.created_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-stone-400">Type</dt>
            <dd className="text-stone-800">{submission.submission_type}</dd>
          </div>
        </dl>

        {submission.notes && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-stone-400 mb-1">Notes</h3>
            <p className="text-sm text-stone-700 bg-stone-50 rounded-md p-3">
              {submission.notes}
            </p>
          </div>
        )}

        {submission.verification_info && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-stone-400 mb-1">Verification</h3>
            <p className="text-sm text-stone-700 bg-stone-50 rounded-md p-3">
              {submission.verification_info}
            </p>
          </div>
        )}

        {submission.original_text && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-stone-400 mb-1">Original Text</h3>
            <p className="text-sm text-stone-700 bg-stone-50 rounded-md p-3 italic">
              {submission.original_text}
            </p>
          </div>
        )}

        {submission.parse_feedback && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-stone-400 mb-1">Parser Feedback</h3>
            <p className="text-sm text-stone-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              {submission.parse_feedback}
            </p>
          </div>
        )}

        {submission.editor_notes && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-stone-400 mb-1">Editor Notes</h3>
            <p className="text-sm text-stone-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              {submission.editor_notes}
            </p>
          </div>
        )}

        {submission.reviewed_at && (
          <p className="mt-4 text-xs text-stone-400">
            Reviewed: {new Date(submission.reviewed_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Linked pending records */}
      <h2 className="text-lg font-semibold text-stone-800 mb-3">
        Linked Records ({submission.records.length})
      </h2>

      {linkedMusicians.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-stone-500 mb-2">Pending Musicians</h3>
          <div className="space-y-2">
            {linkedMusicians.map(m => (
              <PendingMusicianCard key={m.id} musician={m} onUpdate={(id, data) => {
                editPendingMusician(id, data).then(updated => {
                  setPendingMusicians(prev => prev.map(pm => pm.id === id ? { ...pm, ...updated } : pm))
                }).catch(() => {})
              }} />
            ))}
          </div>
        </div>
      )}

      {linkedLineage.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-stone-500 mb-2">Pending Lineage</h3>
          <div className="space-y-2">
            {linkedLineage.map(lin => (
              <div
                key={lin.id}
                className="rounded-md border border-stone-200 bg-white p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-stone-800">
                    {lin.teacher.first_name} {lin.teacher.last_name}
                  </span>
                  {lin.teacher.status === 'pending' && (
                    <span className="text-xs bg-amber-100 text-amber-700 rounded px-1">pending</span>
                  )}
                  <span className="text-stone-400">&rarr;</span>
                  <span className="font-medium text-stone-800">
                    {lin.student.first_name} {lin.student.last_name}
                  </span>
                  {lin.student.status === 'pending' && (
                    <span className="text-xs bg-amber-100 text-amber-700 rounded px-1">pending</span>
                  )}
                </div>
                <div className="mt-1 text-stone-500">
                  <span>{lin.relationship_type.replace('_', ' ')}</span>
                  {lin.institution && (
                    <span className="ml-2">at {lin.institution.name}</span>
                  )}
                  {lin.start_year && (
                    <span className="ml-2">
                      ({lin.start_year}{lin.end_year ? `–${lin.end_year}` : ''})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Also show records that aren't pending (already active musicians referenced) */}
      {submission.records.filter(r => !linkedRecordIds.has(r.record_id) || (
        r.record_type === 'musician' && !linkedMusicians.some(m => m.id === r.record_id) &&
        r.record_type === 'lineage' && !linkedLineage.some(l => l.id === r.record_id)
      )).length > 0 && null}

      {/* Action buttons */}
      {canAct && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Approve All'}
          </button>

          {showRejectForm ? (
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="Reason for rejection..."
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm
                  focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                autoFocus
              />
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white
                  hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => setShowRejectForm(false)}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-600
                  hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowRejectForm(true)}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600
                hover:bg-red-50 transition-colors"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PendingMusicianCard({ musician: m, onUpdate }) {
  const [nationality, setNationality] = useState(m.nationality || '')

  function handleSelect(item) {
    setNationality(item.name)
    onUpdate(m.id, { nationality: item.name })
  }

  function handleBlur() {
    if (nationality !== (m.nationality || '')) {
      onUpdate(m.id, { nationality: nationality || null })
    }
  }

  return (
    <div className="rounded-md border border-stone-200 bg-white p-3 text-sm">
      <div className="flex items-baseline gap-2">
        <span className="font-medium text-stone-800">
          {m.first_name} {m.last_name}
        </span>
        {m.birth_date && (
          <span className="text-stone-400">
            ({m.birth_date}{m.death_date ? `–${m.death_date}` : ''})
          </span>
        )}
      </div>
      <div className="mt-2 max-w-xs">
        <AutocompleteInput
          label="Nationality"
          value={nationality}
          onChange={setNationality}
          onSearch={searchNationalities}
          onSelect={handleSelect}
          renderItem={item => (
            <span>
              {item.display}
              {item.section === 'compound' && (
                <span className="ml-1 text-stone-400 text-xs">compound</span>
              )}
            </span>
          )}
          getItemKey={item => item.display}
          placeholder="e.g., American, French"
          minChars={1}
          onBlur={handleBlur}
        />
      </div>
      {m.bio_notes && (
        <p className="mt-2 text-stone-500">{m.bio_notes}</p>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    submitted: 'bg-amber-100 text-amber-800',
    under_review: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }
  const labels = {
    submitted: 'New',
    under_review: 'In Review',
    approved: 'Approved',
    rejected: 'Rejected',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || ''}`}>
      {labels[status] || status}
    </span>
  )
}
