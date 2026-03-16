import ReactMarkdown from 'react-markdown'
import privacyMd from '../content/privacy-policy.md?raw'

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto prose prose-stone prose-headings:text-stone-800
      prose-a:text-amber-700 prose-strong:text-stone-700">
      <ReactMarkdown>{privacyMd}</ReactMarkdown>
    </div>
  )
}
