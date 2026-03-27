import { useState, useEffect } from 'react'
import { submitContribution, autocomplete, listInstitutions, listInstruments, parseSubmissionText } from '../api'
import { SITE_NAME_SHORT } from '../constants'
import AutocompleteInput from '../components/AutocompleteInput'
import { searchNationalities } from '../utils/nationalities'

const RELATIONSHIP_TYPES = [
  { value: 'formal_study', label: 'Conservatory / University Study' },
  { value: 'private_study', label: 'Private Study' },
  { value: 'apprenticeship', label: 'Apprenticeship' },
  { value: 'festival', label: 'Summer Festival / Intensive' },
  { value: 'masterclass', label: 'Masterclass' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'informal', label: 'Informal Mentorship' },
]

const RELATIONSHIP_LABEL = Object.fromEntries(RELATIONSHIP_TYPES.map(r => [r.value, r.label]))

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
  // Mode: 'freetext' or 'structured'
  const [mode, setMode] = useState('freetext')

  // Shared state
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [verificationInfo, setVerificationInfo] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitted, setSubmitted] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [instruments, setInstruments] = useState([])

  // Free-text mode state
  const [freeText, setFreeText] = useState('')
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState('')
  const [parsedCards, setParsedCards] = useState(null) // null = not yet parsed
  const [parseNotes, setParseNotes] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [showOriginalText, setShowOriginalText] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [parseFeedback, setParseFeedback] = useState('')

  // Structured mode state
  const [form, setForm] = useState({
    student_first_name: '',
    student_last_name: '',
    student_birth_date: '',
    student_death_date: '',
    student_nationality: '',
    student_instrument: '',
    relationships: [{ ...EMPTY_RELATIONSHIP }],
    notes: '',
  })

  useEffect(() => {
    listInstruments().then(setInstruments).catch(() => {})
  }, [])

  // --- Structured mode helpers ---
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

  // --- Parsed cards helpers ---
  function updateCard(index, field, value) {
    setParsedCards(prev => {
      const cards = [...prev]
      cards[index] = { ...cards[index], [field]: value }
      return cards
    })
  }

  function removeCard(index) {
    setParsedCards(prev => prev.filter((_, i) => i !== index))
  }

  function addBlankCard() {
    setParsedCards(prev => [...prev, {
      teacher_first_name: '',
      teacher_last_name: '',
      teacher_existing_id: null,
      institution_name: '',
      institution_existing_id: null,
      relationship_type: 'formal_study',
      start_year: '',
      end_year: '',
      notes: '',
    }])
  }

  // --- Search helpers ---
  async function searchMusicians(lastName, firstName = '') {
    const q = firstName ? `${firstName} ${lastName}` : lastName
    return autocomplete(q)
  }

  async function searchInstitutions(q) {
    if (q.length < 2) return []
    return listInstitutions(q)
  }

  function searchInstruments(q) {
    const lower = q.toLowerCase()
    return Promise.resolve(
      instruments.filter(inst => inst.name.toLowerCase().includes(lower))
    )
  }

  function formatInstrumentDisplay(inst) {
    if (!inst.parent_id) return inst.name
    const parent = instruments.find(i => i.id === inst.parent_id)
    return parent ? `${inst.name} (doubles ${parent.name})` : inst.name
  }

  // --- Parse free text ---
  async function handleParse() {
    if (!freeText.trim() || !submitterName.trim()) return
    setParseError('')
    setParseLoading(true)

    try {
      const result = await parseSubmissionText(freeText.trim(), submitterName.trim())
      setOriginalText(freeText)

      if (result.candidate_lineages.length === 0) {
        setParseError("We didn't find any teacher-student relationships in your text. Could you describe who you studied with, where, and when? Or you can switch to the structured form.")
        setParseLoading(false)
        return
      }

      // Convert API response to editable card format
      const cards = result.candidate_lineages.map(cl => ({
        teacher_first_name: cl.teacher_first_name || '',
        teacher_last_name: cl.teacher_last_name || '',
        teacher_name: cl.teacher_name,
        teacher_existing_id: cl.teacher_existing_id,
        institution_name: cl.institution_name || '',
        institution_existing_id: cl.institution_existing_id,
        relationship_type: cl.relationship_type || 'formal_study',
        start_year: cl.start_year != null ? String(cl.start_year) : '',
        end_year: cl.end_year != null ? String(cl.end_year) : '',
        notes: cl.notes || '',
        confidence: cl.confidence,
      }))

      setParsedCards(cards)
      setParseNotes(result.parse_notes || '')
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        setParseError("You've reached the limit for text parsing today. You can still submit using the structured form.")
      } else if (err.message === 'PARSE_FAILED') {
        setParseError("We couldn't extract any relationships from your text. Try being more specific — for example, mention your teacher's name, the school, and approximate dates. Or you can switch to the structured form.")
      } else {
        setParseError('Our text parser is temporarily unavailable. You can try again in a moment, or use the structured form instead.')
      }
    }
    setParseLoading(false)
  }

  function handleStartOver() {
    setParsedCards(null)
    setParseNotes('')
    setParseError('')
    // Keep the original text in the textarea for revision
  }

  // --- Submit (both modes converge here) ---
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let payload
    if (mode === 'freetext' && parsedCards) {
      // Build structured payload from parsed cards
      // Use submitter name as student name
      const nameParts = submitterName.trim().split(/\s+/)
      const studentFirst = nameParts.slice(0, -1).join(' ') || nameParts[0]
      const studentLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''

      payload = {
        submitter_name: submitterName,
        submitter_email: submitterEmail,
        student_first_name: studentFirst,
        student_last_name: studentLast,
        relationships: parsedCards.map(c => ({
          teacher_first_name: c.teacher_first_name,
          teacher_last_name: c.teacher_last_name,
          institution_name: c.institution_name || null,
          institution_city: null,
          institution_country: null,
          relationship_type: c.relationship_type,
          start_year: c.start_year ? parseInt(c.start_year) : null,
          end_year: c.end_year ? parseInt(c.end_year) : null,
          notes: c.notes || null,
        })),
        notes: `[Parsed from free text]\n${originalText}`,
        verification_info: verificationInfo || null,
        parse_feedback: parseFeedback || null,
        honeypot,
      }
    } else {
      // Structured mode
      payload = {
        submitter_name: submitterName,
        submitter_email: submitterEmail,
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
        verification_info: verificationInfo || null,
        honeypot,
      }
    }

    try {
      const result = await submitContribution(payload)
      setSubmitted(result)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  // --- Success screen ---
  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-stone-800 mb-4">Check your email</h1>
        <p className="text-stone-600 mb-2">
          We've sent a verification link to <span className="font-medium">{submitterEmail}</span>.
        </p>
        <p className="text-stone-600 mb-4">
          Please click the link to confirm your submission. Once verified, our editors
          will review it.
        </p>
        <p className="text-sm text-stone-400">
          The link expires in 7 days. If you don't see the email, check your spam folder.
        </p>
        <button
          onClick={() => {
            setSubmitted(null)
            setParsedCards(null)
            setFreeText('')
            setOriginalText('')
            setForm(prev => ({ ...prev, relationships: [{ ...EMPTY_RELATIONSHIP }] }))
          }}
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

      {/* Mode toggle */}
      <div className="flex mb-8 rounded-lg border border-stone-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setMode('freetext')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === 'freetext'
              ? 'bg-stone-800 text-white'
              : 'bg-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Describe it
        </button>
        <button
          type="button"
          onClick={() => setMode('structured')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-l border-stone-200 ${
            mode === 'structured'
              ? 'bg-stone-800 text-white'
              : 'bg-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Fill in fields
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Hidden honeypot field */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />

        {/* Your info — shared between modes */}
        <fieldset>
          <legend className="text-lg font-semibold text-stone-700 mb-3">Your Information</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Your Name"
              value={submitterName}
              onChange={setSubmitterName}
              required
            />
            {/* Email only shown when we need it for submission, not parse */}
            {(mode === 'structured' || parsedCards) && (
              <Input
                label="Your Email"
                type="email"
                value={submitterEmail}
                onChange={setSubmitterEmail}
                required
              />
            )}
          </div>
        </fieldset>

        {/* === FREE-TEXT MODE === */}
        {mode === 'freetext' && !parsedCards && (
          <fieldset>
            <legend className="text-lg font-semibold text-stone-700 mb-3">Describe Your Musical Education</legend>
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  value={freeText}
                  onChange={e => setFreeText(e.target.value.slice(0, 2000))}
                  rows={5}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
                    focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="Tell us about your musical education — who you studied with, where, and when. For example: 'I studied oboe with Richard Killmer at Eastman from 2001 to 2005, and attended the Aspen Music Festival in the summers of 2003 and 2004.'"
                />
                <span className="absolute bottom-2 right-3 text-xs text-stone-400">
                  {freeText.length}/2000
                </span>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowTips(!showTips)}
                  className="text-sm text-stone-500 hover:text-stone-700 font-medium flex items-center gap-1"
                >
                  <span className={`inline-block transition-transform ${showTips ? 'rotate-90' : ''}`}>&#9656;</span>
                  Tips for best results
                </button>
                {showTips && (
                  <ul className="mt-2 ml-4 text-sm text-stone-500 space-y-1 list-disc list-outside">
                    <li>Include your teacher's full name if you can ("John Mack" rather than just "Mack")</li>
                    <li>Mention the school or institution where you studied</li>
                    <li>Include approximate years if you remember them</li>
                    <li>Note the type of study — was it a degree program, private lessons, a summer festival, a masterclass?</li>
                    <li>Multiple teachers? Include them all — one paragraph is fine</li>
                  </ul>
                )}
              </div>

              {parseError && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  {parseError}
                </div>
              )}

              <button
                type="button"
                onClick={handleParse}
                disabled={parseLoading || !freeText.trim() || !submitterName.trim()}
                className="rounded-md bg-stone-800 px-5 py-2 text-sm font-medium text-white
                  hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {parseLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Parsing...
                  </span>
                ) : 'Parse'}
              </button>

              {!submitterName.trim() && freeText.trim() && (
                <p className="text-xs text-stone-400">Enter your name above to enable parsing.</p>
              )}
            </div>
          </fieldset>
        )}

        {/* === PARSED RESULTS (review cards) === */}
        {mode === 'freetext' && parsedCards && (
          <>
            <fieldset>
              <legend className="text-lg font-semibold text-stone-700 mb-3">Review Parsed Results</legend>

              <div className="rounded-md bg-stone-50 border border-stone-200 p-3 text-sm text-stone-600 mb-4">
                Our text parser is still learning. Please review these results carefully and correct any errors before submitting.
              </div>

              {parseNotes && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 mb-4">
                  {parseNotes}
                </div>
              )}

              <div className="space-y-4">
                {parsedCards.map((card, i) => (
                  <div key={i} className="rounded-lg border border-stone-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-stone-500">
                        Relationship {parsedCards.length > 1 ? i + 1 : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCard(i)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Input
                          label="Teacher First Name"
                          value={card.teacher_first_name}
                          onChange={v => updateCard(i, 'teacher_first_name', v)}
                          required
                        />
                        {card.teacher_existing_id && (
                          <span className="text-xs text-emerald-600 mt-1 inline-block">Matched</span>
                        )}
                      </div>
                      <div>
                        <AutocompleteInput
                          label="Teacher Last Name"
                          value={card.teacher_last_name}
                          onChange={v => {
                            updateCard(i, 'teacher_last_name', v)
                            updateCard(i, 'teacher_existing_id', null)
                          }}
                          onSearch={q => searchMusicians(q, card.teacher_first_name)}
                          onSelect={item => {
                            updateCard(i, 'teacher_first_name', item.first_name)
                            updateCard(i, 'teacher_last_name', item.last_name)
                            updateCard(i, 'teacher_existing_id', item.musician_id)
                          }}
                          renderItem={item => (
                            <>
                              <span className="font-medium">{item.display_name}</span>
                              {(item.birth_date || item.death_date) && (
                                <span className="ml-2 text-stone-400">
                                  ({item.birth_date || '?'}&ndash;{item.death_date || ''})
                                </span>
                              )}
                            </>
                          )}
                          getItemKey={item => item.musician_id}
                          required
                        />
                        {card.teacher_existing_id ? (
                          <span className="text-xs text-emerald-600 mt-1 inline-block">Matched</span>
                        ) : card.teacher_last_name ? (
                          <span className="text-xs text-amber-600 mt-1 inline-block">New &mdash; will be created if approved</span>
                        ) : null}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-stone-600 mb-1">
                          Relationship Type
                        </label>
                        <select
                          value={card.relationship_type}
                          onChange={e => updateCard(i, 'relationship_type', e.target.value)}
                          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
                            focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        >
                          {RELATIONSHIP_TYPES.map(rt => (
                            <option key={rt.value} value={rt.value}>{rt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <AutocompleteInput
                          label="Institution"
                          value={card.institution_name}
                          onChange={v => {
                            updateCard(i, 'institution_name', v)
                            updateCard(i, 'institution_existing_id', null)
                          }}
                          onSearch={searchInstitutions}
                          onSelect={item => {
                            updateCard(i, 'institution_name', item.name)
                            updateCard(i, 'institution_existing_id', item.id)
                          }}
                          renderItem={item => (
                            <>
                              <span className="font-medium">{item.name}</span>
                              {(item.city || item.country) && (
                                <span className="ml-2 text-stone-400">
                                  {[item.city, item.country].filter(Boolean).join(', ')}
                                </span>
                              )}
                            </>
                          )}
                          getItemKey={item => item.id}
                          placeholder="e.g., Curtis Institute of Music"
                        />
                        {card.institution_existing_id ? (
                          <span className="text-xs text-emerald-600 mt-1 inline-block">Matched</span>
                        ) : card.institution_name ? (
                          <span className="text-xs text-amber-600 mt-1 inline-block">New &mdash; will be created if approved</span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label="Start Year"
                          value={card.start_year}
                          onChange={v => updateCard(i, 'start_year', v)}
                          placeholder="e.g., 1990"
                        />
                        <Input
                          label="End Year"
                          value={card.end_year}
                          onChange={v => updateCard(i, 'end_year', v)}
                          placeholder="e.g., 1994"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          label="Notes"
                          value={card.notes}
                          onChange={v => updateCard(i, 'notes', v)}
                          placeholder="e.g., Summers only, Fulbright fellowship"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addBlankCard}
                className="mt-3 text-sm text-amber-700 hover:text-amber-900 font-medium"
              >
                + Add another relationship
              </button>
            </fieldset>

            {/* Collapsible original text */}
            <div className="text-sm">
              <button
                type="button"
                onClick={() => setShowOriginalText(!showOriginalText)}
                className="text-stone-500 hover:text-stone-700 font-medium"
              >
                {showOriginalText ? 'Hide' : 'Show'} original text
              </button>
              {showOriginalText && (
                <div className="mt-2 rounded-md bg-stone-50 border border-stone-200 p-3 text-stone-600 whitespace-pre-wrap">
                  {originalText}
                </div>
              )}
            </div>

            {/* Start Over */}
            <button
              type="button"
              onClick={handleStartOver}
              className="text-sm text-stone-500 hover:text-stone-700 underline"
            >
              Start Over
            </button>

            {/* Parser feedback */}
            <fieldset>
              <legend className="text-lg font-semibold text-stone-700 mb-3">Anything we got wrong?</legend>
              <p className="text-sm text-stone-400 mb-2">
                Help us improve — tell us what the parser missed or misunderstood.
              </p>
              <textarea
                value={parseFeedback}
                onChange={e => setParseFeedback(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
                  focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="Optional"
              />
            </fieldset>

            {/* Verification + submission fields */}
            <fieldset>
              <legend className="text-lg font-semibold text-stone-700 mb-3">Additional Details</legend>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-1">
                    How can we verify this?
                  </label>
                  <textarea
                    value={verificationInfo}
                    onChange={e => setVerificationInfo(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
                      focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder='"I am the student" or "See university faculty page at..."'
                  />
                </div>
              </div>
            </fieldset>
          </>
        )}

        {/* === STRUCTURED MODE === */}
        {mode === 'structured' && (
          <>
            {/* Student info */}
            <fieldset>
              <legend className="text-lg font-semibold text-stone-700 mb-3">Student</legend>
              <p className="text-sm text-stone-400 mb-3">
                The person who studied. This might be you!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={form.student_first_name}
                  onChange={v => updateField('student_first_name', v)}
                  required
                />
                <AutocompleteInput
                  label="Last Name"
                  value={form.student_last_name}
                  onChange={v => updateField('student_last_name', v)}
                  onSearch={q => searchMusicians(q, form.student_first_name)}
                  onSelect={item => {
                    updateField('student_first_name', item.first_name)
                    updateField('student_last_name', item.last_name)
                  }}
                  renderItem={item => (
                    <>
                      <span className="font-medium">{item.display_name}</span>
                      {(item.birth_date || item.death_date) && (
                        <span className="ml-2 text-stone-400">
                          ({item.birth_date || '?'}&ndash;{item.death_date || ''})
                        </span>
                      )}
                    </>
                  )}
                  getItemKey={item => item.musician_id}
                  required
                />
                <AutocompleteInput
                  label="Instrument"
                  value={form.student_instrument}
                  onChange={v => updateField('student_instrument', v)}
                  onSearch={searchInstruments}
                  onSelect={item => updateField('student_instrument', item.name)}
                  renderItem={item => (
                    <span>{formatInstrumentDisplay(item)}</span>
                  )}
                  getItemKey={item => item.id}
                  placeholder="e.g., Oboe, Cello"
                  minChars={1}
                />
                <AutocompleteInput
                  label="Nationality"
                  value={form.student_nationality}
                  onChange={v => updateField('student_nationality', v)}
                  onSearch={searchNationalities}
                  onSelect={item => updateField('student_nationality', item.name)}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Teacher First Name"
                        value={rel.teacher_first_name}
                        onChange={v => updateRelationship(i, 'teacher_first_name', v)}
                        required
                      />
                      <AutocompleteInput
                        label="Teacher Last Name"
                        value={rel.teacher_last_name}
                        onChange={v => updateRelationship(i, 'teacher_last_name', v)}
                        onSearch={q => searchMusicians(q, rel.teacher_first_name)}
                        onSelect={item => {
                          updateRelationship(i, 'teacher_first_name', item.first_name)
                          updateRelationship(i, 'teacher_last_name', item.last_name)
                        }}
                        renderItem={item => (
                          <>
                            <span className="font-medium">{item.display_name}</span>
                            {(item.birth_date || item.death_date) && (
                              <span className="ml-2 text-stone-400">
                                ({item.birth_date || '?'}&ndash;{item.death_date || ''})
                              </span>
                            )}
                          </>
                        )}
                        getItemKey={item => item.musician_id}
                        required
                      />
                      <div className="sm:col-span-2">
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
                      <AutocompleteInput
                        label="Institution"
                        value={rel.institution_name}
                        onChange={v => updateRelationship(i, 'institution_name', v)}
                        onSearch={searchInstitutions}
                        onSelect={item => {
                          updateRelationship(i, 'institution_name', item.name)
                          if (item.city) updateRelationship(i, 'institution_city', item.city)
                          if (item.country) updateRelationship(i, 'institution_country', item.country)
                        }}
                        renderItem={item => (
                          <>
                            <span className="font-medium">{item.name}</span>
                            {(item.city || item.country) && (
                              <span className="ml-2 text-stone-400">
                                {[item.city, item.country].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </>
                        )}
                        getItemKey={item => item.id}
                        placeholder="e.g., Curtis Institute of Music"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      <div className="sm:col-span-2">
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
                    value={verificationInfo}
                    onChange={e => setVerificationInfo(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
                      focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder='"I am the student" or "See university faculty page at..."'
                  />
                </div>
              </div>
            </fieldset>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Submit button — only show when there's something to submit */}
        {(mode === 'structured' || parsedCards) && (
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-stone-800 px-6 py-2.5 text-sm font-medium text-white
                hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit for Review'}
            </button>
            <p className="text-xs text-stone-400">
              By submitting, you agree to our{' '}
              <a href="/privacy" className="underline hover:text-stone-600 transition-colors">
                privacy policy
              </a>.
            </p>
          </div>
        )}
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
