import { useState } from 'react'
import { submitContribution, autocomplete } from '../api'
import { SITE_NAME_SHORT } from '../constants'

const RELATIONSHIP_TYPES = [
  { value: 'formal_study', label: 'Conservatory / University Study' },
  { value: 'private_study', label: 'Private Study' },
  { value: 'apprenticeship', label: 'Apprenticeship' },
  { value: 'festival', label: 'Summer Festival / Intensive' },
  { value: 'masterclass', label: 'Masterclass' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'informal', label: 'Informal Mentorship' },
]

const EMPTY_RELATIONSHIP = {
  teacher_first_name: '',
  teacher_last_name: '',
  institution_name: '',
  institution_city: '',
  institution_country: '',
  relationship_type: 'formal_study',
  start_year: '',
  end_year: '',
  notes: '',
}

export default function SubmitPage() {
  const [form, setForm] = useState({
    submitter_name: '',
    submitter_email: '',
    student_first_name: '',
    student_last_name: '',
    student_birth_date: '',
    student_death_date: '',
    student_nationality: '',
    student_instrument: '',
    relationships: [{ ...EMPTY_RELATIONSHIP }],
    notes: '',
    verification_info: '',
    honeypot: '',
  })
  const [submitted, setSubmitted] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function updateRelationship(index, field, value) {
    setForm(prev => {
      const rels = [...prev.relationships]
      rels[index] = { ...rels[index], [field]: value }
      return { ...prev, relationships: rels }
    })
  }

  function addRelationship() {
    setForm(prev => ({
      ...prev,
      relationships: [...prev.relationships, { ...EMPTY_RELATIONSHIP }],
    }))
  }

  function removeRelationship(index) {
    setForm(prev => ({
      ...prev,
      relationships: prev.relationships.filter((_, i) => i !== index),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Clean up year fields: convert empty strings to null
    const payload = {
      ...form,
      student_birth_date: form.student_birth_date || null,
      student_death_date: form.student_death_date || null,
      student_instrument: form.student_instrument || null,
      relationships: form.relationships.map(r => ({
        ...r,
        start_year: r.start_year ? parseInt(r.start_year) : null,
        end_year: r.end_year ? parseInt(r.end_year) : null,
        institution_name: r.institution_name || null,
        institution_city: r.institution_city || null,
        institution_country: r.institution_country || null,
        notes: r.notes || null,
      })),
      notes: form.notes || null,
      verification_info: form.verification_info || null,
    }

    try {
      const result = await submitContribution(payload)
      setSubmitted(result)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-stone-800 mb-4">Thank you!</h1>
        <p className="text-stone-600 mb-2">
          Your submission has been received and will be reviewed by our editors.
        </p>
        <p className="text-sm text-stone-400">
          Submission ID: <span className="font-mono">{submitted.id}</span>
        </p>
        <p className="text-sm text-stone-400 mt-1">
          You can check the status anytime using your submission ID and email.
        </p>
        <button
          onClick={() => { setSubmitted(null); setForm({ ...form, relationships: [{ ...EMPTY_RELATIONSHIP }] }) }}
          className="mt-6 rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white
            hover:bg-stone-700 transition-colors"
        >
          Submit Another
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-2">Contribute to {SITE_NAME_SHORT}</h1>
      <p className="text-stone-500 mb-6">
        Tell us about a teacher-student relationship. All submissions are reviewed before publication.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Hidden honeypot field */}
        <input
          type="text"
          name="website"
          value={form.honeypot}
          onChange={e => updateField('honeypot', e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />

        {/* Your info */}
        <fieldset>
          <legend className="text-lg font-semibold text-stone-700 mb-3">Your Information</legend>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Your Name"
              value={form.submitter_name}
              onChange={v => updateField('submitter_name', v)}
              required
            />
            <Input
              label="Your Email"
              type="email"
              value={form.submitter_email}
              onChange={v => updateField('submitter_email', v)}
              required
            />
          </div>
        </fieldset>

        {/* Student info */}
        <fieldset>
          <legend className="text-lg font-semibold text-stone-700 mb-3">Student</legend>
          <p className="text-sm text-stone-400 mb-3">
            The person who studied. This might be you!
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={form.student_first_name}
              onChange={v => updateField('student_first_name', v)}
              required
            />
            <Input
              label="Last Name"
              value={form.student_last_name}
              onChange={v => updateField('student_last_name', v)}
              required
            />
            <Input
              label="Instrument"
              value={form.student_instrument}
              onChange={v => updateField('student_instrument', v)}
              placeholder="e.g., Oboe, Cello"
            />
            <Input
              label="Nationality"
              value={form.student_nationality}
              onChange={v => updateField('student_nationality', v)}
            />
            <Input
              label="Birth Year"
              value={form.student_birth_date}
              onChange={v => updateField('student_birth_date', v)}
              placeholder="e.g., 1985"
            />
            <Input
              label="Death Year"
              value={form.student_death_date}
              onChange={v => updateField('student_death_date', v)}
              placeholder="Leave blank if living"
            />
          </div>
        </fieldset>

        {/* Relationships */}
        <fieldset>
          <legend className="text-lg font-semibold text-stone-700 mb-3">
            Teacher{form.relationships.length > 1 ? 's' : ''}
          </legend>
          <div className="space-y-6">
            {form.relationships.map((rel, i) => (
              <div key={i} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-stone-500">
                    Teacher {form.relationships.length > 1 ? i + 1 : ''}
                  </span>
                  {form.relationships.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRelationship(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Teacher First Name"
                    value={rel.teacher_first_name}
                    onChange={v => updateRelationship(i, 'teacher_first_name', v)}
                    required
                  />
                  <Input
                    label="Teacher Last Name"
                    value={rel.teacher_last_name}
                    onChange={v => updateRelationship(i, 'teacher_last_name', v)}
                    required
                  />
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-600 mb-1">
                      Relationship Type
                    </label>
                    <select
                      value={rel.relationship_type}
                      onChange={e => updateRelationship(i, 'relationship_type', e.target.value)}
                      className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
                        focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      {RELATIONSHIP_TYPES.map(rt => (
                        <option key={rt.value} value={rt.value}>{rt.label}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Institution"
                    value={rel.institution_name}
                    onChange={v => updateRelationship(i, 'institution_name', v)}
                    placeholder="e.g., Curtis Institute of Music"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="City"
                      value={rel.institution_city}
                      onChange={v => updateRelationship(i, 'institution_city', v)}
                    />
                    <Input
                      label="Country"
                      value={rel.institution_country}
                      onChange={v => updateRelationship(i, 'institution_country', v)}
                    />
                  </div>
                  <Input
                    label="Start Year"
                    value={rel.start_year}
                    onChange={v => updateRelationship(i, 'start_year', v)}
                    placeholder="e.g., 1990"
                  />
                  <Input
                    label="End Year"
                    value={rel.end_year}
                    onChange={v => updateRelationship(i, 'end_year', v)}
                    placeholder="e.g., 1994"
                  />
                  <div className="col-span-2">
                    <Input
                      label="Notes"
                      value={rel.notes}
                      onChange={v => updateRelationship(i, 'notes', v)}
                      placeholder="e.g., Summers only, Fulbright fellowship"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addRelationship}
            className="mt-3 text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            + Add another teacher
          </button>
        </fieldset>

        {/* Additional info */}
        <fieldset>
          <legend className="text-lg font-semibold text-stone-700 mb-3">Additional Details</legend>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => updateField('notes', e.target.value)}
                rows={3}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
                  focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="Anything else we should know?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">
                How can we verify this?
              </label>
              <textarea
                value={form.verification_info}
                onChange={e => updateField('verification_info', e.target.value)}
                rows={2}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
                  focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder='e.g., "I am the student" or "See university faculty page at..."'
              />
            </div>
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-stone-800 px-6 py-2.5 text-sm font-medium text-white
            hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit for Review'}
        </button>
      </form>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', required = false, placeholder = '' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
          focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
    </div>
  )
}
