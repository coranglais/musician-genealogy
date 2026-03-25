import { useLocation } from 'react-router-dom'
import { SITE_NAME_SHORT } from '../constants'

export default function VerificationResult() {
  const location = useLocation()
  const alreadyVerified = location.pathname.includes('already-verified')

  return (
    <div className="max-w-xl mx-auto text-center py-16">
      {alreadyVerified ? (
        <>
          <h1 className="text-2xl font-bold text-stone-800 mb-4">Already verified</h1>
          <p className="text-stone-600">
            This submission has already been verified. Our editors will review it shortly.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-stone-800 mb-4">Email verified!</h1>
          <p className="text-stone-600 mb-2">
            Thank you for confirming your email. Your submission is now in our review queue.
          </p>
          <p className="text-stone-500 text-sm">
            Our editors will review your contribution and add it to {SITE_NAME_SHORT} if approved.
          </p>
        </>
      )}
      <a
        href="/"
        className="mt-8 inline-block rounded-md bg-stone-800 px-5 py-2.5 text-sm font-medium text-white
          hover:bg-stone-700 transition-colors"
      >
        Back to {SITE_NAME_SHORT}
      </a>
    </div>
  )
}
