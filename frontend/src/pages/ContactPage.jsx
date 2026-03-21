import { useState, useEffect } from 'react'
import { getPublicConfig } from '../api'
import { SITE_NAME } from '../constants'

export default function ContactPage() {
  const [email, setEmail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicConfig()
      .then(config => setEmail(config.contact_email || ''))
      .catch(() => setEmail(''))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-stone-800 mb-6">Contact</h1>

      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm space-y-4">
        <p className="text-stone-700 leading-relaxed">
          {SITE_NAME} is a community-driven project. We welcome contributions of new data,
          corrections to existing records, error reports, and general questions.
        </p>

        <p className="text-stone-700 leading-relaxed">
          If you studied with a musician in our database, know of a teacher-student relationship
          we're missing, or spot an error, we'd love to hear from you.
        </p>

        {loading ? (
          <p className="text-stone-400">Loading...</p>
        ) : email ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-5 py-4">
            <p className="text-stone-700">
              Reach us at{' '}
              <a
                href={`mailto:${email}`}
                className="font-semibold text-amber-700 hover:text-amber-900 underline transition-colors"
              >
                {email}
              </a>
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-stone-100 border border-stone-200 px-5 py-4">
            <p className="text-stone-500 italic">Contact information coming soon.</p>
          </div>
        )}

        <p className="text-sm text-stone-500">
          You can also submit data directly through our{' '}
          <a href="/submit" className="text-amber-700 hover:text-amber-900 underline transition-colors">
            contribution form
          </a>.
        </p>
      </div>
    </div>
  )
}
