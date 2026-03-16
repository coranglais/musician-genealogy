import ReactMarkdown from 'react-markdown'
import featuresMd from '../content/features.md?raw'

export default function HowItWorksPage() {
  return (
    <div className="max-w-2xl mx-auto prose prose-stone prose-headings:text-stone-800
      prose-a:text-amber-700 prose-strong:text-stone-700">
      <ReactMarkdown>{featuresMd}</ReactMarkdown>
    </div>
  )
}
